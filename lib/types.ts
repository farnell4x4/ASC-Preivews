export type TextPosition = "top" | "bottom";
export type DeviceKind = "phone" | "tablet";
export type BackgroundMode = "solid" | "linear" | "advanced" | "radial";

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
  textBoxY: number;
  textBoxWidth: number;
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  backgroundMode: BackgroundMode;
  backgroundAccentColor: string;
  backgroundAngle: number;
  backgroundFlip: boolean;
  backgroundSpread: number;
  phoneScale: number;
  phoneX: number;
  phoneY: number;
  phoneRotation: number;
  phoneWidthScale: number;
  phoneHeightScale: number;
  phoneCornerScale: number;
  titleLineHeight: number;
  textSpacing: number;
};
