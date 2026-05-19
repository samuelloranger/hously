export const WIDGETS = [
  { id: "weather",           column: 1, order: 0, defaultVisible: true,  adminOnly: false },
  { id: "quick_links",       column: 1, order: 1, defaultVisible: true,  adminOnly: false },
  { id: "chores",            column: 1, order: 2, defaultVisible: true,  adminOnly: false },
  { id: "jellyfin_shelf",    column: 1, order: 3, defaultVisible: true,  adminOnly: false },
  { id: "library_stats",     column: 1, order: 4, defaultVisible: true,  adminOnly: true  },
  { id: "library_alerts",    column: 1, order: 5, defaultVisible: true,  adminOnly: true  },
  { id: "homeassistant",     column: 2, order: 0, defaultVisible: true,  adminOnly: false },
  { id: "habits",            column: 2, order: 1, defaultVisible: true,  adminOnly: false },
  { id: "upcoming",          column: 2, order: 2, defaultVisible: true,  adminOnly: false },
  { id: "trackers",          column: 2, order: 3, defaultVisible: true,  adminOnly: false },
  { id: "jellyfin_random",   column: 2, order: 4, defaultVisible: true,  adminOnly: false },
  { id: "system",            column: 3, order: 0, defaultVisible: true,  adminOnly: false },
  { id: "focus_timer",       column: 3, order: 1, defaultVisible: true,  adminOnly: false },
  { id: "downloads",         column: 3, order: 2, defaultVisible: true,  adminOnly: false },
  { id: "minecraft_compact", column: 3, order: 3, defaultVisible: true,  adminOnly: false },
  { id: "minecraft_cards",   column: 3, order: 4, defaultVisible: true,  adminOnly: false },
  { id: "rss",               column: 3, order: 5, defaultVisible: true,  adminOnly: false },
] as const;

export type WidgetId = (typeof WIDGETS)[number]["id"];
export type WidgetVisibility = Record<WidgetId, boolean>;
export type WidgetMeta = (typeof WIDGETS)[number];
