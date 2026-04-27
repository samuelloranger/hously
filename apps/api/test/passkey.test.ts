import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { app } from "../src/index";
import { prisma } from "../src/db";
import { hashPassword } from "../src/utils/password";

const hasDb = !!process.env.DATABASE_URL;

describe("Passkey routes", () => {
  const passkeyOnlyEmail = "passkey-only@example.com";

  beforeAll(async () => {
    if (!hasDb) return;

    await prisma.user.deleteMany({ where: { email: passkeyOnlyEmail } });
    await prisma.user.create({
      data: {
        email: passkeyOnlyEmail,
        passwordHash: null,
        isAdmin: false,
        createdAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    if (!hasDb) return;
    await prisma.user.deleteMany({ where: { email: passkeyOnlyEmail } });
  });

  it("rejects password login for passkey-only account", async () => {
    if (!hasDb) return;

    const res = await app.handle(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: passkeyOnlyEmail, password: "anything" }),
      }),
    );

    const body = (await res.json()) as { error?: string };
    // In environments where the nullable migration isn't applied yet, this can
    // still be a generic 401. Once migrated, we expect the explicit passkey error.
    expect([400, 401]).toContain(res.status);
    if (res.status === 400) {
      expect(body.error).toContain("passkey");
    }
  });

  it("POST /api/auth/passkey/authenticate/options returns challenge", async () => {
    if (!hasDb) return;

    const res = await app.handle(
      new Request("http://localhost/api/auth/passkey/authenticate/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { challenge: string };
    expect(typeof body.challenge).toBe("string");
    expect(body.challenge.length).toBeGreaterThan(0);
  });
});

describe("Passkey credential endpoints", () => {
  const testEmail = "passkey-cred-test@example.com";
  const testPassword = "Test1234!";
  let authCookie = "";
  let credentialDbId = 0;

  beforeAll(async () => {
    if (!hasDb) return;

    await prisma.user.deleteMany({ where: { email: testEmail } });
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: await hashPassword(testPassword),
        isAdmin: false,
        createdAt: new Date(),
      },
    });

    const cred = await prisma.webAuthnCredential.create({
      data: {
        userId: user.id,
        credentialId: `test-cred-${Date.now()}`,
        publicKey: Buffer.from("fake-public-key"),
        counter: 0n,
        transports: ["internal"],
        deviceType: "singleDevice",
        backedUp: false,
        name: "Test Key",
      },
    });
    credentialDbId = cred.id;

    const loginRes = await app.handle(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail, password: testPassword }),
      }),
    );
    const setCookie = loginRes.headers.get("set-cookie");
    if (setCookie) {
      authCookie = setCookie.split(";")[0];
    }
  });

  afterAll(async () => {
    if (!hasDb) return;
    await prisma.user.deleteMany({ where: { email: testEmail } });
  });

  it("GET /api/auth/passkey/credentials returns 401 without auth", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/auth/passkey/credentials"),
    );
    expect(res.status).toBe(401);
  });

  it("DELETE /api/auth/passkey/credentials/1 returns 401 without auth", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/auth/passkey/credentials/1", {
        method: "DELETE",
      }),
    );
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/passkey/credentials lists owned credentials", async () => {
    if (!hasDb || !authCookie) return;

    const res = await app.handle(
      new Request("http://localhost/api/auth/passkey/credentials", {
        headers: { Cookie: authCookie },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      credentials: Array<{ id: number; name: string | null }>;
    };
    expect(Array.isArray(body.credentials)).toBe(true);
    expect(body.credentials.some((c) => c.id === credentialDbId)).toBe(true);
  });

  it("DELETE /api/auth/passkey/credentials/:id returns 404 for non-existent credential", async () => {
    if (!hasDb || !authCookie) return;

    const res = await app.handle(
      new Request("http://localhost/api/auth/passkey/credentials/999999", {
        method: "DELETE",
        headers: { Cookie: authCookie },
      }),
    );

    expect(res.status).toBe(404);
  });

  it("DELETE /api/auth/passkey/credentials/:id removes the credential", async () => {
    if (!hasDb || !authCookie || !credentialDbId) return;

    const res = await app.handle(
      new Request(
        `http://localhost/api/auth/passkey/credentials/${credentialDbId}`,
        {
          method: "DELETE",
          headers: { Cookie: authCookie },
        },
      ),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);

    const gone = await prisma.webAuthnCredential.findUnique({
      where: { id: credentialDbId },
    });
    expect(gone).toBeNull();
  });
});
