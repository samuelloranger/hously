# Media Settings Page — Design Spec

**Date:** 2026-05-02
**Branch:** feat/media-settings-page (to be created)

## Overview

Consolidate the four media-related admin settings (quality profiles, library/post-processing, download history, Radarr/Sonarr import) into a single **"Media"** entry in the existing `/settings` sidebar. That entry renders a sub-tabbed content area within the same settings shell. The three current flat sidebar entries are removed.

## URL Shape

| State                    | URL                                                           |
| ------------------------ | ------------------------------------------------------------- |
| First visit to Media tab | `/settings?tab=media` → defaults to `subtab=quality-profiles` |
| Quality Profiles sub-tab | `/settings?tab=media&subtab=quality-profiles`                 |
| Library Settings sub-tab | `/settings?tab=media&subtab=library-settings`                 |
| History sub-tab          | `/settings?tab=media&subtab=history`                          |
| Import sub-tab           | `/settings?tab=media&subtab=import`                           |

Sub-tab navigation uses `navigate({ to: "/settings", search: { tab: "media", subtab }, replace: true })` to avoid polluting browser history with sub-tab switches.

## Sidebar Changes (`Settings.tsx`)

- **Remove** from `adminTabs`: `quality-profiles`, `media-library`, `media-history`
- **Add** to `adminTabs`: `media` (label: `t("settings.media.title")`, icon: `Clapperboard`)
- **Update** `Tab` type: remove `"quality-profiles" | "media-library" | "media-history"`, add `"media"`
- **Remove** the three old render branches from the content area
- **Add** `{activeTab === "media" && currentUser?.is_admin && <MediaSettingsTab />}`

## New Component: `MediaSettingsTab`

**File:** `apps/web/src/pages/settings/_component/MediaSettingsTab.tsx`

**Responsibilities:**

- Read `subtab` from `useSearch`; default to `"quality-profiles"` when absent
- Render a horizontal sub-tab strip (4 buttons) at the top of the content area
- Render the active sub-tab's component below the strip
- Navigate with `replace: true` on sub-tab switch

**Sub-tab map:**

| `subtab` value     | Component rendered           | Label key                             |
| ------------------ | ---------------------------- | ------------------------------------- |
| `quality-profiles` | `<QualityProfilesTab />`     | `settings.media.tabs.qualityProfiles` |
| `library-settings` | `<MediaPostProcessingTab />` | `settings.media.tabs.librarySettings` |
| `history`          | `<LibraryHistoryTab />`      | `settings.media.tabs.history`         |
| `import`           | `<ArrLibraryImportPanel />`  | `settings.media.tabs.import`          |

The sub-tab strip style follows existing horizontal tab patterns in the codebase (underline or pill — match whatever `LibraryItemPage` or similar uses).

The four content components are **imported and rendered as-is** — no internal changes to any of them.

## `DataExportTab` Change

Remove the `ArrLibraryImportPanel` import and its JSX block. All other content in the Data Export tab is preserved unchanged.

## i18n

Add to `apps/web/src/locales/en/common.json` and `fr/common.json` under `settings`:

```json
"media": {
  "title": "Media",
  "tabs": {
    "qualityProfiles": "Quality Profiles",
    "librarySettings": "Library Settings",
    "history": "History",
    "import": "Import"
  }
}
```

French equivalents:

```json
"media": {
  "title": "Médias",
  "tabs": {
    "qualityProfiles": "Profils de qualité",
    "librarySettings": "Paramètres de la bibliothèque",
    "history": "Historique",
    "import": "Importation"
  }
}
```

## Files Changed

| File                   | Change                                                                           |
| ---------------------- | -------------------------------------------------------------------------------- |
| `Settings.tsx`         | Remove 3 tab entries + render branches, add `media` tab + `<MediaSettingsTab />` |
| `MediaSettingsTab.tsx` | **New** — sub-tab strip + content switching                                      |
| `DataExportTab.tsx`    | Remove `ArrLibraryImportPanel` usage                                             |
| `en/common.json`       | Add `settings.media.*` keys                                                      |
| `fr/common.json`       | Add `settings.media.*` keys                                                      |

## Out of Scope

- No changes to `QualityProfilesTab`, `MediaPostProcessingTab`, `LibraryHistoryTab`, or `ArrLibraryImportPanel` internals
- No API or backend changes
- No mobile-specific handling beyond what the existing settings shell already provides (the mobile dropdown inherits the updated tab list automatically)
