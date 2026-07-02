export type TextPosition = "top" | "bottom";
export type DeviceKind = "phone" | "tablet";

export type CanvasPreset = {
  id: string;
  label: string;
  width: number;
  height: number;
  device: DeviceKind;
};

export type EditorState = {
  selectedPresetId: string;
  uploadedScreenshotUrl: string | null;
  headline: string;
  subtitle: string;
  textPosition: TextPosition;
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  phoneScale: number;
  phoneY: number;
  textSpacing: number;
};
