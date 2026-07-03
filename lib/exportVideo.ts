"use client";

import { drawEditorFrame } from "@/lib/exportImage";
import type { CanvasPreset, EditorState } from "@/lib/types";

const EXPORT_FPS = 30;
const MIN_APP_PREVIEW_DURATION_SECONDS = 15;
const MAX_APP_PREVIEW_DURATION_SECONDS = 30;

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

  const canvas = document.createElement("canvas");
  canvas.width = preset.width;
  canvas.height = preset.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create video export canvas.");
  }

  const video = await createExportVideoElement(state.uploadedMediaUrl);
  const duration = getSafeDuration(video.duration);
  validateAppPreviewDuration(duration);

  const stream = canvas.captureStream(EXPORT_FPS);
  const videoOnlyStream = new MediaStream(stream.getVideoTracks());
  const recorder = new MediaRecorder(videoOnlyStream, {
    mimeType: videoFormat.mimeType,
    videoBitsPerSecond: getVideoBitrate(preset),
  });
  const chunks: BlobPart[] = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  const recordingDone = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = (event) => {
      const errorEvent = event as ErrorEvent;
      reject(errorEvent.error ?? new Error("Unable to record video export."));
    };
    recorder.onstop = () => resolve(new Blob(chunks, { type: videoFormat.mimeType }));
  });

  recorder.start();

  try {
    await renderRealtimeVideoExport(video, context, preset, state, duration);
  } finally {
    video.pause();
    recorder.stop();
    stream.getTracks().forEach((track) => track.stop());
    videoOnlyStream.getTracks().forEach((track) => track.stop());
  }

  const blob = await recordingDone;

  if (blob.size === 0) {
    throw new Error("Video export produced an empty file.");
  }

  return {
    blob,
    extension: videoFormat.extension,
    label: videoFormat.label,
  };
}

function getSupportedVideoFormat() {
  const candidates = [
    {
      mimeType: 'video/mp4;codecs="avc1.640028"',
      extension: "mp4",
      label: "H.264 MP4",
    },
    {
      mimeType: 'video/mp4;codecs="avc1.4D4028"',
      extension: "mp4",
      label: "H.264 MP4",
    },
    {
      mimeType: 'video/mp4;codecs="avc1.42C028"',
      extension: "mp4",
      label: "H.264 MP4",
    },
    {
      mimeType: 'video/mp4;codecs="avc1.42E01E"',
      extension: "mp4",
      label: "H.264 MP4",
    },
    {
      mimeType: "video/mp4;codecs=avc1.42E01E",
      extension: "mp4",
      label: "H.264 MP4",
    },
    {
      mimeType: "video/mp4;codecs=h264",
      extension: "mp4",
      label: "H.264 MP4",
    },
    {
      mimeType: "video/mp4",
      extension: "mp4",
      label: "H.264 MP4",
    },
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate.mimeType)) ?? null;
}

function createExportVideoElement(src: string) {
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

async function renderRealtimeVideoExport(
  video: HTMLVideoElement,
  context: CanvasRenderingContext2D,
  preset: CanvasPreset,
  state: EditorState,
  duration: number,
) {
  video.playbackRate = 1;
  await seekVideo(video, 0);
  drawEditorFrame(context, preset, state, video, 0);

  const playbackDone = new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve();
    }, (duration + 2) * 1000);

    const handleEnded = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Unable to render the full video export."));
    };
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("error", handleError);
    };

    video.addEventListener("ended", handleEnded, { once: true });
    video.addEventListener("error", handleError, { once: true });
  });

  const drawPlaybackFrame = () => {
    drawEditorFrame(context, preset, state, video, Math.min(video.currentTime, duration));

    if (!video.paused && !video.ended) {
      window.requestAnimationFrame(drawPlaybackFrame);
    }
  };

  await video.play();
  drawPlaybackFrame();
  await playbackDone;
  drawEditorFrame(context, preset, state, video, duration);
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
