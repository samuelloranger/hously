/**
 * MediaInfo extraction from media files.
 */

import { findMediaFile } from './lang-detect';

export interface AudioStreamInfo {
  codec: string;
  channels: string;
  bitrate: string;
  language: string;
  title: string;
}

export interface SubtitleStreamInfo {
  language: string;
  title: string;
  format: string;
  forced: boolean;
}

export interface MediaInfoData {
  fullOutput: string;
  container: string;
  resolution: string;
  videoCodec: string;
  videoBitrate: string;
  videoRefFrames: number | null;
  videoBitDepth: string;
  framerate: string;
  duration: string;
  source: string;
  audioStreams: AudioStreamInfo[];
  subtitles: SubtitleStreamInfo[];
}

export async function getMediaInfo(contentPath: string, releaseName?: string): Promise<MediaInfoData | null> {
  const mediaFile = await findMediaFile(contentPath);
  if (!mediaFile) return null;

  const fullProc = Bun.spawn(['mediainfo', mediaFile], { stdout: 'pipe', stderr: 'pipe' });
  let fullOutput = await new Response(fullProc.stdout).text();
  await fullProc.exited;

  const jsonProc = Bun.spawn(['mediainfo', '--Output=JSON', mediaFile], { stdout: 'pipe', stderr: 'pipe' });
  const jsonOutput = await new Response(jsonProc.stdout).text();
  await jsonProc.exited;

  let container = 'N/A';
  let resolution = 'N/A';
  let videoCodec = 'N/A';
  let videoBitrate = 'N/A';
  let videoRefFrames: number | null = null;
  let videoBitDepth = 'N/A';
  let framerate = 'N/A';
  let duration = 'N/A';
  let source = 'N/A';
  const audioStreams: AudioStreamInfo[] = [];
  const subtitles: SubtitleStreamInfo[] = [];

  const fileName = mediaFile.split('/').pop() ?? '';
  source = detectSource(fileName);
  if (source === 'N/A' && releaseName) source = detectSource(releaseName);

  try {
    const data = JSON.parse(jsonOutput);
    const tracks: any[] = data.media?.track ?? [];

    for (const track of tracks) {
      if (track['@type'] === 'General') {
        if (track.Format) container = normalizeContainer(track.Format);
        if (track.Duration) {
          const secs = parseFloat(track.Duration);
          if (!isNaN(secs)) {
            const h = Math.floor(secs / 3600);
            const m = Math.floor((secs % 3600) / 60);
            const s = Math.floor(secs % 60);
            duration = h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
          }
        }
      }

      if (track['@type'] === 'Video') {
        const w = track.Width;
        const h = track.Height;
        if (w && h) {
          const width = parseInt(w);
          const height = parseInt(h);
          if (width >= 3800 || height >= 2100) resolution = '2160p (4K)';
          else if (width >= 1900 || height >= 1070) resolution = '1080p';
          else if (width >= 1260 || height >= 700) resolution = '720p';
          else if (width >= 700 || height >= 460) resolution = '480p';
          else resolution = `${w}x${h}`;
        }

        const format = track.Format ?? '';
        const formatProfile = track.Format_Profile ?? '';
        const codecId = track.CodecID ?? '';
        videoCodec = normalizeVideoCodec(format, formatProfile, codecId);

        if (track.BitRate) {
          const kbps = Math.round(parseInt(track.BitRate) / 1000);
          videoBitrate = kbps >= 1000 ? `${(kbps / 1000).toFixed(1)} Mbps` : `${kbps} kbps`;
        } else if (track.BitRate_Nominal) {
          const kbps = Math.round(parseInt(track.BitRate_Nominal) / 1000);
          videoBitrate = kbps >= 1000 ? `${(kbps / 1000).toFixed(1)} Mbps` : `${kbps} kbps`;
        }

        const refValue = track.Format_Settings_RefFrames ?? track['Format settings, Reference frames'] ?? track.RefFrames;
        if (refValue) {
          const refMatch = String(refValue).match(/\d+/);
          if (refMatch) videoRefFrames = parseInt(refMatch[0], 10);
        }

        if (track.BitDepth) videoBitDepth = `${track.BitDepth}-bit`;
        if (track.FrameRate) framerate = `${track.FrameRate} fps`;
      }

      if (track['@type'] === 'Audio') {
        const aCodec = normalizeAudioCodec(track.Format ?? '', track.Format_Commercial_Name ?? '', track.CodecID ?? '');
        const channels = track.Channels ? `${track.Channels}ch` : '';
        let aBitrate = '';
        if (track.BitRate) {
          const kbps = Math.round(parseInt(track.BitRate) / 1000);
          aBitrate = `${kbps} kbps`;
        }
        audioStreams.push({
          codec: aCodec, channels, bitrate: aBitrate,
          language: track.Language ?? 'und', title: track.Title ?? '',
        });
      }

      if (track['@type'] === 'Text') {
        const title = track.Title ?? '';
        const forcedValue = String(track.Forced ?? '').toLowerCase();
        subtitles.push({
          language: track.Language ?? 'und', title,
          format: normalizeSubtitleFormat(track.Format ?? '', track.CodecID ?? ''),
          forced: forcedValue === 'yes' || /\bforced\b/i.test(title),
        });
      }
    }
  } catch {
    // Fall back to text parsing if JSON fails
  }

  const name = releaseName ?? mediaFile.split('/').pop() ?? '';
  const hasAnyLanguage = audioStreams.some((s) => s.language && s.language !== 'und');
  if (!hasAnyLanguage && audioStreams.length > 0) {
    const detected = detectLangFromName(name);
    for (let i = 0; i < audioStreams.length && i < detected.length; i++) {
      audioStreams[i].language = detected[i].lang.toLowerCase().slice(0, 3);
      audioStreams[i].title = detected[i].label;
    }
  }
  fullOutput = patchNfoLanguage(fullOutput, name, audioStreams);

  if (videoRefFrames === null) {
    const refMatch =
      fullOutput.match(/Format settings, Reference frames\s+: (\d+) frame/i) ??
      fullOutput.match(/ref=(\d+)/i);
    if (refMatch) videoRefFrames = parseInt(refMatch[1], 10);
  }

  return {
    fullOutput: fullOutput.trim(), container, resolution, videoCodec, videoBitrate,
    videoRefFrames, videoBitDepth, framerate, duration, source, audioStreams, subtitles,
  };
}

function normalizeContainer(format: string): string {
  const f = format.toLowerCase();
  if (f === 'matroska') return 'MKV';
  if (f === 'mpeg-4' || f === 'mp4') return 'MP4';
  if (f === 'avi') return 'AVI';
  if (f === 'mpeg-ts' || f === 'mpegts') return 'TS';
  if (f === 'wmv') return 'WMV';
  return format.toUpperCase();
}

function normalizeVideoCodec(format: string, profile: string, codecId: string): string {
  const f = format.toLowerCase();
  const cid = codecId.toLowerCase();
  if (f === 'hevc' || f === 'h.265' || cid.includes('hev1') || cid.includes('hvc1')) return 'H265';
  if (f === 'avc' || f === 'h.264' || cid.includes('avc1') || cid.includes('v_mpeg4/iso/avc')) return 'H264';
  if (f === 'av1') return 'AV1';
  if (f === 'mpeg video') return profile.includes('4') ? 'MPEG-4' : 'MPEG-2';
  if (f === 'vp9') return 'VP9';
  return format || 'Unknown';
}

function normalizeAudioCodec(format: string, commercialName: string, _codecId: string): string {
  const f = format.toLowerCase();
  const cn = commercialName.toLowerCase();
  if (f === 'ac-3' || f === 'ac3') return 'AC3';
  if (f === 'e-ac-3' || f === 'eac3') return 'EAC3';
  if (cn.includes('dts-hd ma') || cn.includes('dts-hd master')) return 'DTS-HD MA';
  if (cn.includes('dts-hd')) return 'DTS-HD';
  if (f === 'dts') return 'DTS';
  if (cn.includes('truehd') || f.includes('truehd')) return 'TrueHD';
  if (f === 'aac') return 'AAC';
  if (f === 'flac') return 'FLAC';
  if (f === 'opus') return 'Opus';
  if (f === 'vorbis') return 'Vorbis';
  if (f === 'mp3' || f === 'mpeg audio') return 'MP3';
  if (f === 'pcm') return 'PCM';
  return format || 'Unknown';
}

function normalizeSubtitleFormat(format: string, codecId: string): string {
  const f = format.toLowerCase();
  const cid = codecId.toLowerCase();
  if (f === 'utf-8' || f === 'ascii' || cid.includes('s_text/utf8') || cid === 's_utf8') return 'SRT';
  if (f === 'subrip' || cid.includes('srt')) return 'SRT';
  if (f === 'ass' || f === 'ssa' || cid.includes('s_text/ass') || cid.includes('s_text/ssa')) return 'ASS';
  if (f === 'pgs' || cid.includes('s_hdmv/pgs')) return 'PGS';
  if (f === 'vobsub' || cid.includes('s_vobsub')) return 'VobSub';
  if (f === 'webvtt' || cid.includes('webvtt')) return 'WebVTT';
  if (f === 'dvb subtitle' || f === 'dvbsub') return 'DVB';
  return format || 'N/A';
}

function detectLangFromName(name: string): { lang: string; label: string }[] {
  const n = name.toUpperCase();
  const langs: { lang: string; label: string }[] = [];

  if (/\bMULTI\.VF2\b/.test(n)) {
    langs.push({ lang: 'French', label: 'VFF' }, { lang: 'French', label: 'VFQ' }, { lang: 'English', label: 'VO' });
    return langs;
  }
  if (/\bMULTI\b/.test(n)) {
    if (/\bVFF\b/.test(n)) langs.push({ lang: 'French', label: 'VFF' });
    else if (/\bVFQ\b/.test(n) || /\bVQC\b/.test(n)) langs.push({ lang: 'French', label: 'VFQ' });
    else if (/\bVFI\b/.test(n)) langs.push({ lang: 'French', label: 'VFI' });
    else langs.push({ lang: 'French', label: 'French' });
    langs.push({ lang: 'English', label: 'VO' });
    return langs;
  }

  if (/\bVFF\b/.test(n)) return [{ lang: 'French', label: 'VFF' }];
  if (/\bVFQ\b/.test(n) || /\bVQC\b/.test(n)) return [{ lang: 'French', label: 'VFQ' }];
  if (/\bVFI\b/.test(n)) return [{ lang: 'French', label: 'VFI' }];
  if (/\bTRUEFRENCH\b/.test(n)) return [{ lang: 'French', label: 'TRUEFRENCH' }];
  if (/\bFRENCH\b/.test(n)) return [{ lang: 'French', label: 'French' }];
  if (/\bVOSTFR\b/.test(n)) return [{ lang: 'French', label: 'VOSTFR (sous-titres)' }];
  return [];
}

function patchNfoLanguage(nfo: string, releaseName: string, _audioStreams: AudioStreamInfo[]): string {
  const audioSections = nfo.split(/^Audio/m);
  if (audioSections.length <= 1) return nfo;

  const hasLanguageInNfo = audioSections.slice(1).some((section) => {
    const sectionEnd = section.search(/^\n[A-Z]/m);
    const audioBlock = sectionEnd > 0 ? section.slice(0, sectionEnd) : section;
    return /^Language\s/m.test(audioBlock);
  });
  if (hasLanguageInNfo) return nfo;

  const detected = detectLangFromName(releaseName);
  if (detected.length === 0) return nfo;

  let audioIdx = 0;
  const lines = nfo.split('\n');
  const patched: string[] = [];
  let inAudioSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    patched.push(line);

    if (/^Audio/.test(line)) {
      inAudioSection = true;
      continue;
    }

    if (inAudioSection && (line.trim() === '' || /^[A-Z]/.test(line))) {
      if (audioIdx < detected.length) {
        const langLine = `Language                                 : ${detected[audioIdx].lang}`;
        const titleLine = `Title                                    : ${detected[audioIdx].label}`;
        patched.pop();
        patched.push(langLine);
        patched.push(titleLine);
        patched.push(line);
      }
      audioIdx++;
      inAudioSection = false;
      continue;
    }

    if (inAudioSection && /^Language\s/.test(line.trim())) {
      inAudioSection = false;
    }
  }

  if (inAudioSection && audioIdx < detected.length) {
    patched.push(`Language                                 : ${detected[audioIdx].lang}`);
    patched.push(`Title                                    : ${detected[audioIdx].label}`);
  }

  return patched.join('\n');
}

export function detectSource(fileName: string): string {
  const name = fileName.toLowerCase();
  let source = '';
  if (/blu-?ray|bdremux|bdmux/.test(name)) source = 'BluRay';
  else if (/web-?dl/.test(name)) source = 'WEB-DL';
  else if (/webrip/.test(name)) source = 'WEBRip';
  else if (/bdrip/.test(name)) source = 'BDRip';
  else if (/hdrip/.test(name)) source = 'HDRip';
  else if (/dvdrip/.test(name)) source = 'DVDRip';
  else if (/hdtv/.test(name)) source = 'HDTV';
  else if (/web(?!.*(dl|rip))/.test(name)) source = 'WEB';

  let encoding = '';
  if (/hdlight/.test(name)) encoding = 'HDLight';
  else if (/remux/.test(name)) encoding = 'Remux';

  if (encoding === 'HDLight' && !source) source = 'BluRay';
  if (encoding === 'HDLight') return 'HDLight';
  if (source && encoding) return `${source} (${encoding})`;
  if (source) return source;
  if (encoding) return encoding;
  return 'N/A';
}
