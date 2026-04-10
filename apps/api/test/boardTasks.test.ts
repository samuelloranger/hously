import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { app } from "../src/index";
import { prisma } from "../src/db";
import { hashPassword } from "../src/utils/password";

const hasDb = !!process.env.DATABASE_URL;

describe("Board Tasks API", () => {
  const testEmail = "board-tasks-test@example.com";
  const testPassword = "Password123!";
  let cookies = "";
  let userId = 0;
  const createdIds: number[] = [];

  async function req(path: string, init?: RequestInit) {
    return app.handle(new Request(`http://localhost${path}`, init));
  }

  async function authed(path: string, init?: RequestInit) {
    return req(path, {
      ...init,
      headers: {
        Cookie: cookies,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  }

  async function createTask(overrides: Record<string, unknown> = {}) {
    const res = await authed("/api/board-tasks", {
      method: "POST",
      body: JSON.stringify({ title: "Test task", ...overrides }),
    });
    const json = (await res.json()) as any;
    if (json.task?.id) createdIds.push(json.task.id);
    return { res, json };
  }

  beforeAll(async () => {
    if (!hasDb) return;

    const existing = await prisma.user.findFirst({
      where: { email: testEmail },
    });
    if (!existing) {
      const pwdHash = await hashPassword(testPassword);
      const created = await prisma.user.create({
        data: {
          email: testEmail,
          passwordHash: pwdHash,
          firstName: "Board",
          lastName: "Test",
          isAdmin: false,
          createdAt: new Date(),
        },
      });
      userId = created.id;
    } else {
      userId = existing.id;
    }

    const loginRes = await req("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    cookies = loginRes.headers.get("set-cookie") || "";
  });

  afterAll(async () => {
    if (!hasDb) return;
    // Clean up tasks created during tests
    if (createdIds.length > 0) {
      await prisma.boardTask.deleteMany({ where: { id: { in: createdIds } } });
    }
  });

  // ── Auth guards ─────────────────────────────────────────────────────────────

  it("GET /api/board-tasks returns 401 when unauthenticated", async () => {
    if (!hasDb) return;
    const res = await req("/api/board-tasks");
    expect(res.status).toBe(401);
  });

  it("POST /api/board-tasks returns 401 when unauthenticated", async () => {
    if (!hasDb) return;
    const res = await req("/api/board-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Sneaky task" }),
    });
    expect(res.status).toBe(401);
  });

  // ── List ─────────────────────────────────────────────────────────────────────

  it("GET /api/board-tasks returns task list", async () => {
    if (!hasDb) return;
    const res = await authed("/api/board-tasks");
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(Array.isArray(json.tasks)).toBe(true);
  });

  // ── Create ───────────────────────────────────────────────────────────────────

  it("creates a minimal task with title only", async () => {
    if (!hasDb) return;
    const { res, json } = await createTask({ title: "Minimal task" });
    expect(res.status).toBe(200);
    expect(json.task).toBeDefined();
    expect(json.task.title).toBe("Minimal task");
    expect(json.task.status).toBe("todo"); // default
    expect(json.task.priority).toBe("medium"); // default
    expect(Array.isArray(json.task.tags)).toBe(true);
    expect(json.task.tags.length).toBe(0);
  });

  it("task slug has HSLY-XXX format", async () => {
    if (!hasDb) return;
    const { json } = await createTask({ title: "Slug test" });
    expect(json.task.slug).toMatch(/^HSLY-\d+$/);
  });

  it("creates a task with all new fields", async () => {
    if (!hasDb) return;
    const { res, json } = await createTask({
      title: "Full task",
      description: "A detailed description",
      status: "in_progress",
      priority: "high",
      start_date: "2025-06-01",
      due_date: "2025-06-30",
      tags: ["feature", "frontend"],
    });
    expect(res.status).toBe(200);
    const t = json.task;
    expect(t.status).toBe("in_progress");
    expect(t.priority).toBe("high");
    expect(t.start_date).toBe("2025-06-01");
    expect(t.due_date).toBe("2025-06-30");
    expect(t.tags).toEqual(["feature", "frontend"]);
    expect(t.description).toBe("A detailed description");
  });

  it("creates a task with backlog status", async () => {
    if (!hasDb) return;
    const { res, json } = await createTask({
      title: "Backlog task",
      status: "backlog",
    });
    expect(res.status).toBe(200);
    expect(json.task.status).toBe("backlog");
  });

  it("creates a task with urgent priority", async () => {
    if (!hasDb) return;
    const { res, json } = await createTask({
      title: "Urgent task",
      priority: "urgent",
    });
    expect(res.status).toBe(200);
    expect(json.task.priority).toBe("urgent");
  });

  it("returns 400 when title is missing", async () => {
    if (!hasDb) return;
    const res = await authed("/api/board-tasks", {
      method: "POST",
      body: JSON.stringify({ title: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("creates a task with assignee_id", async () => {
    if (!hasDb) return;
    const { res, json } = await createTask({
      title: "Assigned task",
      assignee_id: userId,
    });
    expect(res.status).toBe(200);
    expect(json.task.assignee_id).toBe(userId);
    expect(json.task.assignee_name).toBeTruthy();
  });

  // ── Update ───────────────────────────────────────────────────────────────────

  it("updates a task title", async () => {
    if (!hasDb) return;
    const { json: created } = await createTask({ title: "Old title" });
    const id = created.task.id;

    const res = await authed(`/api/board-tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "New title" }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.task.title).toBe("New title");
  });

  it("updates a task status", async () => {
    if (!hasDb) return;
    const { json: created } = await createTask({
      title: "Status update test",
      status: "todo",
    });
    const id = created.task.id;

    const res = await authed(`/api/board-tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "done" }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.task.status).toBe("done");
  });

  it("updates task priority", async () => {
    if (!hasDb) return;
    const { json: created } = await createTask({
      title: "Priority update",
      priority: "low",
    });
    const id = created.task.id;

    const res = await authed(`/api/board-tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ priority: "urgent" }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.task.priority).toBe("urgent");
  });

  it("updates task due date", async () => {
    if (!hasDb) return;
    const { json: created } = await createTask({ title: "Due date test" });
    const id = created.task.id;

    const res = await authed(`/api/board-tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ due_date: "2025-12-31" }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.task.due_date).toBe("2025-12-31");
  });

  it("clears task due date with null", async () => {
    if (!hasDb) return;
    const { json: created } = await createTask({
      title: "Clear date",
      due_date: "2025-12-31",
    });
    const id = created.task.id;

    const res = await authed(`/api/board-tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ due_date: null }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.task.due_date).toBeNull();
  });

  it("updates task tags", async () => {
    if (!hasDb) return;
    const { json: created } = await createTask({
      title: "Tag update",
      tags: ["old"],
    });
    const id = created.task.id;

    const res = await authed(`/api/board-tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ tags: ["new", "updated"] }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.task.tags).toEqual(["new", "updated"]);
  });

  it("updates task assignee", async () => {
    if (!hasDb) return;
    const { json: created } = await createTask({ title: "Assignee update" });
    const id = created.task.id;

    const res = await authed(`/api/board-tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ assignee_id: userId }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.task.assignee_id).toBe(userId);
  });

  it("clears task assignee with null", async () => {
    if (!hasDb) return;
    const { json: created } = await createTask({
      title: "Clear assignee",
      assignee_id: userId,
    });
    const id = created.task.id;

    const res = await authed(`/api/board-tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ assignee_id: null }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.task.assignee_id).toBeNull();
  });

  it("returns 404 when updating non-existent task", async () => {
    if (!hasDb) return;
    const res = await authed("/api/board-tasks/999999", {
      method: "PATCH",
      body: JSON.stringify({ title: "Ghost" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 when updating with empty title", async () => {
    if (!hasDb) return;
    const { json: created } = await createTask({ title: "Non-empty" });
    const id = created.task.id;

    const res = await authed(`/api/board-tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "" }),
    });
    expect(res.status).toBe(400);
  });

  // ── Delete ───────────────────────────────────────────────────────────────────

  it("deletes a task", async () => {
    if (!hasDb) return;
    const { json: created } = await createTask({ title: "Delete me" });
    const id = created.task.id;
    // Remove from cleanup list since we're deleting manually
    const idx = createdIds.indexOf(id);
    if (idx !== -1) createdIds.splice(idx, 1);

    const res = await authed(`/api/board-tasks/${id}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);

    // Confirm it's gone
    const getRes = await authed(`/api/board-tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "Phantom" }),
    });
    expect(getRes.status).toBe(404);
  });

  it("returns 404 when deleting non-existent task", async () => {
    if (!hasDb) return;
    const res = await authed("/api/board-tasks/999999", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  // ── Sync ─────────────────────────────────────────────────────────────────────

  it("syncs task positions and statuses", async () => {
    if (!hasDb) return;
    const { json: a } = await createTask({ title: "Sync A", status: "todo" });
    const { json: b } = await createTask({ title: "Sync B", status: "todo" });

    const res = await authed("/api/board-tasks/sync", {
      method: "POST",
      body: JSON.stringify({
        tasks: [
          { id: a.task.id, status: "in_progress", position: 0 },
          { id: b.task.id, status: "done", position: 0 },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);

    // Verify new statuses
    const listRes = await authed("/api/board-tasks");
    const { tasks } = (await listRes.json()) as any;
    const updatedA = tasks.find((t: any) => t.id === a.task.id);
    const updatedB = tasks.find((t: any) => t.id === b.task.id);
    expect(updatedA.status).toBe("in_progress");
    expect(updatedB.status).toBe("done");
  });

  it("returns 400 for sync with invalid task ids", async () => {
    if (!hasDb) return;
    const res = await authed("/api/board-tasks/sync", {
      method: "POST",
      body: JSON.stringify({
        tasks: [{ id: 999999, status: "todo", position: 0 }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for sync with empty array", async () => {
    if (!hasDb) return;
    const res = await authed("/api/board-tasks/sync", {
      method: "POST",
      body: JSON.stringify({ tasks: [] }),
    });
    expect(res.status).toBe(400);
  });

  // ── List verifies new fields are returned ────────────────────────────────────

  it("list returns slug, priority, dates, tags, and assignee fields", async () => {
    if (!hasDb) return;
    await createTask({
      title: "Field check task",
      priority: "high",
      due_date: "2025-09-01",
      tags: ["check"],
      assignee_id: userId,
    });

    const res = await authed("/api/board-tasks");
    const { tasks } = (await res.json()) as any;
    const task = tasks.find((t: any) => t.title === "Field check task");
    expect(task).toBeDefined();
    expect(task.slug).toMatch(/^HSLY-\d+$/);
    expect(task.priority).toBe("high");
    expect(task.due_date).toBe("2025-09-01");
    expect(task.tags).toContain("check");
    expect(task.assignee_id).toBe(userId);
    expect(task.assignee_name).toBeTruthy();
    expect("start_date" in task).toBe(true);
    expect("assignee_avatar" in task).toBe(true);
  });
});
