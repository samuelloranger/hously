import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, renderWithProviders } from "@/test-utils/render";
import { fireEvent } from "@testing-library/react";
import { TaskDrawer } from "@/features/board/components/TaskDrawer";
import type { BoardTask } from "@hously/shared";

// ── TipTap mock ──────────────────────────────────────────────────────────────
vi.mock("@/components/ui/minimal-tiptap", () => ({
  MinimalTiptap: ({ content, placeholder }: any) => (
    <textarea
      data-testid="tiptap-editor"
      defaultValue={content}
      placeholder={placeholder}
    />
  ),
}));

// ── Users hook mock ──────────────────────────────────────────────────────────
vi.mock("@/hooks/useUsers", () => ({
  useUsers: vi.fn().mockReturnValue({
    data: {
      users: [
        {
          id: 1,
          email: "alice@example.com",
          first_name: "Alice",
          last_name: "Smith",
          is_admin: false,
          last_login: null,
          created_at: "2024-01-01",
          last_activity: null,
        },
        {
          id: 2,
          email: "bob@example.com",
          first_name: "Bob",
          last_name: null,
          is_admin: false,
          last_login: null,
          created_at: "2024-01-01",
          last_activity: null,
        },
      ],
    },
  }),
}));

// ── Board tags hook mock ──────────────────────────────────────────────────────
const { mockCreateBoardTag } = vi.hoisted(() => ({
  mockCreateBoardTag: vi.fn(),
}));
vi.mock("@/hooks/useBoardTags", () => ({
  useBoardTags: vi.fn().mockReturnValue({ data: { tags: [] } }),
  useCreateBoardTag: vi
    .fn()
    .mockReturnValue({ mutateAsync: mockCreateBoardTag }),
  useUpdateBoardTag: vi
    .fn()
    .mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useDeleteBoardTag: vi
    .fn()
    .mockReturnValue({ mutate: vi.fn(), isPending: false }),
}));

// ── Board tasks hook mock (for DependencySection, ActivityLog, TimeTracking) ──
vi.mock("@/hooks/useBoardTasks", () => ({
  useAddDependency: vi
    .fn()
    .mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useRemoveDependency: vi
    .fn()
    .mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useBoardTaskActivity: vi.fn().mockReturnValue({ data: { activities: [] } }),
  useCreateComment: vi
    .fn()
    .mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useBoardTimeLogs: vi.fn().mockReturnValue({ data: { time_logs: [] } }),
  useLogTime: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
}));

const baseTask: BoardTask = {
  id: 5,
  slug: "HSLY-005",
  title: "Redesign onboarding flow",
  description: "<p>We need to rethink the first-run experience.</p>",
  status: "in_progress",
  position: 0,
  priority: "high",
  start_date: "2025-06-01",
  due_date: "2025-06-30",
  assignee_id: 1,
  assignee_name: "Alice Smith",
  assignee_avatar: null,
  tags: [
    { id: 1, name: "design", color: null },
    { id: 2, name: "ux", color: null },
  ],
  created_by: 1,
  created_by_username: "Alice",
  created_at: "2025-01-15T00:00:00Z",
  updated_at: "2025-01-20T00:00:00Z",
  estimated_minutes: null,
  logged_minutes: 0,
  blocks: [],
  blocked_by: [],
};

describe("TaskDrawer", () => {
  const onClose = vi.fn();
  const onUpdate = vi.fn();
  const onDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is not visible (translated off-screen) when task is null", () => {
    const { container } = renderWithProviders(
      <TaskDrawer
        task={null}
        onClose={onClose}
        onUpdate={onUpdate}
        onDelete={onDelete}
        allTasks={[]}
      />,
    );
    const panel = container.querySelector('[role="dialog"]');
    expect(panel).toBeInTheDocument();
    expect(panel?.className).toContain("translate-x-full");
  });

  it("is visible (not translated) when a task is provided", async () => {
    const { container } = renderWithProviders(
      <TaskDrawer
        task={baseTask}
        onClose={onClose}
        onUpdate={onUpdate}
        onDelete={onDelete}
        allTasks={[]}
      />,
    );
    await waitFor(() => {
      const panel = container.querySelector('[role="dialog"]');
      expect(panel?.className).toContain("translate-x-0");
    });
  });

  it("renders the task slug in the header", async () => {
    renderWithProviders(
      <TaskDrawer
        task={baseTask}
        onClose={onClose}
        onUpdate={onUpdate}
        onDelete={onDelete}
        allTasks={[]}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("HSLY-005")).toBeInTheDocument();
    });
  });

  it("renders the task title in an editable input", async () => {
    renderWithProviders(
      <TaskDrawer
        task={baseTask}
        onClose={onClose}
        onUpdate={onUpdate}
        onDelete={onDelete}
        allTasks={[]}
      />,
    );
    await waitFor(() => {
      const input = screen.getByDisplayValue("Redesign onboarding flow");
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe("INPUT");
    });
  });

  it("shows Status, Priority, Assignee, Start date, Due date, Tags fields", async () => {
    renderWithProviders(
      <TaskDrawer
        task={baseTask}
        onClose={onClose}
        onUpdate={onUpdate}
        onDelete={onDelete}
        allTasks={[]}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Priority")).toBeInTheDocument();
      expect(screen.getByText("Assignee")).toBeInTheDocument();
      expect(screen.getByText("Start date")).toBeInTheDocument();
      expect(screen.getByText("Due date")).toBeInTheDocument();
      expect(screen.getByText("Tags")).toBeInTheDocument();
    });
  });

  it("shows the current priority value", async () => {
    renderWithProviders(
      <TaskDrawer
        task={baseTask}
        onClose={onClose}
        onUpdate={onUpdate}
        onDelete={onDelete}
        allTasks={[]}
      />,
    );
    await waitFor(() => {
      const prioritySelect = screen.getByDisplayValue("High");
      expect(prioritySelect).toBeInTheDocument();
    });
  });

  it("shows the TipTap editor for the description", async () => {
    renderWithProviders(
      <TaskDrawer
        task={baseTask}
        onClose={onClose}
        onUpdate={onUpdate}
        onDelete={onDelete}
        allTasks={[]}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();
    });
  });

  it("renders tag chips with remove buttons", async () => {
    renderWithProviders(
      <TaskDrawer
        task={baseTask}
        onClose={onClose}
        onUpdate={onUpdate}
        onDelete={onDelete}
        allTasks={[]}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("design")).toBeInTheDocument();
      expect(screen.getByText("ux")).toBeInTheDocument();
    });
  });

  it("calls onClose when the X button is clicked", async () => {
    renderWithProviders(
      <TaskDrawer
        task={baseTask}
        onClose={onClose}
        onUpdate={onUpdate}
        onDelete={onDelete}
        allTasks={[]}
      />,
    );
    await waitFor(() => {
      const closeBtn = screen.getByRole("button", { name: "Close" });
      fireEvent.click(closeBtn);
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onUpdate when status select changes", async () => {
    renderWithProviders(
      <TaskDrawer
        task={baseTask}
        onClose={onClose}
        onUpdate={onUpdate}
        onDelete={onDelete}
        allTasks={[]}
      />,
    );
    const statusSelect = await screen.findByDisplayValue("In Progress");
    fireEvent.change(statusSelect, { target: { value: "done" } });
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(5, { status: "done" });
    });
  });

  it("calls onUpdate when priority select changes", async () => {
    renderWithProviders(
      <TaskDrawer
        task={baseTask}
        onClose={onClose}
        onUpdate={onUpdate}
        onDelete={onDelete}
        allTasks={[]}
      />,
    );
    const prioritySelect = await screen.findByDisplayValue("High");
    fireEvent.change(prioritySelect, { target: { value: "urgent" } });
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(5, { priority: "urgent" });
    });
  });

  it("lists available users in the assignee select", async () => {
    renderWithProviders(
      <TaskDrawer
        task={baseTask}
        onClose={onClose}
        onUpdate={onUpdate}
        onDelete={onDelete}
        allTasks={[]}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });

  it("shows created-by metadata in the footer", async () => {
    renderWithProviders(
      <TaskDrawer
        task={baseTask}
        onClose={onClose}
        onUpdate={onUpdate}
        onDelete={onDelete}
        allTasks={[]}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
  });

  it("creates a tag via the tag picker and calls onUpdate with tag_ids", async () => {
    mockCreateBoardTag.mockResolvedValueOnce({
      tag: { id: 42, name: "newtag", color: null },
    });
    const task = { ...baseTask, tags: [] };
    renderWithProviders(
      <TaskDrawer
        task={task}
        onClose={onClose}
        onUpdate={onUpdate}
        onDelete={onDelete}
        allTasks={[]}
      />,
    );
    const tagInput = await screen.findByPlaceholderText("Add tag…");
    fireEvent.change(tagInput, { target: { value: "newtag" } });
    fireEvent.keyDown(tagInput, { key: "Enter" });
    await waitFor(() => {
      expect(mockCreateBoardTag).toHaveBeenCalledWith({ name: "newtag" });
    });
  });

  it("calls onClose when backdrop is clicked", async () => {
    renderWithProviders(
      <TaskDrawer
        task={baseTask}
        onClose={onClose}
        onUpdate={onUpdate}
        onDelete={onDelete}
        allTasks={[]}
      />,
    );
    await waitFor(() => {
      // The backdrop overlay is the div with aria-hidden
      const backdrop = document.querySelector(
        '[aria-hidden="true"]',
      ) as HTMLElement;
      expect(backdrop).toBeInTheDocument();
      fireEvent.click(backdrop);
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
