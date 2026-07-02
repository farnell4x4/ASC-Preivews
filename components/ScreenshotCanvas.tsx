import { PhoneMockup } from "@/components/PhoneMockup";
import type { CanvasPreset, EditorState } from "@/lib/types";

type ScreenshotCanvasProps = {
  preset: CanvasPreset;
  state: EditorState;
  exportMode?: boolean;
};

export function ScreenshotCanvas({
  preset,
  state,
  exportMode = false,
}: ScreenshotCanvasProps) {
  const isTop = state.textPosition === "top";
  const paddingX = exportMode ? 88 : 24;
  const topPad = exportMode ? 96 : 26;
  const bottomPad = exportMode ? 104 : 28;
  const titleSize = exportMode ? state.fontSize : state.fontSize / 3.4;
  const subtitleSize = exportMode ? Math.max(state.fontSize * 0.36, 34) : Math.max(state.fontSize / 8.5, 12);
  const gapSize = exportMode ? state.textSpacing : Math.max(state.textSpacing / 3.2, 8);
  const phoneWidthPercent =
    (preset.device === "tablet" ? 56 : 62) * state.phoneScale;
  const phoneTranslateY = `${state.phoneY}%`;

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        backgroundColor: state.backgroundColor,
      }}
    >
      <div
        className={`absolute inset-x-0 z-20 ${isTop ? "top-0" : "bottom-0"}`}
        style={{
          paddingLeft: paddingX,
          paddingRight: paddingX,
          paddingTop: isTop ? topPad : 0,
          paddingBottom: isTop ? 0 : bottomPad,
        }}
      >
        <div className={`${isTop ? "text-left" : "text-left"}`}>
          <h2
            style={{
              fontSize: titleSize,
              lineHeight: 1.02,
              letterSpacing: "-0.04em",
              color: state.textColor,
              margin: 0,
              fontWeight: 700,
              maxWidth: exportMode ? "84%" : "100%",
            }}
          >
            {state.headline}
          </h2>
          <p
            style={{
              fontSize: subtitleSize,
              lineHeight: 1.2,
              color: state.textColor,
              opacity: 0.84,
              margin: 0,
              marginTop: gapSize,
              maxWidth: exportMode ? "80%" : "100%",
            }}
          >
            {state.subtitle}
          </p>
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center px-[12%]">
        <div
          style={{
            width: `${phoneWidthPercent}%`,
            transform: `translateY(${phoneTranslateY})`,
          }}
        >
          <PhoneMockup screenshotUrl={state.uploadedScreenshotUrl} device={preset.device} />
        </div>
      </div>
    </div>
  );
}
