import type { CanvasPreset } from "@/lib/types";

export const canvasPresets: CanvasPreset[] = [
  { id: "iphone-6-9", label: 'iPhone 6.9"', width: 1290, height: 2796, device: "phone" },
  { id: "iphone-6-7", label: 'iPhone 6.7"', width: 1290, height: 2796, device: "phone" },
  { id: "iphone-6-5", label: 'iPhone 6.5"', width: 1242, height: 2688, device: "phone" },
  { id: "iphone-5-5", label: 'iPhone 5.5"', width: 1242, height: 2208, device: "phone" },
  { id: "ipad-13", label: 'iPad 13"', width: 2064, height: 2752, device: "tablet" },
  { id: "ipad-12-9", label: 'iPad 12.9"', width: 2048, height: 2732, device: "tablet" },
];

export const defaultPreset = canvasPresets[0];
