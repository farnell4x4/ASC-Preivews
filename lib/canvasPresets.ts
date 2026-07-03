import type { CanvasPreset } from "@/lib/types";

export const imageCanvasPresets: CanvasPreset[] = [
  { id: "phone-1242x2688", label: "1242 x 2688px", width: 1242, height: 2688, device: "phone" },
  { id: "phone-2688x1242", label: "2688 x 1242px", width: 2688, height: 1242, device: "phone" },
  { id: "phone-1284x2778", label: "1284 x 2778px", width: 1284, height: 2778, device: "phone" },
  { id: "phone-2778x1284", label: "2778 x 1284px", width: 2778, height: 1284, device: "phone" },
];

export const videoCanvasPresets: CanvasPreset[] = [
  { id: "video-886x1920", label: "886 x 1920px", width: 886, height: 1920, device: "phone" },
  { id: "video-1920x886", label: "1920 x 886px", width: 1920, height: 886, device: "phone" },
];

export const canvasPresets: CanvasPreset[] = [...imageCanvasPresets, ...videoCanvasPresets];

export const defaultPreset = imageCanvasPresets[0];
export const defaultVideoPreset = videoCanvasPresets[0];
