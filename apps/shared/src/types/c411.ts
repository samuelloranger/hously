/**
 * C411 integration types for frontend.
 */

// ─── C411 Torrent Search ──────────────────────────────────
export interface C411SearchTorrent {
  id: number;
  infoHash: string;
  name: string;
  category: { id: number; name: string; slug: string; color: string; icon: string };
  subcategory: { id: number; name: string; slug: string };
  language: string;
  size: number;
  seeders: number;
  leechers: number;
  completions: number;
  uploader: string;
  createdAt: string;
  status: 'approved' | 'pending' | 'rejected';
  isOwner: boolean;
}

export interface C411SearchResponse {
  data: C411SearchTorrent[];
  meta: { total: number; totalTorrents: number; page: number; perPage: number; totalPages: number };
}

// ─── C411 Release Status (Slots) ──────────────────────────
export interface C411SlotOccupant {
  slotId: string;
  torrentId: number;
  infoHash: string;
  languages: string[];
  uploadedAt: string;
  seeders: number;
  fileSize: number;
  source: string;
  videoCodec: string;
  audioCodec: string;
  resolution: string;
  torrentName: string;
  isMine?: boolean;
}

export interface C411Slot {
  id: string;
  profile: string;
  label: string;
  occupants: C411SlotOccupant[];
}

export interface C411ReleaseStatusResponse {
  releaseId: number;
  slotGrid: C411Slot[];
  totalSlots: number;
  totalOccupied: number;
  totalFree: number;
  profiles: { profile: string; total: number; occupied: number }[];
}

// ─── C411 Drafts ──────────────────────────────────────────
export interface C411DraftSummary {
  id: number;
  name: string;
  title: string | null;
  category: { id: number; name: string; color: string; icon: string };
  subcategory: { id: number; name: string };
  hasTorrentFile: boolean;
  hasNfoFile: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface C411DraftsResponse {
  success: boolean;
  data: C411DraftSummary[];
  count: number;
  maxAllowed: number;
}

export interface C411DraftDetail {
  id: number;
  name: string;
  title: string | null;
  description: string | null;
  categoryId: number;
  subcategoryId: number;
  category: { id: number; name: string; color: string; icon: string };
  subcategory: { id: number; name: string };
  options: Record<string, number | number[]>;
  tmdbData: any;
  torrentFile: { name: string; data: string } | null;
  nfoFile: { name: string; data: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface C411DraftPayload {
  name?: string;
  title?: string;
  description?: string;
  categoryId?: number;
  subcategoryId?: number;
  options?: Record<string, number | number[]>;
  tmdbData?: any;
  torrentFileName?: string;
  torrentFileData?: string;
  nfoFileName?: string | null;
  nfoFileData?: string | null;
}

// ─── C411 Publish ────────────────────────────────────────
export interface C411PublishResponse {
  success: boolean;
  data?: { id: number; infoHash: string; status: string };
  message?: string;
}

export interface C411PrepareReleaseRequest {
  service: 'radarr' | 'sonarr';
  sourceId: number;
  seasonNumber?: number | null;
}

export interface C411PrepareReleaseResponse {
  id: number;
  queued: boolean;
}

export interface MediaInfoResponse {
  file_path: string;
  file_size: number | null;
  file_count: number;
  scene_name: string;
  release_group: string;
  language_tag: string;
  media_info: {
    container: string;
    resolution: string;
    video_codec: string;
    video_bitrate: string;
    video_bit_depth: string;
    framerate: string;
    source: string;
    duration: string;
    audio_streams: Array<{
      codec: string;
      channels: string;
      bitrate: string;
      language: string;
      title: string;
    }>;
    subtitles: Array<{
      language: string;
      title: string;
      format: string;
      forced: boolean;
    }>;
  } | null;
}

// ─── C411 Categories ──────────────────────────────────────
export interface C411CategoryListItem {
  id: number;
  name: string;
  slug: string;
  color: string;
  icon: string;
  subcategories: { id: number; name: string; slug: string }[];
}

export interface C411CategoryOption {
  id: number;
  name: string;
  slug: string;
  allowsMultiple: boolean;
  isRequired: boolean;
  sortOrder: number;
  values: { id: number; value: string; slug: string; sortOrder: number }[];
}

// ─── Local Releases (DB) ─────────────────────────────────
export interface C411LocalRelease {
  id: number;
  c411_torrent_id: number | null;
  info_hash: string | null;
  name: string;
  title: string | null;
  tmdb_id: number | null;
  tmdb_type: string | null;
  category_name: string | null;
  subcategory_name: string | null;
  language: string | null;
  resolution: string | null;
  source: string | null;
  size: number | null;
  status: string;
  seeders: number | null;
  leechers: number | null;
  completions: number | null;
  metadata: any;
  has_presentation: boolean;
  has_torrent: boolean;
  synced_at: string | null;
  created_at: string;
}

export interface C411LocalReleaseDetail extends C411LocalRelease {
  imdb_id: string | null;
  category_id: number | null;
  subcategory_id: number | null;
  video_codec: string | null;
  audio_codec: string | null;
  torrent_s3_key: string | null;
  nfo_content: string | null;
  hardlink_path: string | null;
  original_path: string | null;
  options: any;
  tmdb_data: any;
  metadata: any;
  bbcode: string | null;
  updated_at: string | null;
}

export interface C411ReleasesResponse {
  releases: C411LocalRelease[];
}

export interface C411SyncResponse {
  created: number;
  updated: number;
  merged: number;
}

export interface C411GenerateBBCodeResponse {
  bbcode: string;
}
