export const WIDGETS = [
  {
    id: "weather",
    column: 1,
    order: 0,
    defaultVisible: true,
    adminOnly: false,
  },
  {
    id: "quick_links",
    column: 1,
    order: 1,
    defaultVisible: true,
    adminOnly: false,
  },
  { id: "chores", column: 1, order: 2, defaultVisible: true, adminOnly: false },
  {
    id: "jellyfin_shelf",
    column: 1,
    order: 3,
    defaultVisible: true,
    adminOnly: false,
  },
  {
    id: "library_stats",
    column: 1,
    order: 4,
    defaultVisible: true,
    adminOnly: true,
  },
  {
    id: "library_alerts",
    column: 1,
    order: 5,
    defaultVisible: true,
    adminOnly: true,
  },
  {
    id: "homeassistant",
    column: 2,
    order: 0,
    defaultVisible: true,
    adminOnly: false,
  },
  { id: "habits", column: 2, order: 1, defaultVisible: true, adminOnly: false },
  {
    id: "upcoming",
    column: 2,
    order: 2,
    defaultVisible: true,
    adminOnly: false,
  },
  {
    id: "trackers",
    column: 2,
    order: 3,
    defaultVisible: true,
    adminOnly: false,
  },
  {
    id: "jellyfin_random",
    column: 2,
    order: 4,
    defaultVisible: true,
    adminOnly: false,
  },
  { id: "system", column: 3, order: 0, defaultVisible: true, adminOnly: false },
  {
    id: "focus_timer",
    column: 3,
    order: 1,
    defaultVisible: true,
    adminOnly: false,
  },
  {
    id: "downloads",
    column: 3,
    order: 2,
    defaultVisible: true,
    adminOnly: false,
  },
  {
    id: "minecraft_compact",
    column: 3,
    order: 3,
    defaultVisible: true,
    adminOnly: false,
  },
  { id: "rss", column: 3, order: 4, defaultVisible: true, adminOnly: false },
] as const;

export type WidgetId = (typeof WIDGETS)[number]["id"];
export type WidgetVisibility = Record<WidgetId, boolean>;
export type WidgetMeta = (typeof WIDGETS)[number];

export type WidgetLayout = [WidgetId[], WidgetId[], WidgetId[]];

export function getDefaultLayout(): WidgetLayout {
  return [1, 2, 3].map((col) =>
    WIDGETS.filter((w) => w.column === col)
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((w) => w.id),
  ) as WidgetLayout;
}

export function getEffectiveLayout(stored: WidgetLayout | null): WidgetLayout {
  const validIds = new Set<string>(WIDGETS.map((w) => w.id));
  if (!stored) return getDefaultLayout();
  const cleaned = stored.map((col) =>
    col.filter((id) => validIds.has(id)),
  ) as WidgetLayout;
  const allStored = new Set(cleaned.flat());
  WIDGETS.forEach((w) => {
    if (!allStored.has(w.id)) {
      cleaned[w.column - 1].push(w.id);
    }
  });
  return cleaned;
}

export function moveWidgetInLayout(
  layout: WidgetLayout,
  id: WidgetId,
  direction: "up" | "down",
  isVisible: (id: WidgetId) => boolean,
): WidgetLayout {
  const next = layout.map((col) => [...col]) as WidgetLayout;
  const colIdx = next.findIndex((col) => col.includes(id));
  if (colIdx === -1) return next;
  const pos = next[colIdx].indexOf(id);

  if (direction === "up") {
    let targetPos = pos - 1;
    while (targetPos >= 0 && !isVisible(next[colIdx][targetPos])) targetPos--;
    if (targetPos >= 0) {
      [next[colIdx][targetPos], next[colIdx][pos]] = [
        next[colIdx][pos],
        next[colIdx][targetPos],
      ];
    } else if (colIdx > 0) {
      next[colIdx].splice(pos, 1);
      next[colIdx - 1].push(id);
    }
  } else {
    let targetPos = pos + 1;
    while (
      targetPos < next[colIdx].length &&
      !isVisible(next[colIdx][targetPos])
    )
      targetPos++;
    if (targetPos < next[colIdx].length) {
      [next[colIdx][targetPos], next[colIdx][pos]] = [
        next[colIdx][pos],
        next[colIdx][targetPos],
      ];
    } else if (colIdx < 2) {
      next[colIdx].splice(pos, 1);
      next[colIdx + 1].unshift(id);
    }
  }

  return next;
}
