import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, renderWithProviders } from "@/test-utils/render";
import { fireEvent } from "@testing-library/react";

// ── DnD-kit mocks ────────────────────────────────────────────────────────────
vi.mock("@dnd-kit/react", () => ({
  DragDropProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  PointerSensor: { configure: vi.fn().mockReturnValue({}) },
  KeyboardSensor: {},
  useDroppable: vi.fn().mockReturnValue({ ref: vi.fn() }),
}));
vi.mock("@dnd-kit/react/sortable", () => ({
  useSortable: vi
    .fn()
    .mockReturnValue({ ref: vi.fn(), handleRef: vi.fn(), isDragging: false }),
  isSortable: vi.fn().mockReturnValue(false),
}));
vi.mock("@dnd-kit/helpers", () => ({ move: vi.fn() }));
vi.mock("@dnd-kit/dom", () => ({
  PointerActivationConstraints: { Distance: vi.fn() },
}));

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

// ── Router mock ──────────────────────────────────────────────────────────────
vi.mock("@tanstack/react-router", () => ({
  useSearch: vi.fn().mockReturnValue({}),
  useNavigate: vi.fn().mockReturnValue(vi.fn()),
  useParams: vi.fn().mockReturnValue({}),
}));

// ── Hook mocks ───────────────────────────────────────────────────────────────
vi.mock("@/hooks/board/useBoardTasks", () => ({
  useBoardTasks: vi.fn(),
  useCreateBoardTask: vi
    .fn()
    .mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useUpdateBoardTask: vi.fn().mockReturnValue({ mutate: vi.fn() }),
  useDeleteBoardTask: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
  useSyncBoardTasks: vi
    .fn()
    .mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useSetBoardTaskArchived: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
  useArchivedBoardTasks: vi.fn().mockReturnValue({ data: { tasks: [] } }),
  useAddDependency: vi
    .fn()
    .mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useRemoveDependency: vi
    .fn()
    .mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useBoardTimeLogs: vi.fn().mockReturnValue({ data: { time_logs: [] } }),
  useLogTime: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useBoardTaskActivity: vi.fn().mockReturnValue({ data: { activities: [] } }),
  useCreateComment: vi
    .fn()
    .mockReturnValue({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/users/useUsers", () => ({
  useUsers: vi.fn().mockReturnValue({ data: { users: [] } }),
}));
vi.mock("@/hooks/board/useBoardTags", () => ({
  useBoardTags: vi.fn().mockReturnValue({ data: { tags: [] } }),
  useCreateBoardTag: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
  useUpdateBoardTag: vi
    .fn()
    .mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useDeleteBoardTag: vi
    .fn()
    .mockReturnValue({ mutate: vi.fn(), isPending: false }),
}));

import { useBoardTasks, useSyncBoardTasks } from "@/hooks/board/useBoardTasks";
import { BoardView } from "@/features/board/BoardView";
import type { BoardTask } from "@hously/shared/types";
const makeMockTask = (overrides: Partial<BoardTask> = {}): BoardTask =>
  ({
    id: 1,
    slug: "HSLY-001",
    title: "Fix login bug",
    description: null,
    status: "todo",
    position: 0,
    priority: "medium",
    start_date: null,
    due_date: null,
    assignee_id: null,
    assignee_name: null,
    assignee_avatar: null,
    tags: [],
    created_by: 1,
    created_by_username: "Alice",
    created_at: "2025-01-15T00:00:00Z",
    updated_at: "2025-01-15T00:00:00Z",
    estimated_minutes: null,
    logged_minutes: 0,
    archived: false,
    blocks: [],
    blocked_by: [],
    ...overrides,
  }) as BoardTask;

describe("BoardView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("switches to backlog view when Backlog tab is clicked", async () => {
    const tasks = [
      makeMockTask({ id: 1, status: "backlog", title: "Unplanned work" }),
    ];
    (useBoardTasks as any).mockReturnValue({
      data: { tasks },
      isLoading: false,
    });
    renderWithProviders(<BoardView />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Backlog/ }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Backlog/ }));

    await waitFor(() => {
      expect(screen.getByText("Unplanned work")).toBeInTheDocument();
      // Kanban columns should no longer be visible
      expect(screen.queryByText("board.status.todo")).not.toBeInTheDocument();
    });
  });

  it("filters tasks by priority in board view", async () => {
    const tasks = [
      makeMockTask({
        id: 1,
        title: "High task",
        priority: "high",
        status: "todo",
      }),
      makeMockTask({
        id: 2,
        title: "Low task",
        priority: "low",
        status: "todo",
      }),
    ];
    (useBoardTasks as any).mockReturnValue({
      data: { tasks },
      isLoading: false,
    });
    renderWithProviders(<BoardView />);

    // Open filters
    await waitFor(() => fireEvent.click(screen.getByText("Filters")));

    // Change priority filter to 'high'
    const prioritySelect = screen.getByDisplayValue("Any priority");
    fireEvent.change(prioritySelect, { target: { value: "high" } });

    await waitFor(() => {
      expect(screen.getByText("High task")).toBeInTheDocument();
      expect(screen.queryByText("Low task")).not.toBeInTheDocument();
    });
  });

  it("shows bulk action bar when selecting tasks via checkbox", async () => {
    const tasks = [
      makeMockTask({ id: 1, title: "Task A", status: "todo" }),
      makeMockTask({ id: 2, title: "Task B", status: "todo" }),
    ];
    (useBoardTasks as any).mockReturnValue({
      data: { tasks },
      isLoading: false,
    });
    renderWithProviders(<BoardView />);

    await waitFor(() => expect(screen.getByText("Task A")).toBeInTheDocument());
    fireEvent.click(
      screen.getAllByRole("checkbox", {
        name: /board\.bulk\.selectTask/i,
      })[0],
    );

    await waitFor(() => {
      expect(
        screen.getByRole("region", {
          name: /board\.bulk\.barLabel|bulk action/i,
        }),
      ).toBeInTheDocument();
    });
  });

  it("clears bulk selection when Clear is clicked", async () => {
    const task = makeMockTask({ id: 1, title: "Solo", status: "todo" });
    (useBoardTasks as any).mockReturnValue({
      data: { tasks: [task] },
      isLoading: false,
    });
    renderWithProviders(<BoardView />);

    await waitFor(() => expect(screen.getByText("Solo")).toBeInTheDocument());
    fireEvent.click(
      screen.getByRole("checkbox", { name: /board\.bulk\.selectTask/i }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("region", {
          name: /board\.bulk\.barLabel|bulk action/i,
        }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /board\.bulk\.clear|clear/i }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("region", {
          name: /board\.bulk\.barLabel|bulk action/i,
        }),
      ).not.toBeInTheDocument(),
    );
  });

  it("calls sync when moving selected tasks to another column", async () => {
    const syncMutate = vi.fn();
    (useSyncBoardTasks as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: syncMutate,
      isPending: false,
    });

    const tasks = [
      makeMockTask({ id: 1, title: "Move me", status: "todo", position: 0 }),
      makeMockTask({ id: 2, title: "Stay", status: "todo", position: 1 }),
    ];
    (useBoardTasks as any).mockReturnValue({
      data: { tasks },
      isLoading: false,
    });
    renderWithProviders(<BoardView />);

    await waitFor(() =>
      expect(screen.getByText("Move me")).toBeInTheDocument(),
    );
    fireEvent.click(
      screen.getAllByRole("checkbox", {
        name: /board\.bulk\.selectTask/i,
      })[0],
    );

    await waitFor(() =>
      expect(
        screen.getByRole("region", {
          name: /board\.bulk\.barLabel|bulk action/i,
        }),
      ).toBeInTheDocument(),
    );

    const moveSelect = screen.getByRole("combobox", {
      name: /board\.bulk\.moveToColumn|move to column/i,
    });
    fireEvent.change(moveSelect, { target: { value: "done" } });

    await waitFor(() => {
      expect(syncMutate).toHaveBeenCalled();
      const payload = syncMutate.mock.calls[0][0];
      expect(payload.tasks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 1, status: "done" }),
        ]),
      );
    });

    (useSyncBoardTasks as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });
});
