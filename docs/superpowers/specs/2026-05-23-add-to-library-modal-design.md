# Add to Library Modal — Design Spec

**Date:** 2026-05-23  
**Status:** Approved

## Overview

Add an "Add to library" button to the LibraryPage toolbar. Clicking it opens a modal containing `TmdbMediaSearchPanel` so the user can search TMDB and add movies/shows without navigating to the discover/explore page.

## Goals

- Search TMDB and add media to the library from the library page itself.
- Reuse the existing search panel exactly as-is — same behavior, same badges, same detail dialog.
- No new API endpoints or data-fetching hooks required.

## Button Placement

An "+ Add to library" button is added to the LibraryPage toolbar alongside the existing filter and view-mode controls. Follows the same button style already in use in the toolbar.

## Modal

A new `AddToLibraryModal` component wraps `TmdbMediaSearchPanel` in a shadcn `Dialog`.

**Backdrop:** `bg-black/60 backdrop-blur-sm` — dark tinted with a light blur.  
**Panel:** Plain white / dark-neutral background. No extra card chrome (the panel's `variant="modal"` prop already strips the card wrapper).  
**Close:** Standard close button in the top-right corner (or pressing Escape).  
**Autofocus:** `inputRef` wired so the search input receives focus the moment the modal opens.

## Search Behavior

`TmdbMediaSearchPanel` is fully self-contained:
- Has its own independent search input and debounce state (350ms).
- No connection to the library page's filter/search bar.
- Minimum 2 characters to fire a search.
- Results show "In Library" (emerald), "Library" (blue), "Not Configured" (amber), or "Add" (primary) badges.
- Clicking an "In Library" item navigates to that library item's detail page (closes the modal naturally via navigation).
- Clicking an addable item opens `ExploreCardDetailDialog` for confirmation/details before adding.
- After a successful add, search results auto-refresh via `searchQuery.refetch()`.
- `useAddToLibrary` invalidates `queryKeys.library.all` on success, keeping the background library list fresh.

## Files Touched

| File | Change |
|------|--------|
| `apps/web/src/pages/medias/_component/AddToLibraryModal.tsx` | New — thin Dialog wrapper around `TmdbMediaSearchPanel variant="modal"` |
| `apps/web/src/pages/medias/_component/LibraryPage.tsx` | Add open/close state + render `AddToLibraryModal` + "+ Add" button in toolbar |

## What Is Not Changing

- `TmdbMediaSearchPanel` — no changes needed; `variant="modal"` already exists for this use case.
- `useAddToLibrary`, `useTmdbMediaSearch` — used as-is.
- API layer — no changes.
- Discover/explore page — unaffected.
