# MinIO → Local Filesystem Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace MinIO/S3 image storage with local filesystem storage so the production deploy drops from 4 Docker services to 3 (app + postgres + redis).

**Architecture:** Introduce `storageService.ts` with a tiny fs-based API (`saveToStorage`, `readFromStorage`, `deleteFromStorage`). `imageService.ts` calls into this instead of S3. Route handlers at `/api/users/avatar/:filename`, `/api/chores/image/:filename`, `/api/chores/thumbnail/:filename` keep identical URL shapes — only the backing store changes. Files live under a configurable `IMAGE_STORAGE_DIR` (default `./data/images`) that maps to the existing `./data` volume mount.

**Tech Stack:** Bun, TypeScript, `node:fs/promises`, Sharp (already used for thumbnails), Elysia.

---

## File Structure

**New:**

- `apps/api/src/services/storageService.ts` — fs-based CRUD for image files
- `apps/api/test/storageService.test.ts` — unit tests against a temp dir

**Modified:**

- `apps/api/src/services/imageService.ts` — swap S3 calls for storage calls; drop `getS3DirectUrl` import
- `apps/api/src/config.ts` — remove S3 schema/parse, add `IMAGE_STORAGE_DIR`
- `apps/api/package.json` — drop `@aws-sdk/client-s3` dependency
- `apps/api/test/imageService.test.ts` — update mocks to stub storageService
- `.env.example` — remove `S3_*` and `MINIO_*`, add `IMAGE_STORAGE_DIR` note
- `docker-compose.yml` — remove `minio` and `minio-init` services
- `docker-compose.prod-example.yml` — same
- `README.md` (if it mentions MinIO) — update setup instructions
- `CLAUDE.md` — update "Image Storage" line under Important Notes

**Deleted:**

- `apps/api/src/services/s3Service.ts`
- `apps/api/test/s3Service.test.ts`

**Unchanged (verify still work):**

- `apps/api/src/routes/users/index.ts:180-195` — avatar serve route
- `apps/api/src/routes/chores/index.ts:861-930` — chore image/thumbnail serve routes
- `apps/api/src/services/userProfileService.ts` — uses `getAvatarUrl` which returns a proxied API path, no change needed

---

## Task 1: Storage service skeleton and tests

**Files:**

- Create: `apps/api/src/services/storageService.ts`
- Create: `apps/api/test/storageService.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/test/storageService.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  saveToStorage,
  readFromStorage,
  deleteFromStorage,
} from "../src/services/storageService";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "hously-storage-"));
  process.env.IMAGE_STORAGE_DIR = dir;
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  delete process.env.IMAGE_STORAGE_DIR;
});

describe("storageService", () => {
  it("saves, reads, and deletes a file", async () => {
    const buf = Buffer.from("hello");
    expect(await saveToStorage(buf, "a.txt")).toBe(true);

    const read = await readFromStorage("a.txt");
    expect(read?.toString()).toBe("hello");

    expect(await deleteFromStorage("a.txt")).toBe(true);
    expect(await readFromStorage("a.txt")).toBeNull();
  });

  it("returns null for missing files", async () => {
    expect(await readFromStorage("missing.txt")).toBeNull();
  });

  it("rejects path traversal attempts", async () => {
    await expect(saveToStorage(Buffer.from("x"), "../evil")).rejects.toThrow();
    await expect(readFromStorage("../evil")).rejects.toThrow();
    await expect(deleteFromStorage("../evil")).rejects.toThrow();
  });

  it("creates the storage dir on first write", async () => {
    await rm(dir, { recursive: true, force: true });
    expect(await saveToStorage(Buffer.from("x"), "a.txt")).toBe(true);
    expect((await readFromStorage("a.txt"))?.toString()).toBe("x");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd apps/api && bun test test/storageService.test.ts`
Expected: FAIL — module `../src/services/storageService` not found.

- [ ] **Step 3: Implement `storageService.ts`**

```typescript
// apps/api/src/services/storageService.ts
/**
 * Local filesystem storage for images.
 * Replaces the prior S3/MinIO-backed implementation.
 */
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

function getStorageDir(): string {
  return Bun.env.IMAGE_STORAGE_DIR || "./data/images";
}

function safeJoin(filename: string): string {
  const root = resolve(getStorageDir());
  const full = resolve(root, filename);
  if (full !== root && !full.startsWith(root + sep)) {
    throw new Error(`Invalid filename: ${filename}`);
  }
  return full;
}

async function ensureDir(): Promise<void> {
  await mkdir(resolve(getStorageDir()), { recursive: true });
}

export async function saveToStorage(
  content: Buffer | Uint8Array,
  filename: string,
): Promise<boolean> {
  const path = safeJoin(filename);
  try {
    await ensureDir();
    await writeFile(path, content);
    return true;
  } catch (error) {
    console.error(`Failed to write file ${filename}:`, error);
    return false;
  }
}

export async function readFromStorage(
  filename: string,
): Promise<Buffer | null> {
  const path = safeJoin(filename);
  try {
    return await readFile(path);
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return null;
    console.error(`Failed to read file ${filename}:`, error);
    return null;
  }
}

export async function deleteFromStorage(filename: string): Promise<boolean> {
  const path = safeJoin(filename);
  try {
    await unlink(path);
    return true;
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return true;
    console.error(`Failed to delete file ${filename}:`, error);
    return false;
  }
}
```

Note: `safeJoin` throws on traversal. The test expects `rejects.toThrow()`, which requires the throw to happen inside the promise — since `safeJoin` is synchronous but called inside an `async` function, the throw gets wrapped in the returned promise. Good.

- [ ] **Step 4: Run the test and verify it passes**

Run: `cd apps/api && bun test test/storageService.test.ts`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/storageService.ts apps/api/test/storageService.test.ts
git commit -m "feat(storage): add local filesystem image storage service"
```

---

## Task 2: Switch imageService to use storageService

**Files:**

- Modify: `apps/api/src/services/imageService.ts` (all S3 imports and calls)
- Modify: `apps/api/test/imageService.test.ts` (mock storageService instead of s3Service)

- [ ] **Step 1: Update `imageService.ts` imports and calls**

Replace the top of the file:

```typescript
import sharp from "sharp";
import {
  saveToStorage,
  deleteFromStorage,
  readFromStorage,
} from "./storageService";
import { getBaseUrl } from "@hously/api/config";
```

Remove the entire `isS3Configured()` check inside `saveImageAndCreateThumbnail`. Local fs is always available — no configuration gate needed.

Replace the function body's upload/delete/get calls:

- `uploadToS3(buf, name, contentType)` → `saveToStorage(buf, name)` (drop contentType — fs doesn't need it; we set the Content-Type header in the serve routes based on filename)
- `deleteFromS3(name)` → `deleteFromStorage(name)`
- `getFileFromS3(name)` → `readFromStorage(name)`

Update the two helpers at the bottom:

```typescript
export async function getImage(filename: string): Promise<Buffer | null> {
  return readFromStorage(filename);
}

export async function getThumbnail(filename: string): Promise<Buffer | null> {
  return readFromStorage(`thumbnail-${filename}`);
}
```

`getAvatarUrl` stays identical — it already returns a proxied API path.

Full updated `saveImageAndCreateThumbnail`:

```typescript
export async function saveImageAndCreateThumbnail(file: File): Promise<string> {
  if (!file || !isAllowedFile(file.name)) {
    throw new Error("Invalid file type. Only images are allowed.");
  }

  const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const uniqueFilename = `${crypto.randomUUID().replace(/-/g, "")}.${fileExt}`;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    const uploadSuccess = await saveToStorage(imageBuffer, uniqueFilename);
    if (!uploadSuccess) {
      throw new Error("Failed to save image");
    }

    const thumbnailBuffer = await sharp(imageBuffer)
      .rotate()
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: "cover",
        position: "center",
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 85 })
      .toBuffer();

    const thumbnailSuccess = await saveToStorage(
      thumbnailBuffer,
      `thumbnail-${uniqueFilename}`,
    );

    if (!thumbnailSuccess) {
      await deleteFromStorage(uniqueFilename);
      throw new Error("Failed to save thumbnail");
    }

    console.log(`Saved image and thumbnail: ${uniqueFilename}`);
    return uniqueFilename;
  } catch (error) {
    console.error("Error saving image:", error);
    throw new Error(`Error saving image: ${error}`);
  }
}
```

- [ ] **Step 2: Update `imageService.test.ts`**

Read the existing file first: `apps/api/test/imageService.test.ts`. Wherever it mocks `s3Service` via `mock.module("../src/services/s3Service", …)`, change the path to `../src/services/storageService` and the method names from `uploadToS3`/`deleteFromS3`/`getFileFromS3` to `saveToStorage`/`deleteFromStorage`/`readFromStorage`. Remove any assertions about `isS3Configured` (it no longer exists in the call path).

If the test uses real fs instead of mocks (preferred — matches Task 1's style), set `IMAGE_STORAGE_DIR` to a temp dir in `beforeEach` and clean up in `afterEach`, exactly like Task 1's test.

- [ ] **Step 3: Run the tests**

Run: `cd apps/api && bun test test/imageService.test.ts`
Expected: PASS.

- [ ] **Step 4: Run the full API test suite to catch regressions**

Run: `cd apps/api && bun test`
Expected: all tests pass (the `s3Service.test.ts` file still exists at this point and should still pass against the old s3Service — we delete both together in Task 4).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/imageService.ts apps/api/test/imageService.test.ts
git commit -m "refactor(images): use local filesystem storage instead of S3"
```

---

## Task 3: Manual verification of routes

**Files:** no code changes — this is a sanity check.

- [ ] **Step 1: Start services and run the API**

```bash
make dev-services
make dev-api
```

- [ ] **Step 2: Upload a chore image via the web UI**

Start the web app (`make dev-web`), create a chore with an image attached. Confirm:

- The image appears in the chore list.
- A file appears under `apps/api/data/images/` (or wherever `IMAGE_STORAGE_DIR` resolves).
- A `thumbnail-<uuid>.<ext>` sibling file exists.
- Opening `/api/chores/image/<filename>` in the browser serves the image.

- [ ] **Step 3: Upload an avatar**

Change user avatar from profile settings. Confirm the file lands in the storage dir and `/api/users/avatar/<filename>` serves it.

- [ ] **Step 4: Delete the chore**

Confirm both the original and thumbnail files are removed from disk.

No commit — verification only.

---

## Task 4: Remove s3Service, AWS SDK dep, and S3 config

**Files:**

- Delete: `apps/api/src/services/s3Service.ts`
- Delete: `apps/api/test/s3Service.test.ts`
- Modify: `apps/api/src/config.ts` (lines 44–49 schema + 123–133 parse block)
- Modify: `apps/api/package.json` (remove `@aws-sdk/client-s3`)
- Modify: `apps/api/test/config.test.ts` (drop assertions about S3 env vars)

- [ ] **Step 1: Delete the S3 service and its tests**

```bash
rm apps/api/src/services/s3Service.ts apps/api/test/s3Service.test.ts
```

- [ ] **Step 2: Confirm nothing imports s3Service anymore**

Run: `grep -rn "s3Service\|uploadToS3\|deleteFromS3\|getFileFromS3\|isS3Configured\|getS3FileUrl\|getS3ThumbnailUrl\|getS3DirectUrl" apps/`
Expected: no results.

- [ ] **Step 3: Remove S3 fields from config schema and parse**

In `apps/api/src/config.ts`:

- Delete lines 44–49 (the six `S3_*` fields in the Zod schema).
- Delete lines 120–134 (the `getS3Config` function and related parse block — open the file to confirm boundaries before editing).

Add a single `IMAGE_STORAGE_DIR` field to the schema:

```typescript
IMAGE_STORAGE_DIR: z.string().optional().default("./data/images"),
```

- [ ] **Step 4: Update config.test.ts**

Open `apps/api/test/config.test.ts`. Remove any `describe`/`it` blocks asserting on `S3_*` env handling. Add a short test that `IMAGE_STORAGE_DIR` defaults to `./data/images` when unset.

- [ ] **Step 5: Drop the AWS SDK dependency**

```bash
cd apps/api && bun remove @aws-sdk/client-s3
```

- [ ] **Step 6: Typecheck and test**

Run:

```bash
cd apps/api && bun test
make typecheck
```

Expected: green.

- [ ] **Step 7: Commit**

```bash
git add -A apps/api
git commit -m "chore(storage): remove s3Service, aws-sdk, and S3 config"
```

---

## Task 5: Remove MinIO from Docker Compose files

**Files:**

- Modify: `docker-compose.yml`
- Modify: `docker-compose.prod-example.yml`

- [ ] **Step 1: Strip `minio` and `minio-init` service blocks and the `minio_data` volume from `docker-compose.prod-example.yml`**

Delete lines 51–86 (the `minio:` and `minio-init:` service blocks) and the `minio_data:` entry under `volumes:` at line 95. Remove the `minio` service from any `depends_on` lists on the `hously` service (there isn't one currently, but verify).

The final file should have three services (`hously`, `db`, `redis`), two volumes (`db_data`, `redis_data`), one network.

- [ ] **Step 2: Do the same in `docker-compose.yml`**

Open the file and apply equivalent deletions. Keep only app / db / redis services.

- [ ] **Step 3: Bring the stack up to confirm it still boots**

```bash
docker compose -f docker-compose.yml down
docker compose -f docker-compose.yml up -d
docker compose ps
```

Expected: three containers running healthy.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml docker-compose.prod-example.yml
git commit -m "chore(docker): remove minio and minio-init services"
```

---

## Task 6: Update .env.example and docs

**Files:**

- Modify: `.env.example`
- Modify: `CLAUDE.md` (one line under "Important Notes")
- Modify: `README.md` (if it references MinIO — grep first)

- [ ] **Step 1: Prune env vars**

In `.env.example`, delete every `S3_*` and `MINIO_*` line. Add a single line:

```
# Where uploaded images are stored on disk. Relative paths resolve from apps/api.
IMAGE_STORAGE_DIR=./data/images
```

- [ ] **Step 2: Update CLAUDE.md**

Change the bullet under "Important Notes" from:

```
- **Image Storage**: MinIO (S3-compatible) for avatars, chores, recipes
```

to:

```
- **Image Storage**: Local filesystem under `IMAGE_STORAGE_DIR` (defaults to `./data/images`)
```

- [ ] **Step 3: Update README.md if needed**

Run: `grep -n -i "minio\|s3" README.md`
For each match, replace MinIO references with filesystem storage, or delete the paragraph if it's a setup step that no longer applies.

- [ ] **Step 4: Commit**

```bash
git add .env.example CLAUDE.md README.md
git commit -m "docs: document local filesystem image storage; drop MinIO references"
```

---

## Task 7: Final verification

- [ ] **Step 1: Run full monorepo tests**

Run: `make test`
Expected: all green.

- [ ] **Step 2: Typecheck everything**

Run: `make typecheck && make lint`
Expected: clean.

- [ ] **Step 3: Full fresh Docker smoke test**

```bash
docker compose down -v
docker compose up -d
# Wait for healthy, then: load the web app, upload a chore image, reload. Confirm it persists.
docker compose down
docker compose up -d
# Reload the web app. The image should still be there because ./data is mounted.
```

- [ ] **Step 4: Open PR**

Branch name suggestion: `refactor/minio-to-filesystem`. In the PR body, note the breaking change for existing deployers: they must migrate existing MinIO bucket contents into `./data/images/` before upgrading (a one-liner `mc cp --recursive local/hously-images ./data/images` works if they still have `mc` configured).

---

## Notes for reviewers

- No existing data migration is included in code — this is a greenfield cutover. If you have production data in MinIO, follow the PR body note before deploying.
- `getS3DirectUrl` is deleted; nothing in the repo actually called it (it was imported in `imageService.ts` but unused).
- Content-Type handling now lives entirely in the serve routes, which already compute it from the filename extension. Filesystem writes don't store it as metadata, but nothing needed it.
