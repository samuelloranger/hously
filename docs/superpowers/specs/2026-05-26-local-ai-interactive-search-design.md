# Local AI — Interactive Search "AI Pick" Feature

**Date:** 2026-05-26  
**Status:** Approved  
**Scope:** API endpoint + integration config + frontend banner for AI-recommended release in interactive search

---

## Overview

When a user opens the interactive search panel and results load, Hously calls a locally-running LLM (OpenAI-compatible endpoint, e.g. llama.cpp on a homelab) to reason over the release list and surface the best pick. The result appears as a pinned banner above the results list with a one-click "AI Grab" button.

The feature is opt-in: it only activates when the "Local AI" integration is configured and enabled in Settings → Integrations.

---

## Architecture & Data Flow

```
[User triggers interactive search]
        ↓
[Existing: GET /api/medias/search → NormalizedRelease[]]
        ↓
[Results render in InteractiveSearchResultsList]
        ↓  (if AI integration enabled)
[Frontend fires: POST /api/medias/search/ai-pick]
   body: { releases[], media_context, quality_profile_id }
        ↓
[API calls local LLM server (base_url from integration config)]
   prompt: media title + quality profile summary + release list
   response: { release_key, reasoning }
        ↓
[Frontend matches release_key to results array]
   → renders AiPickBanner pinned above the list
   → matching row gets a subtle "AI Pick" badge
        ↓
[User clicks "AI Grab"]
   → same onDownload(release) handler as regular rows
```

Key properties:
- AI pick is a **separate, parallel request** — search results render immediately; banner appears when AI responds (~1–3 s on fast hardware)
- The LLM base URL **never leaves the server**
- No new DB schema required — AI config follows the existing integration config pattern
- Only non-rejected releases (those passing the quality profile scorer) are sent to the LLM

---

## Integration Config (Settings → Integrations)

New card alongside Prowlarr / Jackett / qBittorrent.

### Stored fields

| Field | Type | Example |
|---|---|---|
| `enabled` | boolean | `true` |
| `base_url` | string | `http://homelab:11434` |
| `model` | string | `llama3.2` |

### API surface

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/integrations/local-ai` | Return current config |
| `PUT` | `/api/integrations/local-ai` | Save config |
| `GET` | `/api/integrations/local-ai/test` | Connection test |

**Connection test:** calls `/v1/models` on the configured base URL (OpenAI-compat) and confirms the configured model is listed. Returns 200 on success, 502 with an error message on failure.

---

## API Endpoint: `POST /api/medias/search/ai-pick`

### Request body

```typescript
{
  media_context: {
    title: string;
    year: number | null;
    type: "movie" | "tv";
  };
  quality_profile_id: number;
  releases: Array<{
    key: string;           // guid/token — used to identify the pick
    title: string;
    resolution: string | null;
    source: string | null;
    size_bytes: number | null;
    seeders: number | null;
    score: number | null;  // deterministic scorer output, sent as a signal
    rejected: boolean;     // true if scoreRelease returned rejections
  }>;
}
```

Only non-rejected releases are included in the list sent to the LLM. Rejected releases are filtered out before building the prompt.

### Response body

```typescript
{
  release_key: string;   // matches a key from the request releases array
  reasoning: string;     // ≤150 chars, one sentence
}
```

### LLM prompt strategy

- **System:** *"You are a media release selection assistant for a homelab. Respond only with valid JSON matching the schema `{ release_key: string, reasoning: string }`. Keep reasoning under 150 characters."*
- **User:** media title + year + type, quality profile summary (min resolution, preferred sources, HDR preference), numbered release list with all fields
- **JSON mode:** `response_format: { type: "json_object" }` (OpenAI-compat)

### Error handling

| Condition | HTTP | Frontend effect |
|---|---|---|
| LLM unreachable / timeout (30 s) | 502 | Banner shows error state |
| LLM returns malformed JSON | 502 | Banner shows error state |
| `release_key` not found in original list | 422 | Banner shows error state |
| AI integration disabled | 404 | Banner hidden entirely |

---

## Frontend

### Hook: `useAiPick`

Lives in `apps/web/src/pages/medias/_component/` alongside the panel.

- Fires automatically when `releases.length > 0` and the AI integration is enabled
- Accepts: `releases`, `mediaContext`, `qualityProfileId`
- Returns: `{ data, isLoading, isError, refetch }`
- Result is cached per search — does not re-fire on re-renders
- Implemented with TanStack Query (`useQuery`), key under `queryKeys`

### Component: `AiPickBanner`

Pinned above `InteractiveSearchResultsList`. Three visible states:

| State | UI |
|---|---|
| **Loading** | Skeleton pulse with "AI is analyzing releases…" label |
| **Success** | Spark/wand icon · release title · reasoning sentence · **AI Grab** button · dismiss `×` |
| **Error** | Warning icon · "Could not get response from AI" · **Retry** button |
| **Disabled** | Renders nothing |

**AI Grab button:**
- Calls the same `onDownload(release)` prop already on the results list — no new grab logic
- Disabled while `grabBusy` (same guard as regular rows)
- After grab: brief "Grabbed ✓" confirmation then banner fades out

**Row badge:**
- The release row matching `release_key` in `InteractiveSearchResultsList` receives a subtle "AI Pick" label so the user can locate it when scrolling

### `InteractiveSearchPanel` changes

- Passes `releases`, `mediaContext`, and `qualityProfileId` into `useAiPick`
- Renders `<AiPickBanner>` between the toolbar and the results list
- No structural changes to `InteractiveSearchResultsList`

---

## Out of Scope

- Streaming / typewriter effect for reasoning (can be added as a follow-up)
- Using AI for auto-grab RSS flow (separate feature)
- AI suggestions outside of interactive search (e.g. library recommendations)
