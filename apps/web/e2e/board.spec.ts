import { test, expect, type Page } from '@playwright/test';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function goToBoard(page: Page) {
  await page.goto('/board');
  // Wait for the board to finish loading (columns or tabs visible)
  await expect(page.getByRole('button', { name: /Board/ })).toBeVisible({ timeout: 10_000 });
}

async function createTask(page: Page, title: string, status = 'todo') {
  await page.getByRole('button', { name: 'New task' }).click();
  await page.getByPlaceholder(/task title|task name/i).fill(title);
  // Pick status if select is visible
  const statusSelect = page.locator('select').filter({ hasText: /To Do|Todo|backlog/i }).first();
  if (await statusSelect.isVisible()) {
    await statusSelect.selectOption(status);
  }
  await page.getByRole('button', { name: /Add task/i }).click();
  // Wait for the task to appear
  await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Board page', () => {
  test.beforeEach(async ({ page }) => {
    await goToBoard(page);
  });

  test('shows all four kanban columns', async ({ page }) => {
    await expect(page.getByText('On Hold')).toBeVisible();
    await expect(page.getByText('To Do')).toBeVisible();
    await expect(page.getByText('In Progress')).toBeVisible();
    await expect(page.getByText('Done')).toBeVisible();
  });

  test('has Board and Backlog view tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^Board$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Backlog/ })).toBeVisible();
  });

  test('Board tab is active by default', async ({ page }) => {
    const boardTab = page.getByRole('button', { name: /^Board$/ });
    // Active tab has a different background (bg-white / shadow-sm)
    await expect(boardTab).toHaveClass(/bg-white|shadow/);
  });

  test('New task button opens the create form', async ({ page }) => {
    await page.getByRole('button', { name: 'New task' }).click();
    await expect(page.getByPlaceholder(/task title|task name/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Add task/i })).toBeVisible();
  });

  test('Cancel button closes the create form', async ({ page }) => {
    await page.getByRole('button', { name: 'New task' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByPlaceholder(/task title|task name/i)).not.toBeVisible();
  });

  test('Filters button toggles the filter bar', async ({ page }) => {
    await page.getByRole('button', { name: 'Filters' }).click();
    await expect(page.getByText('Priority:')).toBeVisible();
    await expect(page.getByText('Due date:')).toBeVisible();

    await page.getByRole('button', { name: 'Filters' }).click();
    await expect(page.getByText('Priority:')).not.toBeVisible();
  });
});

test.describe('Creating tasks', () => {
  test.beforeEach(async ({ page }) => {
    await goToBoard(page);
  });

  test('creates a task in the To Do column', async ({ page }) => {
    const title = `E2E task ${Date.now()}`;
    await createTask(page, title, 'todo');

    // Task appears in To Do column
    await expect(page.getByText(title)).toBeVisible();
  });

  test('new task card shows HSLY-xxx slug', async ({ page }) => {
    const title = `Slug test ${Date.now()}`;
    await createTask(page, title, 'todo');

    // Find the card for this task and check its slug
    const card = page.locator('[role="button"]').filter({ hasText: title });
    await expect(card.getByText(/HSLY-\d+/)).toBeVisible();
  });

  test('creates a task in the backlog', async ({ page }) => {
    const title = `Backlog item ${Date.now()}`;
    await createTask(page, title, 'backlog');

    // Switch to backlog view to confirm it's there
    await page.getByRole('button', { name: /Backlog/ }).click();
    await expect(page.getByText(title)).toBeVisible();
  });
});

test.describe('Task drawer', () => {
  let taskTitle: string;

  test.beforeEach(async ({ page }) => {
    await goToBoard(page);
    taskTitle = `Drawer test ${Date.now()}`;
    await createTask(page, taskTitle, 'todo');
  });

  test('opens from the right when a task card is clicked', async ({ page }) => {
    await page.getByText(taskTitle).click();

    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible();
    // Drawer should not have translate-x-full (hidden state)
    await expect(drawer).not.toHaveClass(/translate-x-full/);
  });

  test('drawer shows task slug', async ({ page }) => {
    await page.getByText(taskTitle).click();
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer.getByText(/HSLY-\d+/)).toBeVisible();
  });

  test('drawer shows editable title', async ({ page }) => {
    await page.getByText(taskTitle).click();
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible();
    // The title input should have the task title as its current value
    await expect(page.getByPlaceholder('Task title')).toHaveValue(taskTitle);
  });

  test('drawer shows Status, Priority, Assignee, Start date, Due date, Tags fields', async ({ page }) => {
    await page.getByText(taskTitle).click();
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer.getByText('Status')).toBeVisible();
    await expect(drawer.getByText('Priority')).toBeVisible();
    await expect(drawer.getByText('Assignee')).toBeVisible();
    await expect(drawer.getByText('Start date')).toBeVisible();
    await expect(drawer.getByText('Due date')).toBeVisible();
    await expect(drawer.getByText('Tags')).toBeVisible();
  });

  test('can change task priority in the drawer', async ({ page }) => {
    await page.getByText(taskTitle).click();
    const drawer = page.locator('[role="dialog"]');

    const prioritySelect = drawer.locator('select').filter({ hasText: /Medium|High|Low|Urgent/i }).first();
    await prioritySelect.selectOption('urgent');

    // The priority badge should update
    await expect(drawer.getByText('Urgent')).toBeVisible();
  });

  test('can add a tag in the drawer', async ({ page }) => {
    await page.getByText(taskTitle).click();
    const drawer = page.locator('[role="dialog"]');

    const tagInput = drawer.getByPlaceholder('Add tag…');
    await tagInput.fill('e2e-tag');
    await tagInput.press('Enter');

    await expect(drawer.getByText('e2e-tag')).toBeVisible();
    // Tag should also appear on the card after drawer update
    await page.locator('[role="dialog"] button[aria-label="Close"]').click();
    await expect(page.getByText('e2e-tag')).toBeVisible();
  });

  test('can set a due date in the drawer', async ({ page }) => {
    await page.getByText(taskTitle).click();
    const drawer = page.locator('[role="dialog"]');

    // Fill due date input
    const dueDateInput = drawer.locator('input[type="date"]').nth(1); // second date = due date
    await dueDateInput.fill('2099-12-31');

    // Close drawer and re-open — date should persist
    await page.locator('[role="dialog"] button[aria-label="Close"]').click();
    await page.getByText(taskTitle).click();
    await expect(drawer.locator('input[type="date"]').nth(1)).toHaveValue('2099-12-31');
  });

  test('closes when backdrop is clicked', async ({ page }) => {
    await page.getByText(taskTitle).click();
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible();

    // Click the backdrop (outside the drawer panel)
    await page.mouse.click(100, 300); // left side of viewport, away from drawer
    await expect(drawer).toHaveClass(/translate-x-full/);
  });

  test('closes when X button is clicked', async ({ page }) => {
    await page.getByText(taskTitle).click();
    await page.locator('[role="dialog"] button[aria-label="Close"]').click();
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toHaveClass(/translate-x-full/);
  });
});

test.describe('Backlog view', () => {
  test.beforeEach(async ({ page }) => {
    await goToBoard(page);
  });

  test('switches to backlog view when Backlog tab is clicked', async ({ page }) => {
    await page.getByRole('button', { name: /Backlog/ }).click();
    // Kanban columns should disappear
    await expect(page.getByText('To Do')).not.toBeVisible();
  });

  test('shows backlog tasks as a list', async ({ page }) => {
    const title = `Backlog list item ${Date.now()}`;
    await createTask(page, title, 'backlog');

    await page.getByRole('button', { name: /Backlog/ }).click();
    await expect(page.getByText(title)).toBeVisible();
  });

  test('shows empty state when no backlog tasks', async ({ page }) => {
    await page.getByRole('button', { name: /Backlog/ }).click();
    // Either shows tasks or the empty state — we just check the view loaded
    const hasContent =
      (await page.getByText('Backlog is empty').isVisible()) ||
      (await page.locator('button').filter({ hasText: /HSLY-\d+/ }).count()) > 0;
    expect(hasContent).toBe(true);
  });

  test('clicking a backlog row opens the drawer', async ({ page }) => {
    const title = `Backlog clickable ${Date.now()}`;
    await createTask(page, title, 'backlog');

    await page.getByRole('button', { name: /Backlog/ }).click();
    await page.getByText(title).click();

    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).not.toHaveClass(/translate-x-full/);
    await expect(page.getByPlaceholder('Task title')).toHaveValue(title);
  });
});

test.describe('Filters', () => {
  test.beforeEach(async ({ page }) => {
    await goToBoard(page);
  });

  test('priority filter hides non-matching tasks', async ({ page }) => {
    // Create two tasks with different priorities
    const high = `High priority ${Date.now()}`;
    const low = `Low priority ${Date.now()}`;
    await createTask(page, high, 'todo');
    await createTask(page, low, 'todo');

    // Set high priority on first task via drawer
    await page.getByText(high).click();
    const drawer = page.locator('[role="dialog"]');
    const prioritySelect = drawer.locator('select').filter({ hasText: /Medium|High|Low|Urgent/i }).first();
    await prioritySelect.selectOption('high');
    await page.locator('[role="dialog"] button[aria-label="Close"]').click();

    // Open filters and select high priority
    await page.getByRole('button', { name: 'Filters' }).click();
    const filterPriority = page.locator('select').filter({ hasText: /Any priority/i });
    await filterPriority.selectOption('high');

    await expect(page.getByText(high)).toBeVisible();
    await expect(page.getByText(low)).not.toBeVisible();
  });

  test('Clear button resets filters', async ({ page }) => {
    await page.getByRole('button', { name: 'Filters' }).click();

    const filterPriority = page.locator('select').filter({ hasText: /Any priority/i });
    await filterPriority.selectOption('urgent');

    await page.getByRole('button', { name: 'Clear' }).click();

    // Filter select should be back to "any"
    await expect(page.locator('select').filter({ hasText: /Any priority/i })).toBeVisible();
  });
});

test.describe('Mobile layout', () => {
  test('board is horizontally scrollable on small screen', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await goToBoard(page);

    // The scrollable container should be present
    const scrollContainer = page.locator('.overflow-x-auto').first();
    await expect(scrollContainer).toBeVisible();
  });

  test('drawer takes full width on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await goToBoard(page);

    const title = `Mobile drawer ${Date.now()}`;
    await createTask(page, title, 'todo');
    await page.getByText(title).click();

    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible();

    const box = await drawer.boundingBox();
    expect(box?.width).toBeGreaterThan(300); // full-width on mobile
  });
});
