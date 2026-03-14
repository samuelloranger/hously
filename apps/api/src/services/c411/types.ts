/**
 * Types for the C411 tracker API.
 * Ported from c411-mcp/src/lib/c411/types.ts
 */

export type C411Category = {
  id: number;
  name: string;
  slug: string;
  color: string;
  icon: string;
};

export type C411Subcategory = {
  id: number;
  name: string;
  slug: string;
};

export type C411TorrentStatus = "approved" | "pending" | "rejected";

export type C411Torrent = {
  id: number;
  infoHash: string;
  name: string;
  description: string;
  category: C411Category;
  subcategory: C411Subcategory;
  language: string;
  quality: string | null;
  size: number;
  seeders: number;
  leechers: number;
  completions: number;
  comments: number;
  uploader: string;
  createdAt: string;
  isExclusive: boolean;
  isFreeleech: boolean;
  hasNfo: boolean;
  status: C411TorrentStatus;
  isOwner: boolean;
  isAnonymousUpload: boolean;
};

export type C411PaginationMeta = {
  total: number;
  totalTorrents: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export type C411TorrentsResponse = {
  data: C411Torrent[];
  meta: C411PaginationMeta;
};

export type C411TmdbData = {
  id: number;
  imdbId: string;
  type: "movie" | "tv";
  title: string;
  originalTitle: string;
  year: number;
  overview: string;
  posterUrl: string;
  backdropUrl: string;
  genres: string[];
  rating: number;
  ratingCount: number;
  runtime: number;
  directors: string[];
  writers: string[];
  cast: { name: string; character: string }[];
  releaseDate: string;
  countries: string[];
  languages: string[];
  productionCompanies: string[];
  status: string;
  tagline: string;
  keywords: string[];
};

export type C411TorrentOptionValue = {
  id: number;
  value: string;
  slug: string;
};

export type C411TorrentOption = {
  id: number;
  name: string;
  slug: string;
  values: C411TorrentOptionValue[];
};

export type C411TorrentMetadata = {
  category: C411Category & { icon: string };
  subcategory: C411Subcategory;
  options: C411TorrentOption[];
  hasNfo: boolean;
  nfoContent: string | null;
  tmdbData: C411TmdbData | null;
  rawgData: unknown;
  lowBitrateWarning: boolean;
  isExclusive: boolean;
};

export type C411TorrentFile = {
  path: string[];
  length: number;
};

export type C411TorrentDetail = {
  id: number;
  infoHash: string;
  name: string;
  description: string;
  category: { id: number; name: string };
  size: number;
  seeders: number;
  leechers: number;
  completions: number;
  uploader: string;
  createdAt: string;
  files: C411TorrentFile[];
  trackers: string[];
  isFreeleech: boolean;
  metadata: C411TorrentMetadata;
  status: C411TorrentStatus;
  rejectionReason: string | null;
  isOwner: boolean;
  canEdit: boolean;
  canValidate: boolean;
  trust: unknown;
  revisionHistory: unknown;
  isAnonymousUpload: boolean;
};

export type C411TorrentStats = {
  seeders: number;
  leechers: number;
  crossSeeders: number;
  completions: number;
  totalUploaded: number;
  crossSeedUploaded: number;
  crossSeedUploadPercent: number;
};

export type C411SlotOccupant = {
  slotId: string;
  torrentId: number;
  infoHash: string;
  languages: string[];
  uploadedAt: string;
  seeders: number;
  fileSize: number;
  source: string;
  videoCodec: string;
  audioType: string;
  audioCodec: string;
  audioChannels: string;
  resolution: string;
  uploaderId: number;
  torrentName: string;
};

export type C411Slot = {
  id: string;
  profile: string;
  label: string;
  occupants: C411SlotOccupant[];
};

export type C411ProfileSummary = {
  profile: string;
  total: number;
  occupied: number;
};

export type C411ReleaseStatus = {
  releaseId: number;
  slotGrid: C411Slot[];
  totalSlots: number;
  totalOccupied: number;
  totalFree: number;
  profiles: C411ProfileSummary[];
};

export type C411CategoryOptionValue = {
  id: number;
  value: string;
  slug: string;
  sortOrder: number;
};

export type C411CategoryOption = {
  id: number;
  name: string;
  slug: string;
  allowsMultiple: boolean;
  isRequired: boolean;
  sortOrder: number;
  values: C411CategoryOptionValue[];
};

export type C411CategoryOptionsResponse = {
  data: C411CategoryOption[];
};

export type C411CategoryListItem = {
  id: number;
  name: string;
  slug: string;
  color: string;
  icon: string;
  subcategories: C411Subcategory[];
};

export type C411CategoriesResponse = {
  data: C411CategoryListItem[];
};

export type C411DraftCategory = {
  id: number;
  name: string;
  color: string;
  icon: string;
};

export type C411DraftSubcategory = {
  id: number;
  name: string;
};

export type C411Draft = {
  id: number;
  name: string;
  title: string | null;
  category: C411DraftCategory;
  subcategory: C411DraftSubcategory;
  hasTorrentFile: boolean;
  hasNfoFile: boolean;
  createdAt: string;
  updatedAt: string;
};

export type C411DraftsResponse = {
  success: boolean;
  data: C411Draft[];
  count: number;
  maxAllowed: number;
};

export type C411DraftDetail = {
  id: number;
  name: string;
  title: string | null;
  description: string | null;
  categoryId: number;
  subcategoryId: number;
  category: C411DraftCategory;
  subcategory: C411DraftSubcategory;
  options: Record<string, number | number[]>;
  tmdbData: C411TmdbData | null;
  torrentFile: { name: string; data: string } | null;
  nfoFile: { name: string; data: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type C411DraftDetailResponse = {
  success: boolean;
  data: C411DraftDetail;
};

export type C411DraftPayload = {
  name?: string;
  title?: string;
  description?: string;
  categoryId?: number;
  subcategoryId?: number;
  options?: Record<string, number | number[]>;
  tmdbData?: C411TmdbData;
  torrentFileName?: string;
  torrentFileData?: string;
  nfoFileName?: string | null;
  nfoFileData?: string | null;
};

// Session type for authenticated C411 API calls
export type C411Session = {
  jar: import('../trackers/httpScraper').CookieJar;
  userAgent: string;
  trackerUrl: string;
};

// Language tag detected from audio tracks
export type LanguageTag = "MULTI.VF2" | "MULTI.VFF" | "MULTI.VFQ" | "MULTI.VFI" | "VFF" | "VFQ" | "VFI" | "EN" | "UNKNOWN";
