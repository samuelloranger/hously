import { describe, expect, it, beforeAll } from "bun:test";
import { app } from "../src/index";
import { prisma } from "../src/db";
import { hashPassword } from "../src/utils/password";

const hasDb = !!process.env.DATABASE_URL;

describe("Chores API", () => {
  const testEmail = "chores-test@example.com";
  const testPassword = "Password123!";
  let cookies = "";

  beforeAll(async () => {
    if (!hasDb) return;

    const existing = await prisma.user.findFirst({
      where: { email: testEmail },
    });
    if (!existing) {
      const pwdHash = await hashPassword(testPassword);
      await prisma.user.create({
        data: {
          email: testEmail,
          passwordHash: pwdHash,
          firstName: "Chores",
          lastName: "Test",
          isAdmin: true,
          createdAt: new Date(),
        },
      });
    }

    const response = await app.handle(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail, password: testPassword }),
      }),
    );
    cookies = response.headers.get("set-cookie") || "";
  });

  it("should return 401 when unauthenticated on GET /", async () => {
    if (!hasDb) return;
    const response = await app.handle(
      new Request("http://localhost/api/chores"),
    );
    expect(response.status).toBe(401);
  });

  it("should return chores list when authenticated", async () => {
    if (!hasDb) return;
    const response = await app.handle(
      new Request("http://localhost/api/chores", {
        headers: { Cookie: cookies },
      }),
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as any;
    expect(Array.isArray(json.chores)).toBe(true);
  });

  it("should return 401 when unauthenticated on POST /", async () => {
    if (!hasDb) return;
    const response = await app.handle(
      new Request("http://localhost/api/chores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chore_name: "Vacuum" }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("should create a chore", async () => {
    if (!hasDb) return;
    const response = await app.handle(
      new Request("http://localhost/api/chores", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookies },
        body: JSON.stringify({
          chore_name: "Test Chore",
          description: "Test description",
          reminder_enabled: false,
        }),
      }),
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as any;
    expect(json.success).toBe(true);
    expect(typeof json.id).toBe("number");
  });

  it("should toggle a chore completion", async () => {
    if (!hasDb) return;
    const createRes = await app.handle(
      new Request("http://localhost/api/chores", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookies },
        body: JSON.stringify({
          chore_name: "Toggle Test Chore",
          reminder_enabled: false,
        }),
      }),
    );
    const { id } = (await createRes.json()) as any;

    const response = await app.handle(
      new Request(`http://localhost/api/chores/${id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookies },
        body: JSON.stringify({}),
      }),
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as any;
    expect(json.success).toBe(true);
  });

  it("should delete a chore", async () => {
    if (!hasDb) return;
    const createRes = await app.handle(
      new Request("http://localhost/api/chores", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookies },
        body: JSON.stringify({
          chore_name: "Delete Me Chore",
          reminder_enabled: false,
        }),
      }),
    );
    const { id } = (await createRes.json()) as any;

    const response = await app.handle(
      new Request(`http://localhost/api/chores/${id}`, {
        method: "DELETE",
        headers: { Cookie: cookies },
      }),
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as any;
    expect(json.success).toBe(true);
  });

  it("should return 404 for non-existent chore on toggle", async () => {
    if (!hasDb) return;
    const response = await app.handle(
      new Request("http://localhost/api/chores/999999/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookies },
        body: JSON.stringify({}),
      }),
    );
    expect(response.status).toBe(404);
  });

  it("should clear completed chores", async () => {
    if (!hasDb) return;
    const response = await app.handle(
      new Request("http://localhost/api/chores/clear-completed", {
        method: "POST",
        headers: { Cookie: cookies },
      }),
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as any;
    expect(json.success).toBe(true);
    expect(typeof json.count).toBe("number");
  });

  it("should reorder chores", async () => {
    if (!hasDb) return;
    const r1 = await app.handle(
      new Request("http://localhost/api/chores", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookies },
        body: JSON.stringify({
          chore_name: "Reorder Chore A",
          reminder_enabled: false,
        }),
      }),
    );
    const r2 = await app.handle(
      new Request("http://localhost/api/chores", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookies },
        body: JSON.stringify({
          chore_name: "Reorder Chore B",
          reminder_enabled: false,
        }),
      }),
    );
    const { id: id1 } = (await r1.json()) as any;
    const { id: id2 } = (await r2.json()) as any;

    const response = await app.handle(
      new Request("http://localhost/api/chores/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookies },
        body: JSON.stringify({ chore_ids: [id2, id1] }),
      }),
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as any;
    expect(json.success).toBe(true);
  });
});
