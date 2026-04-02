import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, renderWithProviders } from '@/test-utils/render';
import { fireEvent } from '@testing-library/react';

// ── DnD-kit mocks ────────────────────────────────────────────────────────────
vi.mock('@dnd-kit/react', () => ({
  DragDropProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PointerSensor: { configure: vi.fn().mockReturnValue({}) },
  KeyboardSensor: {},
  useDroppable: vi.fn().mockReturnValue({ ref: vi.fn() }),
}));
vi.mock('@dnd-kit/react/sortable', () => ({
  useSortable: vi.fn().mockReturnValue({ ref: vi.fn(), handleRef: vi.fn(), isDragging: false }),
  isSortable: vi.fn().mockReturnValue(false),
}));
vi.mock('@dnd-kit/helpers', () => ({ move: vi.fn() }));
vi.mock('@dnd-kit/dom', () => ({
  PointerActivationConstraints: { Distance: vi.fn() },
}));

// ── TipTap mock ──────────────────────────────────────────────────────────────
vi.mock('@/components/ui/minimal-tiptap', () => ({
  MinimalTiptap: ({ content, placeholder }: any) => (
    <textarea data-testid="tiptap-editor" defaultValue={content} placeholder={placeholder} />
  ),
}));

// ── Router mock ──────────────────────────────────────────────────────────────
vi.mock('@tanstack/react-router', () => ({
  useSearch: vi.fn().mockReturnValue({}),
  useNavigate: vi.fn().mockReturnValue(vi.fn()),
  useParams: vi.fn().mockReturnValue({}),
}));

// ── Hook mocks ───────────────────────────────────────────────────────────────
vi.mock('@/hooks/useBoardTasks', () => ({
  useBoardTasks: vi.fn(),
  useCreateBoardTask: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useUpdateBoardTask: vi.fn().mockReturnValue({ mutate: vi.fn() }),
  useDeleteBoardTask: vi.fn().mockReturnValue({ mutate: vi.fn() }),
  useSyncBoardTasks: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useUsers', () => ({
  useUsers: vi.fn().mockReturnValue({ data: { users: [] } }),
}));

import { useBoardTasks } from '@/hooks/useBoardTasks';
import { BoardView } from '@/features/board/BoardView';
import type { BoardTask } from '@hously/shared';

const makeMockTask = (overrides: Partial<BoardTask> = {}): BoardTask => ({
  id: 1,
  slug: 'HSLY-001',
  title: 'Fix login bug',
  description: null,
  status: 'todo',
  position: 0,
  priority: 'medium',
  start_date: null,
  due_date: null,
  assignee_id: null,
  assignee_name: null,
  assignee_avatar: null,
  tags: [],
  created_by: 1,
  created_by_username: 'Alice',
  created_at: '2025-01-15T00:00:00Z',
  updated_at: '2025-01-15T00:00:00Z',
  ...overrides,
});

describe('BoardView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a loading spinner while data is fetching', async () => {
    (useBoardTasks as any).mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<BoardView />);
    expect(screen.queryByRole('button', { name: /Board/ })).not.toBeInTheDocument();
  });

  it('renders all four kanban column headings', async () => {
    (useBoardTasks as any).mockReturnValue({ data: { tasks: [] }, isLoading: false });
    renderWithProviders(<BoardView />);
    await waitFor(() => {
      expect(screen.getByText('board.status.on_hold')).toBeInTheDocument();
      expect(screen.getByText('board.status.todo')).toBeInTheDocument();
      expect(screen.getByText('board.status.in_progress')).toBeInTheDocument();
      expect(screen.getByText('board.status.done')).toBeInTheDocument();
    });
  });

  it('renders a task card in the correct column', async () => {
    const task = makeMockTask({ title: 'Fix login bug', status: 'todo' });
    (useBoardTasks as any).mockReturnValue({ data: { tasks: [task] }, isLoading: false });
    renderWithProviders(<BoardView />);
    await waitFor(() => {
      expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    });
  });

  it('displays the task slug on the card', async () => {
    const task = makeMockTask({ slug: 'HSLY-042', status: 'in_progress' });
    (useBoardTasks as any).mockReturnValue({ data: { tasks: [task] }, isLoading: false });
    renderWithProviders(<BoardView />);
    await waitFor(() => {
      expect(screen.getByText('HSLY-042')).toBeInTheDocument();
    });
  });

  it('shows backlog tab with task count badge', async () => {
    const tasks = [
      makeMockTask({ id: 1, status: 'backlog', title: 'Backlog item 1' }),
      makeMockTask({ id: 2, status: 'backlog', title: 'Backlog item 2' }),
      makeMockTask({ id: 3, status: 'todo', title: 'In todo' }),
    ];
    (useBoardTasks as any).mockReturnValue({ data: { tasks }, isLoading: false });
    renderWithProviders(<BoardView />);
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument(); // backlog count badge
    });
  });

  it('switches to backlog view when Backlog tab is clicked', async () => {
    const tasks = [
      makeMockTask({ id: 1, status: 'backlog', title: 'Unplanned work' }),
    ];
    (useBoardTasks as any).mockReturnValue({ data: { tasks }, isLoading: false });
    renderWithProviders(<BoardView />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Backlog/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Backlog/ }));

    await waitFor(() => {
      expect(screen.getByText('Unplanned work')).toBeInTheDocument();
      // Kanban columns should no longer be visible
      expect(screen.queryByText('board.status.todo')).not.toBeInTheDocument();
    });
  });

  it('shows filter bar when Filters button is clicked', async () => {
    (useBoardTasks as any).mockReturnValue({ data: { tasks: [] }, isLoading: false });
    renderWithProviders(<BoardView />);

    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Filters'));

    await waitFor(() => {
      expect(screen.getByText('Priority:')).toBeInTheDocument();
      expect(screen.getByText('Due date:')).toBeInTheDocument();
    });
  });

  it('opens new task form when New task button is clicked', async () => {
    (useBoardTasks as any).mockReturnValue({ data: { tasks: [] }, isLoading: false });
    renderWithProviders(<BoardView />);

    await waitFor(() => {
      expect(screen.getByText('New task')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('New task'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('board.newTaskPlaceholder')).toBeInTheDocument();
    });
  });

  it('shows empty column message when column has no tasks', async () => {
    (useBoardTasks as any).mockReturnValue({ data: { tasks: [] }, isLoading: false });
    renderWithProviders(<BoardView />);

    await waitFor(() => {
      const empty = screen.getAllByText('board.emptyColumn');
      expect(empty.length).toBe(4); // one per kanban column
    });
  });

  it('filters tasks by priority in board view', async () => {
    const tasks = [
      makeMockTask({ id: 1, title: 'High task', priority: 'high', status: 'todo' }),
      makeMockTask({ id: 2, title: 'Low task', priority: 'low', status: 'todo' }),
    ];
    (useBoardTasks as any).mockReturnValue({ data: { tasks }, isLoading: false });
    renderWithProviders(<BoardView />);

    // Open filters
    await waitFor(() => fireEvent.click(screen.getByText('Filters')));

    // Change priority filter to 'high'
    const prioritySelect = screen.getByDisplayValue('Any priority');
    fireEvent.change(prioritySelect, { target: { value: 'high' } });

    await waitFor(() => {
      expect(screen.getByText('High task')).toBeInTheDocument();
      expect(screen.queryByText('Low task')).not.toBeInTheDocument();
    });
  });

  it('opens task drawer when a task card is clicked', async () => {
    const task = makeMockTask({ title: 'Clickable task', slug: 'HSLY-007', status: 'todo' });
    (useBoardTasks as any).mockReturnValue({ data: { tasks: [task] }, isLoading: false });
    renderWithProviders(<BoardView />);

    await waitFor(() => fireEvent.click(screen.getByText('Clickable task')));

    await waitFor(() => {
      // Drawer shows the slug in its header
      const slugBadges = screen.getAllByText('HSLY-007');
      expect(slugBadges.length).toBeGreaterThan(1); // card + drawer header
    });
  });

  it('displays tag pills on task cards', async () => {
    const task = makeMockTask({ tags: ['backend', 'api'], status: 'in_progress' });
    (useBoardTasks as any).mockReturnValue({ data: { tasks: [task] }, isLoading: false });
    renderWithProviders(<BoardView />);

    await waitFor(() => {
      expect(screen.getByText('backend')).toBeInTheDocument();
      expect(screen.getByText('api')).toBeInTheDocument();
    });
  });
});
