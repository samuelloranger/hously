import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, renderWithProviders } from '@/test-utils/render';
import { fireEvent } from '@testing-library/react';
import { BacklogView } from '@/features/board/components/BacklogView';
import type { BoardTask } from '@hously/shared';

const makeTask = (overrides: Partial<BoardTask> = {}): BoardTask => ({
  id: 1,
  slug: 'HSLY-001',
  title: 'Default backlog task',
  description: null,
  status: 'backlog',
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
  estimated_minutes: null,
  logged_minutes: 0,
  blocks: [],
  blocked_by: [],
  ...overrides,
});

describe('BacklogView', () => {
  const onTaskClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when task list is empty', async () => {
    renderWithProviders(<BacklogView tasks={[]} onTaskClick={onTaskClick} />);
    await waitFor(() => {
      expect(screen.getByText('Backlog is empty')).toBeInTheDocument();
    });
  });

  it('shows helpful description in empty state', async () => {
    renderWithProviders(<BacklogView tasks={[]} onTaskClick={onTaskClick} />);
    await waitFor(() => {
      expect(screen.getByText(/Add tasks to the backlog/)).toBeInTheDocument();
    });
  });

  it('renders a task row with title', async () => {
    const task = makeTask({ title: 'Refactor auth module' });
    renderWithProviders(<BacklogView tasks={[task]} onTaskClick={onTaskClick} />);
    await waitFor(() => {
      expect(screen.getByText('Refactor auth module')).toBeInTheDocument();
    });
  });

  it('renders multiple task rows', async () => {
    const tasks = [
      makeTask({ id: 1, title: 'Task Alpha' }),
      makeTask({ id: 2, title: 'Task Beta' }),
      makeTask({ id: 3, title: 'Task Gamma' }),
    ];
    renderWithProviders(<BacklogView tasks={tasks} onTaskClick={onTaskClick} />);
    await waitFor(() => {
      expect(screen.getByText('Task Alpha')).toBeInTheDocument();
      expect(screen.getByText('Task Beta')).toBeInTheDocument();
      expect(screen.getByText('Task Gamma')).toBeInTheDocument();
    });
  });

  it('calls onTaskClick with the task when a row is clicked', async () => {
    const task = makeTask({ id: 7, title: 'Clickable task' });
    renderWithProviders(<BacklogView tasks={[task]} onTaskClick={onTaskClick} />);
    await waitFor(() => {
      fireEvent.click(screen.getByText('Clickable task'));
    });
    expect(onTaskClick).toHaveBeenCalledOnce();
    expect(onTaskClick).toHaveBeenCalledWith(task);
  });

  it('shows tag pills on the row', async () => {
    const task = makeTask({ tags: [{ id: 1, name: 'backend', color: null }, { id: 2, name: 'p0', color: null }] });
    renderWithProviders(<BacklogView tasks={[task]} onTaskClick={onTaskClick} />);
    await waitFor(() => {
      expect(screen.getByText('backend')).toBeInTheDocument();
      expect(screen.getByText('p0')).toBeInTheDocument();
    });
  });

  it('shows overflow tag count when more than 2 tags', async () => {
    const task = makeTask({ tags: [
      { id: 1, name: 'a', color: null },
      { id: 2, name: 'b', color: null },
      { id: 3, name: 'c', color: null },
      { id: 4, name: 'd', color: null },
    ] });
    renderWithProviders(<BacklogView tasks={[task]} onTaskClick={onTaskClick} />);
    await waitFor(() => {
      expect(screen.getByText('+2')).toBeInTheDocument();
    });
  });

  it('shows due date on the row', async () => {
    const task = makeTask({ due_date: '2025-09-20' });
    const { container } = renderWithProviders(<BacklogView tasks={[task]} onTaskClick={onTaskClick} />);
    await waitFor(() => {
      // The row button's textContent includes the rendered date (month name)
      const row = container.querySelector('button');
      expect(row?.textContent).toMatch(/Sep/);
    });
  });

  it('shows overdue indicator for past due dates', async () => {
    const task = makeTask({ due_date: '2020-06-15' }); // clearly in the past
    const { container } = renderWithProviders(<BacklogView tasks={[task]} onTaskClick={onTaskClick} />);
    await waitFor(() => {
      // Overdue dates render with a red text span
      const redSpan = container.querySelector('.text-red-500, .text-red-400');
      expect(redSpan).toBeInTheDocument();
    });
  });

  it('renders task slug in the row', async () => {
    const task = makeTask({ slug: 'HSLY-099' });
    renderWithProviders(<BacklogView tasks={[task]} onTaskClick={onTaskClick} />);
    await waitFor(() => {
      expect(screen.getByText('HSLY-099')).toBeInTheDocument();
    });
  });

  it('shows assignee initials when no avatar', async () => {
    const task = makeTask({ assignee_name: 'John Doe', assignee_avatar: null });
    renderWithProviders(<BacklogView tasks={[task]} onTaskClick={onTaskClick} />);
    await waitFor(() => {
      expect(screen.getByTitle('John Doe')).toBeInTheDocument();
      expect(screen.getByText('JD')).toBeInTheDocument();
    });
  });

  it('renders assignee avatar img when avatar_url is set', async () => {
    const task = makeTask({
      assignee_name: 'Jane',
      assignee_avatar: 'https://example.com/avatar.jpg',
    });
    renderWithProviders(<BacklogView tasks={[task]} onTaskClick={onTaskClick} />);
    await waitFor(() => {
      const img = screen.getByRole('img', { name: 'Jane' }) as HTMLImageElement;
      expect(img.src).toBe('https://example.com/avatar.jpg');
    });
  });
});
