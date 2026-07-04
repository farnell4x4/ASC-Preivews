"use client";

import { drawEditorFrame } from "@/lib/exportImage";
import type { CanvasPreset, EditorState } from "@/lib/types";

const EXPORT_FPS = 30;
const EXPORT_FRAME_DURATION_MS = 1000 / EXPORT_FPS;
const END_OF_VIDEO_CUE_EPSILON_SECONDS = 0.001;
const MAX_SOURCE_VIDEO_DRIFT_SECONDS = 0.075;
const MIN_APP_PREVIEW_DURATION_SECONDS = 15;
const MAX_APP_PREVIEW_DURATION_SECONDS = 30;
const MAX_APP_PREVIEW_FILE_BYTES = 500 * 1024 * 1024;
const AUDIO_SAMPLE_RATE = 44_100;
const AUDIO_BITRATE = 256_000;

type VideoFormat = {
  mimeType: string;
  extension: string;
  label: string;
};

type SilentAudioTrack = {
  track: MediaStreamTrack;
  close: () => Promise<void>;
};

type RecorderSession = {
  done: Promise<Blob>;
  requestFrame: () => void;
  stop: () => void;
  close: () => Promise<void>;
};

type ManualCanvasCaptureTrack = MediaStreamTrack & {
  requestFrame?: () => void;
};

export async function exportStateAsVideo(preset: CanvasPreset, state: EditorState) {
  if (!state.uploadedMediaUrl) {
    throw new Error("Load a video before exporting.");
  }

  if (!("MediaRecorder" in window)) {
    throw new Error("This browser does not support local video export.");
  }

  const videoFormat = getSupportedVideoFormat();

  if (!videoFormat) {
    throw new Error("This browser cannot encode an App Store Connect-ready H.264 MP4.");
  }

  const { canvas, context } = createExportCanvas(preset);
  const video = await loadExportVideo(state.uploadedMediaUrl);
  const duration = getSafeDuration(video.duration);
  validateAppPreviewDuration(duration);
  await drawInitialExportFrame(video, context, preset, state, duration);

  const recorder = await createRecorderSession(canvas, preset, videoFormat);
  let renderError: unknown = null;

  try {
    await renderSourceVideoToCanvas({
      video,
      context,
      preset,
      state,
      duration,
      requestFrame: recorder.requestFrame,
    });
  } catch (error) {
    renderError = error;
  } finally {
    video.pause();
    recorder.stop();
  }

  const blob = await recorder.done.finally(() => recorder.close());

  if (renderError) {
    throw renderError;
  }

  await validateFinishedExport(blob, preset, duration);

  return {
    blob,
    extension: videoFormat.extension,
    label: videoFormat.label,
  };
}

function createExportCanvas(preset: CanvasPreset) {
  const canvas = document.createElement("canvas");
  canvas.width = preset.width;
  canvas.height = preset.height;

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    throw new Error("Unable to create video export canvas.");
  }

  return { canvas, context };
}

async function createRecorderSession(
  canvas: HTMLCanvasElement,
  preset: CanvasPreset,
  videoFormat: VideoFormat,
): Promise<RecorderSession> {
  const canvasStream = canvas.captureStream(0);
  const [canvasVideoTrack] = canvasStream.getVideoTracks() as ManualCanvasCaptureTrack[];

  if (!canvasVideoTrack?.requestFrame) {
    canvasStream.getTracks().forEach((track) => track.stop());
    throw new Error("This browser cannot manually capture canvas frames for video export.");
  }

  const silentAudio = await createSilentAudioTrack();
  let exportStream: MediaStream | null = null;
  let recorder: MediaRecorder;

  try {
    exportStream = new MediaStream([canvasVideoTrack, silentAudio.track]);
    recorder = new MediaRecorder(exportStream, {
      mimeType: videoFormat.mimeType,
      audioBitsPerSecond: AUDIO_BITRATE,
      videoBitsPerSecond: getVideoBitrate(preset),
    });
  } catch (error) {
    canvasStream.getTracks().forEach((track) => track.stop());
    exportStream?.getTracks().forEach((track) => track.stop());
    await silentAudio.close();
    throw error;
  }

  const chunks: BlobPart[] = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = (event) => {
      const errorEvent = event as ErrorEvent;
      reject(errorEvent.error ?? new Error("Unable to record video export."));
    };
    recorder.onstop = () => resolve(new Blob(chunks, { type: videoFormat.mimeType }));
  });

  recorder.start();

  return {
    done,
    requestFrame: () => canvasVideoTrack.requestFrame?.(),
    stop: () => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    },
    close: async () => {
      canvasStream.getTracks().forEach((track) => track.stop());
      exportStream.getTracks().forEach((track) => track.stop());
      await silentAudio.close();
    },
  };
}

async function validateFinishedExport(blob: Blob, preset: CanvasPreset, duration: number) {
  if (blob.size === 0) {
    throw new Error("Video export produced an empty file.");
  }

  if (blob.size > MAX_APP_PREVIEW_FILE_BYTES) {
    throw new Error("Video export is over Apple's 500 MB App Preview limit.");
  }

  await validateAppPreviewExport(blob, preset, duration);
}

function getSupportedVideoFormat(): VideoFormat | null {
  const candidates = [
    {
      mimeType: 'video/mp4;codecs="avc1.640028,mp4a.40.2"',
      extension: "mp4",
      label: "H.264 MP4 with silent AAC audio",
    },
    {
      mimeType: 'video/mp4;codecs="avc1.4D4028,mp4a.40.2"',
      extension: "mp4",
      label: "H.264 MP4 with silent AAC audio",
    },
    {
      mimeType: 'video/mp4;codecs="avc1.42C028,mp4a.40.2"',
      extension: "mp4",
      label: "H.264 MP4 with silent AAC audio",
    },
    {
      mimeType: 'video/mp4;codecs="avc1.42E01E, mp4a.40.2"',
      extension: "mp4",
      label: "H.264 MP4 with silent AAC audio",
    },
    {
      mimeType: 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
      extension: "mp4",
      label: "H.264 MP4 with silent AAC audio",
    },
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate.mimeType)) ?? null;
}

async function createSilentAudioTrack(): Promise<SilentAudioTrack> {
  const audioContext = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
  const left = audioContext.createConstantSource();
  const right = audioContext.createConstantSource();
  const leftGain = audioContext.createGain();
  const rightGain = audioContext.createGain();
  const merger = audioContext.createChannelMerger(2);
  const destination = audioContext.createMediaStreamDestination();

  leftGain.gain.value = 0;
  rightGain.gain.value = 0;
  left.connect(leftGain).connect(merger, 0, 0);
  right.connect(rightGain).connect(merger, 0, 1);
  merger.connect(destination);
  left.start();
  right.start();
  await audioContext.resume();

  const [track] = destination.stream.getAudioTracks();
  if (!track) {
    await audioContext.close();
    throw new Error("Unable to create silent AAC audio for the App Preview export.");
  }

  return {
    track,
    close: async () => {
      left.stop();
      right.stop();
      track.stop();
      await audioContext.close();
    },
  };
}

function loadExportVideo(src: string) {
  return new Promise<HTMLVideoElement>((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = src;

    video.onloadedmetadata = () => resolve(video);
    video.onerror = () => reject(new Error("Unable to load the video for export."));
  });
}

async function renderSourceVideoToCanvas({
  video,
  context,
  preset,
  state,
  duration,
  requestFrame,
}: {
  video: HTMLVideoElement;
  context: CanvasRenderingContext2D;
  preset: CanvasPreset;
  state: EditorState;
  duration: number;
  requestFrame: () => void;
}) {
  video.pause();
  video.playbackRate = 1;

  const frameCount = Math.ceil(duration * EXPORT_FPS);
  const startedAt = performance.now();
  requestFrame();

  await startSourcePlayback(video);

  for (let frameIndex = 1; frameIndex < frameCount; frameIndex += 1) {
    await waitUntil(startedAt + frameIndex * EXPORT_FRAME_DURATION_MS);

    const mediaTime = Math.min(frameIndex / EXPORT_FPS, getLatestDecodableVideoTime(duration));
    await correctSourceVideoTime(video, mediaTime);
    drawExportFrame(context, preset, state, video, mediaTime, duration);
    requestFrame();
  }

  await waitUntil(startedAt + duration * 1000);
  video.pause();

  const finalTime = getLatestDecodableVideoTime(duration);
  await seekVideo(video, finalTime);
  drawExportFrame(context, preset, state, video, finalTime, duration);
  requestFrame();
  await waitUntil(startedAt + duration * 1000);
}

async function drawInitialExportFrame(
  video: HTMLVideoElement,
  context: CanvasRenderingContext2D,
  preset: CanvasPreset,
  state: EditorState,
  duration: number,
) {
  video.pause();
  video.playbackRate = 1;
  await seekVideo(video, 0);
  drawExportFrame(context, preset, state, video, 0, duration);
}

async function startSourcePlayback(video: HTMLVideoElement) {
  try {
    await video.play();
  } catch {
    video.pause();
  }
}

async function correctSourceVideoTime(video: HTMLVideoElement, mediaTime: number) {
  const drift = Math.abs(video.currentTime - mediaTime);

  if (!video.ended && drift <= MAX_SOURCE_VIDEO_DRIFT_SECONDS) {
    return;
  }

  const shouldResume = !video.paused || video.ended;
  video.pause();
  await seekVideo(video, mediaTime);

  if (shouldResume) {
    await startSourcePlayback(video);
  }
}

function drawExportFrame(
  context: CanvasRenderingContext2D,
  preset: CanvasPreset,
  state: EditorState,
  video: HTMLVideoElement,
  mediaTime: number,
  duration: number,
) {
  drawEditorFrame(context, preset, state, video, getTimelineRenderTime(mediaTime, duration));
}

function getTimelineRenderTime(mediaTime: number, duration: number) {
  const safeMediaTime = Number.isFinite(mediaTime) ? mediaTime : 0;
  const latestCueTime = Math.max(0, duration - END_OF_VIDEO_CUE_EPSILON_SECONDS);
  return Math.min(Math.max(safeMediaTime, 0), latestCueTime);
}

function getLatestDecodableVideoTime(duration: number) {
  return Math.max(0, duration - END_OF_VIDEO_CUE_EPSILON_SECONDS);
}

function seekVideo(video: HTMLVideoElement, currentTime: number) {
  return new Promise<void>((resolve, reject) => {
    const targetTime = Math.min(Math.max(currentTime, 0), getSafeDuration(video.duration));

    if (Math.abs(video.currentTime - targetTime) < 0.001 && video.readyState >= 2) {
      window.requestAnimationFrame(() => resolve());
      return;
    }

    const handleSeeked = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Unable to render a video frame."));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
    };

    video.addEventListener("seeked", handleSeeked, { once: true });
    video.addEventListener("error", handleError, { once: true });
    video.currentTime = targetTime;
  });
}

function getSafeDuration(duration: number) {
  return Number.isFinite(duration) && duration > 0 ? duration : 1;
}

function validateAppPreviewDuration(duration: number) {
  if (duration < MIN_APP_PREVIEW_DURATION_SECONDS || duration > MAX_APP_PREVIEW_DURATION_SECONDS) {
    throw new Error(
      `App Preview videos must be ${MIN_APP_PREVIEW_DURATION_SECONDS}-${MAX_APP_PREVIEW_DURATION_SECONDS} seconds. This video is ${formatDuration(duration)}.`,
    );
  }
}

function formatDuration(duration: number) {
  return `${Math.round(duration * 10) / 10}s`;
}

function getVideoBitrate(preset: CanvasPreset) {
  const pixels = preset.width * preset.height;
  return Math.max(4_000_000, Math.min(20_000_000, pixels * 2.2));
}

function waitUntil(targetTime: number) {
  const delay = targetTime - performance.now();

  if (delay <= 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, delay);
  });
}

async function validateAppPreviewExport(blob: Blob, preset: CanvasPreset, expectedDuration: number) {
  const arrayBuffer = await blob.arrayBuffer();
  const view = new DataView(arrayBuffer);
  const topLevelBoxes = readBoxes(view, 0, view.byteLength);
  const ftypBox = topLevelBoxes.find((box) => box.type === "ftyp");
  const moovBox = topLevelBoxes.find((box) => box.type === "moov");
  const mdatBox = topLevelBoxes.find((box) => box.type === "mdat");

  if (!ftypBox || !moovBox || !mdatBox) {
    throw new Error("Export validation failed: file is not a complete MP4.");
  }

  const movieBoxes = readBoxes(view, moovBox.contentStart, moovBox.end);
  const videoTrack = findTrack(view, movieBoxes, "vide");
  const audioTrack = findTrack(view, movieBoxes, "soun");

  if (!videoTrack) {
    throw new Error("Export validation failed: MP4 is missing an H.264 video stream.");
  }

  if (!audioTrack) {
    throw new Error("Export validation failed: MP4 is missing the silent AAC stereo audio stream.");
  }

  const videoSample = videoTrack.sampleEntries.find((entry) => entry.type === "avc1" || entry.type === "avc3");
  if (!videoSample) {
    const hevcSample = videoTrack.sampleEntries.find((entry) => entry.type === "hvc1" || entry.type === "hev1");
    throw new Error(
      hevcSample
        ? "Export validation failed: video encoded as HEVC instead of H.264."
        : "Export validation failed: video stream is not H.264.",
    );
  }

  if (videoSample.width !== preset.width || videoSample.height !== preset.height) {
    throw new Error(
      `Export validation failed: video is ${videoSample.width}x${videoSample.height}, expected ${preset.width}x${preset.height}.`,
    );
  }

  const avcConfig = videoSample.children.find((child) => child.type === "avcC");
  if (!avcConfig) {
    throw new Error("Export validation failed: H.264 stream is missing codec metadata.");
  }

  const h264 = readAvcConfig(view, avcConfig);

  if (!h264.isYuv420p) {
    throw new Error("Export validation failed: H.264 stream is not yuv420p.");
  }

  if (!h264.isProgressive) {
    throw new Error("Export validation failed: video stream is interlaced, not progressive.");
  }

  if (!h264.hasSquarePixels) {
    throw new Error("Export validation failed: video stream does not use square pixels / SAR 1:1.");
  }

  const fps = videoTrack.frameRate;
  if (fps && Math.abs(fps - EXPORT_FPS) > 0.01) {
    throw new Error(`Export validation failed: video fps is ${formatNumber(fps)}, expected 30.`);
  }

  const duration = videoTrack.duration || expectedDuration;
  validateAppPreviewDuration(duration);
  if (Math.abs(duration - expectedDuration) > 0.5) {
    throw new Error("Export validation failed: encoded duration does not match the rendered preview duration.");
  }

  const audioSample = audioTrack.sampleEntries.find((entry) => entry.type === "mp4a");
  if (!audioSample) {
    throw new Error("Export validation failed: audio stream is not AAC.");
  }

  const esdsBox = audioSample.children.find((child) => child.type === "esds");
  if (!esdsBox || !isAacEsds(view, esdsBox)) {
    throw new Error("Export validation failed: audio stream is not AAC.");
  }

  if (audioSample.channelCount !== 2) {
    throw new Error("Export validation failed: audio stream is not stereo.");
  }

  if (audioSample.sampleRate !== AUDIO_SAMPLE_RATE) {
    throw new Error("Export validation failed: audio sample rate is not 44.1 kHz.");
  }
}

type Mp4Box = {
  type: string;
  start: number;
  contentStart: number;
  end: number;
};

type SampleEntry = {
  type: string;
  width?: number;
  height?: number;
  channelCount?: number;
  sampleRate?: number;
  children: Mp4Box[];
};

type TrackInfo = {
  duration: number | null;
  frameRate: number | null;
  sampleEntries: SampleEntry[];
};

function readBoxes(view: DataView, start: number, end: number) {
  const boxes: Mp4Box[] = [];
  let offset = start;

  while (offset + 8 <= end) {
    const size32 = view.getUint32(offset);
    const type = readAscii(view, offset + 4, 4);
    let headerSize = 8;
    let size = size32;

    if (size32 === 1) {
      if (offset + 16 > end) {
        break;
      }
      size = Number(view.getBigUint64(offset + 8));
      headerSize = 16;
    } else if (size32 === 0) {
      size = end - offset;
    }

    if (size < headerSize || offset + size > end) {
      break;
    }

    boxes.push({
      type,
      start: offset,
      contentStart: offset + headerSize,
      end: offset + size,
    });
    offset += size;
  }

  return boxes;
}

function findTrack(view: DataView, movieBoxes: Mp4Box[], handlerType: "vide" | "soun") {
  for (const trakBox of movieBoxes.filter((box) => box.type === "trak")) {
    const trackBoxes = readBoxes(view, trakBox.contentStart, trakBox.end);
    const mdiaBox = trackBoxes.find((box) => box.type === "mdia");
    if (!mdiaBox) {
      continue;
    }

    const mediaBoxes = readBoxes(view, mdiaBox.contentStart, mdiaBox.end);
    const hdlrBox = mediaBoxes.find((box) => box.type === "hdlr");
    if (!hdlrBox || readAscii(view, hdlrBox.contentStart + 8, 4) !== handlerType) {
      continue;
    }

    const mdhdBox = mediaBoxes.find((box) => box.type === "mdhd");
    const mediaDuration = mdhdBox ? readMediaDuration(view, mdhdBox) : null;
    const stblBox = findBoxPath(view, mediaBoxes, ["minf", "stbl"]);
    const sampleEntries = stblBox ? readSampleEntries(view, stblBox) : [];
    const frameRate =
      handlerType === "vide" && stblBox && mediaDuration?.timescale
        ? readConstantFrameRate(view, stblBox, mediaDuration.timescale)
        : null;

    return {
      duration: mediaDuration ? mediaDuration.duration / mediaDuration.timescale : null,
      frameRate,
      sampleEntries,
    };
  }

  return null;
}

function findBoxPath(view: DataView, boxes: Mp4Box[], path: string[]): Mp4Box | null {
  let currentBoxes = boxes;
  let currentBox: Mp4Box | null = null;

  for (const type of path) {
    currentBox = currentBoxes.find((box) => box.type === type) ?? null;
    if (!currentBox) {
      return null;
    }
    currentBoxes = readBoxes(view, currentBox.contentStart, currentBox.end);
  }

  return currentBox;
}

function readMediaDuration(view: DataView, mdhdBox: Mp4Box) {
  const version = view.getUint8(mdhdBox.contentStart);
  if (version === 1) {
    const timescale = view.getUint32(mdhdBox.contentStart + 20);
    const duration = Number(view.getBigUint64(mdhdBox.contentStart + 24));
    return { timescale, duration };
  }

  const timescale = view.getUint32(mdhdBox.contentStart + 12);
  const duration = view.getUint32(mdhdBox.contentStart + 16);
  return { timescale, duration };
}

function readSampleEntries(view: DataView, stblBox: Mp4Box) {
  const stsdBox = readBoxes(view, stblBox.contentStart, stblBox.end).find((box) => box.type === "stsd");
  if (!stsdBox) {
    return [];
  }

  const entryCount = view.getUint32(stsdBox.contentStart + 4);
  const entries: SampleEntry[] = [];
  let offset = stsdBox.contentStart + 8;

  for (let index = 0; index < entryCount && offset + 8 <= stsdBox.end; index += 1) {
    const size = view.getUint32(offset);
    const type = readAscii(view, offset + 4, 4);
    const contentStart = offset + 8;
    const end = offset + size;

    if (size < 8 || end > stsdBox.end) {
      break;
    }

    if (type === "avc1" || type === "avc3" || type === "hvc1" || type === "hev1") {
      entries.push({
        type,
        width: view.getUint16(contentStart + 24),
        height: view.getUint16(contentStart + 26),
        children: readBoxes(view, contentStart + 78, end),
      });
    } else if (type === "mp4a") {
      entries.push({
        type,
        channelCount: view.getUint16(contentStart + 16),
        sampleRate: view.getUint32(contentStart + 24) >>> 16,
        children: readBoxes(view, contentStart + 28, end),
      });
    } else {
      entries.push({ type, children: [] });
    }

    offset = end;
  }

  return entries;
}

function readConstantFrameRate(view: DataView, stblBox: Mp4Box, timescale: number) {
  const sttsBox = readBoxes(view, stblBox.contentStart, stblBox.end).find((box) => box.type === "stts");
  if (!sttsBox || timescale <= 0) {
    return null;
  }

  const entryCount = view.getUint32(sttsBox.contentStart + 4);
  let offset = sttsBox.contentStart + 8;
  let sampleDelta: number | null = null;

  for (let index = 0; index < entryCount && offset + 8 <= sttsBox.end; index += 1) {
    const count = view.getUint32(offset);
    const delta = view.getUint32(offset + 4);
    if (count > 0) {
      if (sampleDelta !== null && sampleDelta !== delta) {
        return null;
      }
      sampleDelta = delta;
    }
    offset += 8;
  }

  return sampleDelta ? timescale / sampleDelta : null;
}

function readAvcConfig(view: DataView, avcConfigBox: Mp4Box) {
  const profileIdc = view.getUint8(avcConfigBox.contentStart + 1);
  const levelIdc = view.getUint8(avcConfigBox.contentStart + 3);
  const spsCount = view.getUint8(avcConfigBox.contentStart + 5) & 0x1f;
  if (spsCount < 1) {
    throw new Error("Export validation failed: H.264 stream is missing SPS metadata.");
  }

  const spsLength = view.getUint16(avcConfigBox.contentStart + 6);
  const spsStart = avcConfigBox.contentStart + 8;
  const spsBytes = new Uint8Array(view.buffer, view.byteOffset + spsStart, spsLength);
  const sps = readH264Sps(spsBytes);

  return {
    profileIdc,
    levelIdc,
    isYuv420p: sps.chromaFormatIdc === 1 && sps.bitDepthLumaMinus8 === 0 && sps.bitDepthChromaMinus8 === 0,
    isProgressive: sps.frameMbsOnlyFlag,
    hasSquarePixels: sps.sarWidth === sps.sarHeight,
  };
}

function readH264Sps(spsBytes: Uint8Array) {
  const rbsp = removeEmulationPreventionBytes(spsBytes.slice(1));
  const reader = new BitReader(rbsp);
  const profileIdc = reader.readBits(8);
  reader.readBits(8);
  reader.readBits(8);
  reader.readUnsignedExpGolomb();

  let chromaFormatIdc = 1;
  let bitDepthLumaMinus8 = 0;
  let bitDepthChromaMinus8 = 0;

  if ([100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135].includes(profileIdc)) {
    chromaFormatIdc = reader.readUnsignedExpGolomb();
    if (chromaFormatIdc === 3) {
      reader.readBits(1);
    }
    bitDepthLumaMinus8 = reader.readUnsignedExpGolomb();
    bitDepthChromaMinus8 = reader.readUnsignedExpGolomb();
    reader.readBits(1);
    if (reader.readBits(1) === 1) {
      const scalingListCount = chromaFormatIdc !== 3 ? 8 : 12;
      for (let index = 0; index < scalingListCount; index += 1) {
        if (reader.readBits(1) === 1) {
          skipScalingList(reader, index < 6 ? 16 : 64);
        }
      }
    }
  }

  reader.readUnsignedExpGolomb();
  const picOrderCntType = reader.readUnsignedExpGolomb();
  if (picOrderCntType === 0) {
    reader.readUnsignedExpGolomb();
  } else if (picOrderCntType === 1) {
    reader.readBits(1);
    reader.readSignedExpGolomb();
    reader.readSignedExpGolomb();
    const cycleCount = reader.readUnsignedExpGolomb();
    for (let index = 0; index < cycleCount; index += 1) {
      reader.readSignedExpGolomb();
    }
  }

  reader.readUnsignedExpGolomb();
  reader.readBits(1);
  reader.readUnsignedExpGolomb();
  reader.readUnsignedExpGolomb();
  const frameMbsOnlyFlag = reader.readBits(1) === 1;
  if (!frameMbsOnlyFlag) {
    reader.readBits(1);
  }
  reader.readBits(1);

  if (reader.readBits(1) === 1) {
    reader.readUnsignedExpGolomb();
    reader.readUnsignedExpGolomb();
    reader.readUnsignedExpGolomb();
    reader.readUnsignedExpGolomb();
  }

  let sarWidth = 1;
  let sarHeight = 1;

  if (reader.hasMoreData() && reader.readBits(1) === 1 && reader.hasMoreData() && reader.readBits(1) === 1) {
    const aspectRatioIdc = reader.readBits(8);
    if (aspectRatioIdc === 255) {
      sarWidth = reader.readBits(16);
      sarHeight = reader.readBits(16);
    } else {
      [sarWidth, sarHeight] = getSampleAspectRatio(aspectRatioIdc);
    }
  }

  return {
    chromaFormatIdc,
    bitDepthLumaMinus8,
    bitDepthChromaMinus8,
    frameMbsOnlyFlag,
    sarWidth,
    sarHeight,
  };
}

function isAacEsds(view: DataView, esdsBox: Mp4Box) {
  return hasAacDescriptor(view, esdsBox.contentStart + 4, esdsBox.end);
}

function hasAacDescriptor(view: DataView, start: number, end: number): boolean {
  let offset = start;

  while (offset + 2 < end) {
    const tag = view.getUint8(offset);
    offset += 1;
    const sizeInfo = readDescriptorSize(view, offset);
    const contentStart = sizeInfo.offset;
    const contentEnd = Math.min(contentStart + sizeInfo.size, end);

    if (tag === 0x04) {
      return contentStart < contentEnd && view.getUint8(contentStart) === 0x40;
    }

    const nestedStart = tag === 0x03 ? Math.min(contentStart + 3, contentEnd) : contentStart;
    if (hasAacDescriptor(view, nestedStart, contentEnd)) {
      return true;
    }

    offset = contentEnd;
  }

  return false;
}

function readDescriptorSize(view: DataView, offset: number) {
  let size = 0;
  let nextOffset = offset;

  for (let index = 0; index < 4; index += 1) {
    const value = view.getUint8(nextOffset);
    nextOffset += 1;
    size = (size << 7) | (value & 0x7f);
    if ((value & 0x80) === 0) {
      break;
    }
  }

  return { size, offset: nextOffset };
}

function removeEmulationPreventionBytes(bytes: Uint8Array) {
  const output: number[] = [];
  for (let index = 0; index < bytes.length; index += 1) {
    if (index >= 2 && bytes[index] === 0x03 && bytes[index - 1] === 0x00 && bytes[index - 2] === 0x00) {
      continue;
    }
    output.push(bytes[index]);
  }
  return new Uint8Array(output);
}

function skipScalingList(reader: BitReader, size: number) {
  let lastScale = 8;
  let nextScale = 8;

  for (let index = 0; index < size; index += 1) {
    if (nextScale !== 0) {
      const deltaScale = reader.readSignedExpGolomb();
      nextScale = (lastScale + deltaScale + 256) % 256;
    }
    lastScale = nextScale === 0 ? lastScale : nextScale;
  }
}

function getSampleAspectRatio(aspectRatioIdc: number) {
  const ratios: Record<number, [number, number]> = {
    1: [1, 1],
    2: [12, 11],
    3: [10, 11],
    4: [16, 11],
    5: [40, 33],
    6: [24, 11],
    7: [20, 11],
    8: [32, 11],
    9: [80, 33],
    10: [18, 11],
    11: [15, 11],
    12: [64, 33],
    13: [160, 99],
    14: [4, 3],
    15: [3, 2],
    16: [2, 1],
  };

  return ratios[aspectRatioIdc] ?? [1, 1];
}

function readAscii(view: DataView, offset: number, length: number) {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(view.getUint8(offset + index));
  }
  return value;
}

function formatNumber(value: number) {
  return `${Math.round(value * 100) / 100}`;
}

class BitReader {
  private bitOffset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  hasMoreData() {
    return this.bitOffset < this.bytes.length * 8;
  }

  readBits(length: number) {
    let value = 0;
    for (let index = 0; index < length; index += 1) {
      const byte = this.bytes[this.bitOffset >> 3] ?? 0;
      const bit = (byte >> (7 - (this.bitOffset & 7))) & 1;
      value = (value << 1) | bit;
      this.bitOffset += 1;
    }
    return value;
  }

  readUnsignedExpGolomb() {
    let leadingZeroBits = 0;
    while (this.hasMoreData() && this.readBits(1) === 0) {
      leadingZeroBits += 1;
    }
    return (1 << leadingZeroBits) - 1 + (leadingZeroBits > 0 ? this.readBits(leadingZeroBits) : 0);
  }

  readSignedExpGolomb() {
    const value = this.readUnsignedExpGolomb();
    return value % 2 === 0 ? -(value / 2) : (value + 1) / 2;
  }
}
