export interface QualityProfile {
  id: number;
  name: string;
  min_resolution: number;
  preferred_sources: string[];
  preferred_codecs: string[];
  preferred_languages: string[];
  max_size_gb: number | null;
  require_hdr: boolean;
  prefer_hdr: boolean;
  cutoff_resolution: number | null;
  created_at: string;
  updated_at: string;
}

export interface QualityProfilesListResponse {
  profiles: QualityProfile[];
}

export interface QualityProfileMutationResponse {
  profile: QualityProfile;
}

export interface UpdateLibraryQualityProfileRequest {
  quality_profile_id: number | null;
}
