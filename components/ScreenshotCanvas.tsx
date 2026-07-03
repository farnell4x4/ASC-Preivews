import { useRef } from "react";
import { PhoneMockup } from "@/components/PhoneMockup";
import type { CanvasPreset, EditorState } from "@/lib/types";

type ScreenshotCanvasProps = {
  preset: CanvasPreset;
  state: EditorState;
  renderScale?: number;
  interactive?: boolean;
  onStateChange?: <K extends keyof EditorState>(key: K, value: EditorState[K]) => void;
};

export function ScreenshotCanvas({
  preset,
  state,
  renderScale = 1,
  interactive = false,
  onStateChange,
}: ScreenshotCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originPhoneX: number;
    originPhoneY: number;
  } | null>(null);
  const isTop = state.textPosition === "top";
  const scalePx = (value: number) => value * renderScale;
  const paddingX = scalePx(88);
  const topPad = scalePx(96);
  const bottomPad = scalePx(104);
  const titleSize = scalePx(state.fontSize);
  const subtitleSize = scalePx(Math.max(state.fontSize * 0.36, 34));
  const gapSize = scalePx(state.textSpacing);
  const phoneWidthPercent =
    (preset.device === "tablet" ? 56 : 62) * state.phoneScale;

  const handlePointerDown = (event: import("react").PointerEvent<HTMLDivElement>) => {
    if (!interactive || !onStateChange) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originPhoneX: state.phoneX,
      originPhoneY: state.phoneY,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: import("react").PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    const canvasNode = canvasRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId || !canvasNode || !onStateChange) {
      return;
    }

    const rect = canvasNode.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return;
    }

    const deltaXPercent = ((event.clientX - dragState.startX) / rect.width) * 100;
    const deltaYPercent = ((event.clientY - dragState.startY) / rect.height) * 100;

    onStateChange("phoneX", dragState.originPhoneX + deltaXPercent);
    onStateChange("phoneY", dragState.originPhoneY + deltaYPercent);
  };

  const handlePointerEnd = (event: import("react").PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
    }
  };

  return (
    <div
      ref={canvasRef}
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
              maxWidth: "84%",
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
              maxWidth: "80%",
            }}
          >
            {state.subtitle}
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0">
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onLostPointerCapture={handlePointerEnd}
          className={interactive ? "pointer-events-auto absolute touch-none cursor-grab active:cursor-grabbing" : "absolute"}
          style={{
            width: `${phoneWidthPercent}%`,
            left: `${state.phoneX}%`,
            top: `${state.phoneY}%`,
            transform: `translate(-50%, -50%) rotate(${state.phoneRotation}deg)`,
            transformOrigin: "center center",
          }}
        >
          <PhoneMockup
            screenshotUrl={state.uploadedScreenshotUrl}
            device={preset.device}
            renderScale={renderScale}
          />
        </div>
      </div>
    </div>
  );
}
