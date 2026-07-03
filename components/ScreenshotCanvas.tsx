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
    mode: "move" | "width" | "height" | "corner";
    startX: number;
    startY: number;
    originPhoneX: number;
    originPhoneY: number;
    originPhoneWidthScale: number;
    originPhoneHeightScale: number;
    originPhoneCornerScale: number;
    axisSign: 1 | -1;
    rotationDegrees: number;
    baseWidthPx: number;
    baseHeightPx: number;
    startWidthPx: number;
    startHeightPx: number;
  } | null>(null);
  const isTop = state.textPosition === "top";
  const scalePx = (value: number) => value * renderScale;
  const paddingX = scalePx(88);
  const topPad = scalePx(96);
  const bottomPad = scalePx(104);
  const titleSize = scalePx(state.fontSize);
  const subtitleSize = scalePx(Math.max(state.fontSize * 0.36, 34));
  const gapSize = scalePx(state.textSpacing);
  const basePhoneWidthPercent = preset.device === "tablet" ? 56 : 62;
  const deviceAspect = preset.device === "tablet" ? 0.78 : 0.49;
  const canvasWidthPx = preset.width * renderScale;
  const basePhoneWidthPx = canvasWidthPx * (basePhoneWidthPercent / 100) * state.phoneScale;
  const phoneWidthPx = basePhoneWidthPx * state.phoneWidthScale;
  const basePhoneHeightPx = basePhoneWidthPx / deviceAspect;
  const phoneHeightPx = basePhoneHeightPx * state.phoneHeightScale;

  const beginDrag = (
    event: import("react").PointerEvent<HTMLDivElement>,
    mode: "move" | "width" | "height" | "corner",
    axisSign: 1 | -1 = 1,
  ) => {
    if (!interactive || !onStateChange) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      originPhoneX: state.phoneX,
      originPhoneY: state.phoneY,
      originPhoneWidthScale: state.phoneWidthScale,
      originPhoneHeightScale: state.phoneHeightScale,
      originPhoneCornerScale: state.phoneCornerScale,
      axisSign,
      rotationDegrees: state.phoneRotation,
      baseWidthPx: basePhoneWidthPx,
      baseHeightPx: basePhoneHeightPx,
      startWidthPx: phoneWidthPx,
      startHeightPx: phoneHeightPx,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleMovePointerDown = (event: import("react").PointerEvent<HTMLDivElement>) => {
    beginDrag(event, "move");
  };

  const handleWidthPointerDown = (
    event: import("react").PointerEvent<HTMLDivElement>,
    axisSign: 1 | -1,
  ) => {
    event.stopPropagation();
    beginDrag(event, "width", axisSign);
  };

  const handleHeightPointerDown = (
    event: import("react").PointerEvent<HTMLDivElement>,
    axisSign: 1 | -1,
  ) => {
    event.stopPropagation();
    beginDrag(event, "height", axisSign);
  };

  const handleCornerPointerDown = (event: import("react").PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    beginDrag(event, "corner");
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
    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    const rotationRadians = (dragState.rotationDegrees * Math.PI) / 180;
    const localX = deltaX * Math.cos(rotationRadians) + deltaY * Math.sin(rotationRadians);
    const localY = -deltaX * Math.sin(rotationRadians) + deltaY * Math.cos(rotationRadians);

    if (dragState.mode === "move") {
      onStateChange("phoneX", dragState.originPhoneX + deltaXPercent);
      onStateChange("phoneY", dragState.originPhoneY + deltaYPercent);
      return;
    }

    if (dragState.mode === "width") {
      const nextWidthPx = Math.max(80 * renderScale, dragState.startWidthPx + (2 * dragState.axisSign * localX));
      onStateChange("phoneWidthScale", nextWidthPx / dragState.baseWidthPx);
      return;
    }

    if (dragState.mode === "height") {
      const nextHeightPx = Math.max(160 * renderScale, dragState.startHeightPx + (2 * dragState.axisSign * localY));
      onStateChange("phoneHeightScale", nextHeightPx / dragState.baseHeightPx);
      return;
    }

    const diagonalDelta = (localX - localY) / Math.sqrt(2);
    const nextCornerScale = Math.max(0.35, dragState.originPhoneCornerScale + diagonalDelta / 120);
    onStateChange("phoneCornerScale", nextCornerScale);
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
          onPointerDown={handleMovePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onLostPointerCapture={handlePointerEnd}
          className={interactive ? "group pointer-events-auto absolute touch-none cursor-grab active:cursor-grabbing" : "absolute"}
          style={{
            width: phoneWidthPx,
            height: phoneHeightPx,
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
            cornerScale={state.phoneCornerScale}
          />

          {interactive ? (
            <>
              <div className="pointer-events-none absolute inset-0 rounded-[inherit] border border-dashed border-sky-400/0 transition group-hover:border-sky-400/70" />

              <div
                onPointerDown={(event) => handleCornerPointerDown(event)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onLostPointerCapture={handlePointerEnd}
                className="absolute -right-4 -top-4 flex h-8 w-8 cursor-nwse-resize items-center justify-center rounded-full border border-sky-200 bg-white/95 text-sky-600 opacity-0 shadow-sm transition group-hover:opacity-100"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 16 4 20" />
                  <path d="M16 8 20 4" />
                  <path d="M7 20H4v-3" />
                  <path d="M17 4h3v3" />
                </svg>
              </div>

              <div
                onPointerDown={(event) => handleWidthPointerDown(event, -1)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onLostPointerCapture={handlePointerEnd}
                className="absolute bottom-10 left-0 top-10 flex w-5 -translate-x-1/2 cursor-ew-resize items-center justify-center opacity-0 transition group-hover:opacity-100"
              >
                <SideHandle orientation="horizontal" />
              </div>

              <div
                onPointerDown={(event) => handleWidthPointerDown(event, 1)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onLostPointerCapture={handlePointerEnd}
                className="absolute bottom-10 right-0 top-10 flex w-5 translate-x-1/2 cursor-ew-resize items-center justify-center opacity-0 transition group-hover:opacity-100"
              >
                <SideHandle orientation="horizontal" />
              </div>

              <div
                onPointerDown={(event) => handleHeightPointerDown(event, -1)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onLostPointerCapture={handlePointerEnd}
                className="absolute left-10 right-10 top-0 flex h-5 -translate-y-1/2 cursor-ns-resize items-center justify-center opacity-0 transition group-hover:opacity-100"
              >
                <SideHandle orientation="vertical" />
              </div>

              <div
                onPointerDown={(event) => handleHeightPointerDown(event, 1)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onLostPointerCapture={handlePointerEnd}
                className="absolute bottom-0 left-10 right-10 flex h-5 translate-y-1/2 cursor-ns-resize items-center justify-center opacity-0 transition group-hover:opacity-100"
              >
                <SideHandle orientation="vertical" />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SideHandle({ orientation }: { orientation: "horizontal" | "vertical" }) {
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-sky-200 bg-white/95 text-sky-600 shadow-sm">
      {orientation === "horizontal" ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12h16" />
          <path d="m8 8-4 4 4 4" />
          <path d="m16 8 4 4-4 4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4v16" />
          <path d="m8 8 4-4 4 4" />
          <path d="m8 16 4 4 4-4" />
        </svg>
      )}
    </div>
  );
}
