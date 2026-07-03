"use client";

import { drawEditorFrame } from "@/lib/exportImage";
import type { CanvasPreset, EditorState } from "@/lib/types";

const EXPORT_FPS = 30;

export async function exportStateAsVideo(preset: CanvasPreset, state: EditorState) {
  if (!state.uploadedMediaUrl) {
    throw new Error("Load a video before exporting.");
  }

  if (!("MediaRecorder" in window)) {
    throw new Error("This browser does not support local video export.");
  }

  const videoFormat = getSupportedVideoFormat();

  if (!videoFormat) {
    throw new Error("This browser cannot encode a local WebM or MP4 export.");
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
  const stream = canvas.captureStream(EXPORT_FPS);
  const recorder = new MediaRecorder(stream, {
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
    const frameDuration = 1 / EXPORT_FPS;
    const totalFrames = Math.max(1, Math.ceil(duration * EXPORT_FPS));

    for (let frame = 0; frame <= totalFrames; frame += 1) {
      const currentTime = Math.min(frame * frameDuration, duration);
      await seekVideo(video, currentTime);
      drawEditorFrame(context, preset, state, video, currentTime);
      await wait(frameDuration * 1000);
    }
  } finally {
    video.pause();
    recorder.stop();
    stream.getTracks().forEach((track) => track.stop());
  }

  const blob = await recordingDone;

  if (blob.size === 0) {
    throw new Error("Video export produced an empty file.");
  }

  return {
    blob,
    extension: videoFormat.extension,
    isAppleCompatible: videoFormat.isAppleCompatible,
    label: videoFormat.label,
  };
}

function getSupportedVideoFormat() {
  const candidates = [
    {
      mimeType: 'video/mp4;codecs="avc1.42E01E"',
      extension: "mp4",
      isAppleCompatible: true,
      label: "MP4",
    },
    {
      mimeType: "video/mp4;codecs=avc1.42E01E",
      extension: "mp4",
      isAppleCompatible: true,
      label: "MP4",
    },
    {
      mimeType: "video/mp4;codecs=h264",
      extension: "mp4",
      isAppleCompatible: true,
      label: "MP4",
    },
    {
      mimeType: "video/mp4",
      extension: "mp4",
      isAppleCompatible: true,
      label: "MP4",
    },
    {
      mimeType: "video/webm;codecs=vp9",
      extension: "webm",
      isAppleCompatible: false,
      label: "WebM",
    },
    {
      mimeType: "video/webm;codecs=vp8",
      extension: "webm",
      isAppleCompatible: false,
      label: "WebM",
    },
    {
      mimeType: "video/webm",
      extension: "webm",
      isAppleCompatible: false,
      label: "WebM",
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

function getVideoBitrate(preset: CanvasPreset) {
  const pixels = preset.width * preset.height;
  return Math.max(4_000_000, Math.min(20_000_000, pixels * 2.2));
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
