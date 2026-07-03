import type { CanvasPreset, EditorState } from "@/lib/types";

export function computeCanvasLayout(
  preset: CanvasPreset,
  state: EditorState,
  renderScale = 1,
) {
  const isTop = state.textPosition === "top";
  const canvasWidthPx = preset.width * renderScale;
  const canvasHeightPx = preset.height * renderScale;
  const topPad = preset.height * renderScale * 0.072;
  const bottomPad = preset.height * renderScale * 0.078;
  const textBoxLeftPx = (state.textBoxX / 100) * canvasWidthPx;
  const textBoxOffsetYPx = (state.textBoxY / 100) * canvasHeightPx;
  const textBoxWidthPx = (state.textBoxWidth / 100) * canvasWidthPx;
  const titleSize = state.fontSize * renderScale;
  const subtitleSize = Math.max(state.fontSize * 0.36, 34) * renderScale;
  const gapSize = state.textSpacing * renderScale;
  const basePhoneWidthPercent = preset.device === "tablet" ? 56 : 62;
  const deviceAspect = preset.device === "tablet" ? 0.78 : 0.49;
  const basePhoneWidthPx = canvasWidthPx * (basePhoneWidthPercent / 100) * state.phoneScale;
  const phoneWidthPx = basePhoneWidthPx * state.phoneWidthScale;
  const basePhoneHeightPx = basePhoneWidthPx / deviceAspect;
  const phoneHeightPx = basePhoneHeightPx * state.phoneHeightScale;

  return {
    isTop,
    canvasWidthPx,
    canvasHeightPx,
    topPad,
    bottomPad,
    textBoxLeftPx,
    textBoxOffsetYPx,
    textBoxWidthPx,
    titleSize,
    subtitleSize,
    gapSize,
    basePhoneWidthPx,
    basePhoneHeightPx,
    phoneWidthPx,
    phoneHeightPx,
    phoneCenterXPx: (state.phoneX / 100) * canvasWidthPx,
    phoneCenterYPx: (state.phoneY / 100) * canvasHeightPx,
  };
}
