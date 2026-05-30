/**
 * Integration tests for /api/custom-formats.
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
  // auth plugin used in customFormatsRoutes — must be a valid Elysia plugin fn
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
const { customFormatsRoutes } = await import("./index");

const app = new Elysia().use(customFormatsRoutes);

// ── Helpers ───────────────────────────────────────────────────────────────────
const VALID_CONDITION = { type: "source", operator: "equals", value: "WEB-DL" };
const ADMIN: FakeUser = { id: "admin", is_admin: true, email: "admin@test.local" };

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

async function createFormat(name: string) {
  const res = await app.handle(
    jsonReq("/api/custom-formats", "POST", {
      name,
      conditions: [VALID_CONDITION],
    }),
  );
  return ((await res.json()) as any).custom_format as { id: number; name: string };
}

// ── Suite ─────────────────────────────────────────────────────────────────────
describe("Custom Formats API", () => {
  beforeEach(async () => {
    injectedUser = ADMIN;
    if (!hasDb || !realPrisma) return;
    await realPrisma.customFormat.deleteMany({});
  });

  afterEach(async () => {
    if (!hasDb || !realPrisma) return;
    await realPrisma.customFormat.deleteMany({});
  });

  it("POST valid → 201 returns id and snake_case fields", async () => {
    if (!hasDb) return;
    const res = await app.handle(
      jsonReq("/api/custom-formats", "POST", {
        name: "WEB-DL",
        conditions: [VALID_CONDITION],
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(typeof body.custom_format.id).toBe("number");
    expect(body.custom_format.name).toBe("WEB-DL");
    expect(Array.isArray(body.custom_format.conditions)).toBe(true);
    expect(typeof body.custom_format.created_at).toBe("string");
    expect(typeof body.custom_format.updated_at).toBe("string");
  });

  it("GET / lists formats ordered by name asc", async () => {
    if (!hasDb) return;
    await createFormat("Zebra");
    await createFormat("Alpha");

    const res = await app.handle(req("/api/custom-formats"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(Array.isArray(body.custom_formats)).toBe(true);
    expect(body.custom_formats.length).toBe(2);
    expect(body.custom_formats[0].name).toBe("Alpha");
    expect(body.custom_formats[1].name).toBe("Zebra");
  });

  it("GET :id returns the format", async () => {
    if (!hasDb) return;
    const created = await createFormat("HDR");

    const res = await app.handle(req(`/api/custom-formats/${created.id}`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.custom_format.name).toBe("HDR");
  });

  it("PUT :id renames format → 200", async () => {
    if (!hasDb) return;
    const created = await createFormat("Original");

    const res = await app.handle(
      jsonReq(`/api/custom-formats/${created.id}`, "PUT", {
        name: "Renamed",
        conditions: [VALID_CONDITION],
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.custom_format.name).toBe("Renamed");
  });

  it("DELETE :id → { deleted: true }", async () => {
    if (!hasDb) return;
    const created = await createFormat("ToDelete");

    const res = await app.handle(
      req(`/api/custom-formats/${created.id}`, { method: "DELETE" }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.deleted).toBe(true);
  });

  it("GET :id after DELETE → 404", async () => {
    if (!hasDb) return;
    const created = await createFormat("Ghost");
    await app.handle(
      req(`/api/custom-formats/${created.id}`, { method: "DELETE" }),
    );

    const res = await app.handle(req(`/api/custom-formats/${created.id}`));
    expect(res.status).toBe(404);
  });

  it("POST with operator_invalid_for_type → 400 with code", async () => {
    if (!hasDb) return;
    const res = await app.handle(
      jsonReq("/api/custom-formats", "POST", {
        name: "Bad",
        conditions: [{ type: "source", operator: "matches", value: "x" }],
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe("operator_invalid_for_type");
  });

  it("returns 401 when unauthenticated", async () => {
    if (!hasDb) return;
    injectedUser = null;
    const res = await app.handle(req("/api/custom-formats"));
    expect(res.status).toBe(401);
  });

  it("POST returns 403 when non-admin", async () => {
    if (!hasDb) return;
    injectedUser = { id: "user1", is_admin: false, email: "user@test.local" };
    const res = await app.handle(
      jsonReq("/api/custom-formats", "POST", {
        name: "Nope",
        conditions: [VALID_CONDITION],
      }),
    );
    expect(res.status).toBe(403);
  });

  it("POST duplicate name → 409", async () => {
    if (!hasDb) return;
    await createFormat("Dup");
    const res = await app.handle(
      jsonReq("/api/custom-formats", "POST", {
        name: "Dup",
        conditions: [VALID_CONDITION],
      }),
    );
    expect(res.status).toBe(409);
  });
});
