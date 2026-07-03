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
  textBoxX: number;
  textBoxWidth: number;
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  phoneScale: number;
  phoneX: number;
  phoneY: number;
  phoneRotation: number;
  phoneWidthScale: number;
  phoneHeightScale: number;
  phoneCornerScale: number;
  textSpacing: number;
};
