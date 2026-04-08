import { describe, expect, test } from "bun:test";
import { parseReleaseTitle } from "@hously/api/utils/medias/filenameParser";

describe("parseReleaseTitle", () => {
  const cases: { title: string; exp: ReturnType<typeof parseReleaseTitle> }[] =
    [
      {
        title: "Movie.Title.2024.1080p.BluRay.x265.HDR10.DTS-HD-GROUP",
        exp: {
          resolution: 1080,
          source: "BluRay",
          codec: "x265",
          hdr: "HDR10",
          audio: "DTS-HD",
          group: "GROUP",
          isSample: false,
        },
      },
      {
        title: "Show.S01E01.2160p.WEB-DL.DV.H265-NTb",
        exp: {
          resolution: 2160,
          source: "WEB-DL",
          codec: "x265",
          hdr: "DV",
          audio: null,
          group: "NTb",
          isSample: false,
        },
      },
      {
        title: "Film.2023.720p.WEBRip.x264.AAC-RARBG",
        exp: {
          resolution: 720,
          source: "WEBRip",
          codec: "x264",
          hdr: null,
          audio: "AAC",
          group: "RARBG",
          isSample: false,
        },
      },
      {
        title: "Release.1080p.REMUX.AVC.DTS-X-FOO",
        exp: {
          resolution: 1080,
          source: "REMUX",
          codec: "x264",
          hdr: null,
          audio: "DTS-X",
          group: "FOO",
          isSample: false,
        },
      },
      {
        title: "4K.UHD.Movie.2022.HDR10+.TrueHD.Atmos-SPK",
        exp: {
          resolution: 2160,
          source: null,
          codec: null,
          hdr: "HDR10+",
          audio: "TrueHD Atmos",
          group: "SPK",
          isSample: false,
        },
      },
      {
        title: "HDTV.Show.S02E05.XviD.MP3-LOL",
        exp: {
          resolution: null,
          source: "HDTV",
          codec: "XviD",
          hdr: null,
          audio: "MP3",
          group: "LOL",
          isSample: false,
        },
      },
      {
        title: "DVDrip.Old.Film.480p.DivX.AC3-TEAM",
        exp: {
          resolution: 480,
          source: "DVDRip",
          codec: "DivX",
          hdr: null,
          audio: "AC3",
          group: "TEAM",
          isSample: false,
        },
      },
      {
        title: "Streaming.Title.1080p.WEB.EAC3.5.1-NF",
        exp: {
          resolution: 1080,
          source: "WEB",
          codec: null,
          hdr: null,
          audio: "EAC3",
          group: "NF",
          isSample: false,
        },
      },
      {
        title: "Sample.Movie.2021.1080p.BluRay.x264-GROUP",
        exp: {
          resolution: 1080,
          source: "BluRay",
          codec: "x264",
          hdr: null,
          audio: null,
          group: "GROUP",
          isSample: true,
        },
      },
      {
        title: "AV1.2024.1080p.WEB-DL.Opus-YIFY",
        exp: {
          resolution: 1080,
          source: "WEB-DL",
          codec: "AV1",
          hdr: null,
          audio: "Opus",
          group: "YIFY",
          isSample: false,
        },
      },
      {
        title: "BDRip.Movie.720p.H264.AAC-EXT",
        exp: {
          resolution: 720,
          source: "BluRay",
          codec: "x264",
          hdr: null,
          audio: "AAC",
          group: "EXT",
          isSample: false,
        },
      },
      {
        title: "BDREMUX.1080p.LPCM-FGT",
        exp: {
          resolution: 1080,
          source: "REMUX",
          codec: null,
          hdr: null,
          audio: "PCM",
          group: "FGT",
          isSample: false,
        },
      },
      {
        title: "WEBDL.NoHyphen.1080p.HEVC.DDP5.1-NTG",
        exp: {
          resolution: 1080,
          source: "WEB-DL",
          codec: "x265",
          hdr: null,
          audio: "EAC3",
          group: "NTG",
          isSample: false,
        },
      },
      {
        title: "Scene.P2P.2020.1080i.HDTV.MPEG2-DSR",
        exp: {
          resolution: 1080,
          source: "HDTV",
          codec: null,
          hdr: null,
          audio: null,
          group: "DSR",
          isSample: false,
        },
      },
      {
        title: "French.Release.1080p.WEB-DL.DDP5.1.H264-QTZ",
        exp: {
          resolution: 1080,
          source: "WEB-DL",
          codec: "x264",
          hdr: null,
          audio: "EAC3",
          group: "QTZ",
          isSample: false,
        },
      },
      {
        title: "Minimal-NoTechTokens",
        exp: {
          resolution: null,
          source: null,
          codec: null,
          hdr: null,
          audio: null,
          group: "NoTechTokens",
          isSample: false,
        },
      },
      {
        title: "HLG.Broadcast.1080p.HLG.H264-UKTV",
        exp: {
          resolution: 1080,
          source: null,
          codec: "x264",
          hdr: "HLG",
          audio: null,
          group: "UKTV",
          isSample: false,
        },
      },
      {
        title: "Dolby.Vision.Title.2160p.WEB-DL.DDP5.1.H265-SiC",
        exp: {
          resolution: 2160,
          source: "WEB-DL",
          codec: "x265",
          hdr: "DV",
          audio: "EAC3",
          group: "SiC",
          isSample: false,
        },
      },
      {
        title: "FLAC.Audiophile.1080p.BluRay.FLAC-PTer",
        exp: {
          resolution: 1080,
          source: "BluRay",
          codec: null,
          hdr: null,
          audio: "FLAC",
          group: "PTer",
          isSample: false,
        },
      },
      {
        title: "UHD.BluRay.2023.COMPLETE.BLURAY-CoRA",
        exp: {
          resolution: 2160,
          source: "BluRay",
          codec: null,
          hdr: null,
          audio: null,
          group: "CoRA",
          isSample: false,
        },
      },
      {
        title: "WEBRip.x265.1080p.EAC3-PSA",
        exp: {
          resolution: 1080,
          source: "WEBRip",
          codec: "x265",
          hdr: null,
          audio: "EAC3",
          group: "PSA",
          isSample: false,
        },
      },
    ];

  for (const { title, exp } of cases) {
    test(title.slice(0, 48), () => {
      expect(parseReleaseTitle(title)).toEqual(exp);
    });
  }
});
