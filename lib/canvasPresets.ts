import type { CanvasPreset } from "@/lib/types";

export const canvasPresets: CanvasPreset[] = [
  { id: "phone-1242x2688", label: "1242 x 2688px", width: 1242, height: 2688, device: "phone" },
  { id: "phone-2688x1242", label: "2688 x 1242px", width: 2688, height: 1242, device: "phone" },
  { id: "phone-1284x2778", label: "1284 x 2778px", width: 1284, height: 2778, device: "phone" },
  { id: "phone-2778x1284", label: "2778 x 1284px", width: 2778, height: 1284, device: "phone" },
];

export const defaultPreset = canvasPresets[0];
