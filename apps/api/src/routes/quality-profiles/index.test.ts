/**
 * Integration tests for /api/quality-profiles.
 *
 * Strategy: use mock.module() before dynamic-importing the route so that
 * @hously/api/auth and @hously/api/middleware/auth resolve to stubs, and
 * @hously/api/db resolves to a real PrismaClient connected to the dev DB.
 *
 * Static `import` statements are hoisted and run before any code, so all
 * mocking must happen via mock.module() + lazy dynamic import().
 */
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Elysia } from "elysia";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const hasDb = !!process.env.DATABASE_URL;

// ── 1. Real Prisma (overrides preload's "../src/db" null-proxy) ───────────────
const realPrisma = hasDb
  ? new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    })
  : null;

mock.module("@hously/api/db", () => ({ prisma: realPrisma }));

// ── 2. Mutable user slot — tests set this to control auth state ───────────────
type FakeUser = { id: string; is_admin: boolean; email: string } | null;
let injectedUser: FakeUser = null;

// ── 3. Stub out Better Auth and requireUser ───────────────────────────────────
mock.module("@hously/api/auth", () => ({
  auth: (app: Elysia) => app,
}));

mock.module("@hously/api/middleware/auth", () => ({
  requireUser: (app: Elysia) =>
    app
      .resolve(() => ({ user: injectedUser as FakeUser }))
      .onBeforeHandle(
        ({
          user,
          set,
        }: {
          user: FakeUser;
          set: { status?: number | string };
        }) => {
          if (!user) {
            set.status = 401;
            return { error: "Unauthorized" };
          }
        },
      ),
}));

// ── 4. Lazy-import the route (picks up the mocks above) ───────────────────────
const { qualityProfilesRoutes } = await import("./index");

const app = new Elysia().use(qualityProfilesRoutes);

// ── Helpers ───────────────────────────────────────────────────────────────────
const ADMIN: FakeUser = { id: "admin", is_admin: true, email: "admin@test.local" };

const BASE_PROFILE = {
  name: "Test Profile",
  min_resolution: 1080,
  preferred_sources: ["WEB-DL"],
  preferred_codecs: ["H.264"],
  require_hdr: false,
  prefer_hdr: false,
};

function req(path: string, init?: RequestInit) {
  return new Request(`http://localhost${path}`, init);
}

function jsonReq(path: string, method: string, body: unknown) {
  return req(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function createCustomFormat(name: string) {
  if (!realPrisma) throw new Error("no db");
  return realPrisma.customFormat.create({
    data: {
      name,
      conditions: [{ type: "source", operator: "equals", value: "WEB-DL" }],
    },
  });
}

async function createProfile(overrides: Record<string, unknown> = {}) {
  const res = await app.handle(
    jsonReq("/api/quality-profiles", "POST", { ...BASE_PROFILE, ...overrides }),
  );
  return ((await res.json()) as any).profile as { id: number; name: string };
}

// ── Suite ─────────────────────────────────────────────────────────────────────
describe("Quality Profiles API", () => {
  beforeEach(async () => {
    injectedUser = ADMIN;
    if (!hasDb || !realPrisma) return;
    // Delete assignments first (FK), then profiles, then custom formats
    await realPrisma.qualityProfileCustomFormat.deleteMany({});
    await realPrisma.qualityProfile.deleteMany({});
    await realPrisma.customFormat.deleteMany({});
  });

  afterEach(async () => {
    if (!hasDb || !realPrisma) return;
    await realPrisma.qualityProfileCustomFormat.deleteMany({});
    await realPrisma.qualityProfile.deleteMany({});
    await realPrisma.customFormat.deleteMany({});
  });

  it("POST basic profile → 201 with min_seeders default 0 and empty custom_formats", async () => {
    if (!hasDb) return;
    const res = await app.handle(jsonReq("/api/quality-profiles", "POST", BASE_PROFILE));
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    const p = body.profile;
    expect(typeof p.id).toBe("number");
    expect(p.name).toBe("Test Profile");
    expect(p.min_seeders).toBe(0);
    expect(Array.isArray(p.custom_formats)).toBe(true);
    expect(p.custom_formats.length).toBe(0);
  });

  it("POST with min_seeders + custom_format assignment → 201, correct values in GET", async () => {
    if (!hasDb) return;
    const fmt = await createCustomFormat("WEB-DL Format");
    const res = await app.handle(
      jsonReq("/api/quality-profiles", "POST", {
        ...BASE_PROFILE,
        name: "Seeded Profile",
        min_seeders: 3,
        custom_formats: [
          {
            custom_format_id: fmt.id,
            score: 200,
            required: false,
            forbidden: true,
          },
        ],
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    const p = body.profile;
    expect(p.min_seeders).toBe(3);
    expect(p.custom_formats.length).toBe(1);
    expect(p.custom_formats[0].custom_format_id).toBe(fmt.id);
    expect(p.custom_formats[0].name).toBe("WEB-DL Format");
    expect(p.custom_formats[0].score).toBe(200);
    expect(p.custom_formats[0].required).toBe(false);
    expect(p.custom_formats[0].forbidden).toBe(true);

    // Verify GET list also reflects the data
    const listRes = await app.handle(req("/api/quality-profiles"));
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as any;
    const found = listBody.profiles.find((x: any) => x.id === p.id);
    expect(found).toBeDefined();
    expect(found.min_seeders).toBe(3);
    expect(found.custom_formats[0].score).toBe(200);
    expect(found.custom_formats[0].forbidden).toBe(true);
  });

  it("POST with unknown custom_format_id → 400 unknown custom_format_id", async () => {
    if (!hasDb) return;
    const res = await app.handle(
      jsonReq("/api/quality-profiles", "POST", {
        ...BASE_PROFILE,
        name: "Bad Format Profile",
        custom_formats: [{ custom_format_id: 999999, score: 1 }],
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toContain("unknown custom_format_id");
  });

  it("PUT with custom_formats: [] → clears assignments, min_seeders change persists", async () => {
    if (!hasDb) return;
    const fmt = await createCustomFormat("ClearMe");
    // Create with a format and min_seeders
    const profile = await createProfile({
      name: "Update Profile",
      min_seeders: 5,
      custom_formats: [{ custom_format_id: fmt.id, score: 100 }],
    });

    // PUT with empty custom_formats and changed min_seeders
    const putRes = await app.handle(
      jsonReq(`/api/quality-profiles/${profile.id}`, "PUT", {
        ...BASE_PROFILE,
        name: "Update Profile",
        min_seeders: 10,
        custom_formats: [],
      }),
    );
    expect(putRes.status).toBe(200);
    const putBody = (await putRes.json()) as any;
    expect(putBody.profile.min_seeders).toBe(10);
    expect(putBody.profile.custom_formats.length).toBe(0);

    // Confirm via GET list
    const listRes = await app.handle(req("/api/quality-profiles"));
    const listBody = (await listRes.json()) as any;
    const found = listBody.profiles.find((x: any) => x.id === profile.id);
    expect(found.min_seeders).toBe(10);
    expect(found.custom_formats.length).toBe(0);
  });

  it("PUT omitting custom_formats leaves assignments untouched", async () => {
    if (!hasDb) return;
    const fmt = await createCustomFormat("Sticky");
    const profile = await createProfile({
      name: "Sticky Profile",
      custom_formats: [{ custom_format_id: fmt.id, score: 50 }],
    });

    // PUT without custom_formats field
    const putRes = await app.handle(
      jsonReq(`/api/quality-profiles/${profile.id}`, "PUT", {
        ...BASE_PROFILE,
        name: "Sticky Profile",
      }),
    );
    expect(putRes.status).toBe(200);
    const putBody = (await putRes.json()) as any;
    // Assignments should be preserved
    expect(putBody.profile.custom_formats.length).toBe(1);
    expect(putBody.profile.custom_formats[0].score).toBe(50);
  });

  it("POST duplicate name → 409", async () => {
    if (!hasDb) return;
    await createProfile({ name: "Dup" });
    const res = await app.handle(
      jsonReq("/api/quality-profiles", "POST", { ...BASE_PROFILE, name: "Dup" }),
    );
    expect(res.status).toBe(409);
  });

  it("returns 401 when unauthenticated", async () => {
    if (!hasDb) return;
    injectedUser = null;
    const res = await app.handle(req("/api/quality-profiles"));
    expect(res.status).toBe(401);
  });

  it("POST returns 403 when non-admin", async () => {
    if (!hasDb) return;
    injectedUser = { id: "user1", is_admin: false, email: "user@test.local" };
    const res = await app.handle(
      jsonReq("/api/quality-profiles", "POST", BASE_PROFILE),
    );
    expect(res.status).toBe(403);
  });
});
