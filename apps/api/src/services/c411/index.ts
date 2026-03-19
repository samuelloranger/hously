/**
 * C411 service module — barrel export.
 */

// Session management
export { getC411Session, clearC411Session, withC411Session, loadC411Config } from './session';

// C411 API
export { fetchDrafts, fetchDraft, createDraft, updateDraft, deleteDraft, publishDraft, publishToC411, downloadPublishedTorrent } from './drafts';
export type { C411PublishResult, C411PublishPayload } from './drafts';
export { fetchCategories, fetchCategoryOptions } from './categories';

// Release preparation
export { prepareRelease } from './prepare-release';
export { syncC411Releases } from './sync';
export { generateBBCode } from './bbcode';
export { fetchTmdbDetails, searchAndFetchTmdbDetails, buildFallbackTmdbDetails } from './tmdb';

// Resolvers
export { resolveCategory, resolveLanguage, resolveGenres } from '@hously/shared';

// Utilities
export { formatReleaseSize as formatSize, calcPieceLength } from '@hously/shared';

// Types
export type {
  C411Session,
  C411Torrent,
  C411TorrentsResponse,
  C411TorrentStatus,
  C411ReleaseStatus,
  C411Slot,
  C411SlotOccupant,
  C411ProfileSummary,
  C411Draft,
  C411DraftDetail,
  C411DraftPayload,
  C411DraftsResponse,
  C411TmdbData,
  C411CategoryListItem,
  C411CategoryOption,
  C411CategoryOptionValue,
  LanguageTag,
} from './types';
export type { TmdbDetails } from './tmdb';
export type { MediaInfoData, AudioStreamInfo, SubtitleStreamInfo } from './mediainfo';
export type { ReleaseInfo } from '@hously/shared';
export type { PrezContext } from './bbcode';
