export interface JellyfinAudioStream {
  index: number;
  language: string | null;
  display_title: string;
  codec: string | null;
  is_default: boolean;
}

export interface JellyfinPlaybackInfo {
  item_id: string;
  title: string;
  item_type: string;
  series_name: string | null;
  overview: string | null;
  production_year: number | null;
  stream_url: string;
  poster_url: string | null;
  backdrop_url: string | null;
  container: string;
  mime_type: string;
  duration_ticks: number | null;
  resume_ticks: number;
  played_percentage: number;
  audio_streams: JellyfinAudioStream[];
  default_audio_stream_index: number | null;
}
