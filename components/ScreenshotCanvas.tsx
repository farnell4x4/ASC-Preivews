import { useEffect, useRef } from "react";
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
  const headlineInputRef = useRef<HTMLTextAreaElement>(null);
  const subtitleInputRef = useRef<HTMLTextAreaElement>(null);
  const textBoxDragStateRef = useRef<{
    pointerId: number;
    mode: "move" | "width";
    startX: number;
    startY: number;
    originTextBoxX: number;
    originTextBoxWidth: number;
  } | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    mode: "move" | "width" | "height" | "corner" | "rotate";
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
  const canvasWidthPx = preset.width * renderScale;
  const topPad = preset.height * renderScale * 0.072;
  const bottomPad = preset.height * renderScale * 0.078;
  const textBoxLeftPx = (state.textBoxX / 100) * canvasWidthPx;
  const textBoxWidthPx = (state.textBoxWidth / 100) * canvasWidthPx;
  const titleSize = scalePx(state.fontSize);
  const subtitleSize = scalePx(Math.max(state.fontSize * 0.36, 34));
  const gapSize = scalePx(state.textSpacing);
  const basePhoneWidthPercent = preset.device === "tablet" ? 56 : 62;
  const deviceAspect = preset.device === "tablet" ? 0.78 : 0.49;
  const basePhoneWidthPx = canvasWidthPx * (basePhoneWidthPercent / 100) * state.phoneScale;
  const phoneWidthPx = basePhoneWidthPx * state.phoneWidthScale;
  const basePhoneHeightPx = basePhoneWidthPx / deviceAspect;
  const phoneHeightPx = basePhoneHeightPx * state.phoneHeightScale;

  useEffect(() => {
    autoSizeTextArea(headlineInputRef.current);
    autoSizeTextArea(subtitleInputRef.current);
  }, [state.headline, state.subtitle, titleSize, subtitleSize, gapSize, interactive]);

  const beginDrag = (
    event: import("react").PointerEvent<HTMLDivElement>,
    mode: "move" | "width" | "height" | "corner" | "rotate",
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

  const handleRotatePointerDown = (event: import("react").PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    beginDrag(event, "rotate");
  };

  const handleTextBoxMovePointerDown = (event: import("react").PointerEvent<HTMLDivElement>) => {
    if (!interactive || !onStateChange) {
      return;
    }

    event.stopPropagation();
    textBoxDragStateRef.current = {
      pointerId: event.pointerId,
      mode: "move",
      startX: event.clientX,
      startY: event.clientY,
      originTextBoxX: state.textBoxX,
      originTextBoxWidth: state.textBoxWidth,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleTextBoxWidthPointerDown = (event: import("react").PointerEvent<HTMLDivElement>) => {
    if (!interactive || !onStateChange) {
      return;
    }

    event.stopPropagation();
    textBoxDragStateRef.current = {
      pointerId: event.pointerId,
      mode: "width",
      startX: event.clientX,
      startY: event.clientY,
      originTextBoxX: state.textBoxX,
      originTextBoxWidth: state.textBoxWidth,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: import("react").PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    const textBoxDragState = textBoxDragStateRef.current;
    const canvasNode = canvasRef.current;

    if (!canvasNode || !onStateChange) {
      return;
    }

    const rect = canvasNode.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return;
    }

    if (textBoxDragState?.pointerId === event.pointerId) {
      const deltaXPercent = ((event.clientX - textBoxDragState.startX) / rect.width) * 100;

      if (textBoxDragState.mode === "move") {
        onStateChange("textBoxX", textBoxDragState.originTextBoxX + deltaXPercent);
        return;
      }

      onStateChange("textBoxWidth", Math.max(30, textBoxDragState.originTextBoxWidth + deltaXPercent));
      return;
    }

    if (!dragState || dragState.pointerId !== event.pointerId) {
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

    if (dragState.mode === "rotate") {
      const nextRotation = clampRotation(dragState.rotationDegrees + deltaX * 0.24);
      onStateChange("phoneRotation", nextRotation);
      return;
    }

    const diagonalDelta = (localX - localY) / Math.sqrt(2);
    const nextCornerScale = Math.max(0.35, dragState.originPhoneCornerScale - diagonalDelta / 120);
    onStateChange("phoneCornerScale", nextCornerScale);
  };

  const handlePointerEnd = (event: import("react").PointerEvent<HTMLDivElement>) => {
    if (textBoxDragStateRef.current?.pointerId === event.pointerId) {
      textBoxDragStateRef.current = null;
    }

    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
    }
  };

  return (
    <div
      ref={canvasRef}
      className={`relative h-full w-full ${interactive ? "overflow-visible" : "overflow-hidden"}`}
      style={{
        backgroundColor: state.backgroundColor,
      }}
    >
      <div
        className="absolute z-30"
        style={{
          left: textBoxLeftPx,
          width: textBoxWidthPx,
          top: isTop ? topPad : undefined,
          bottom: isTop ? undefined : bottomPad,
        }}
      >
        {interactive ? (
          <div
            onPointerDown={handleTextBoxMovePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onLostPointerCapture={handlePointerEnd}
            className="mb-2 inline-flex cursor-grab items-center gap-2 rounded-full border border-sky-200 bg-white/95 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 shadow-sm active:cursor-grabbing"
          >
            Text
          </div>
        ) : null}

        <div className="relative">
          {interactive && onStateChange ? (
            <>
              <textarea
                ref={headlineInputRef}
                value={state.headline}
                onChange={(event) => onStateChange("headline", event.target.value)}
                onInput={(event) => autoSizeTextArea(event.currentTarget)}
                rows={1}
                className="block w-full resize-none overflow-hidden bg-transparent outline-none"
                style={{
                  fontSize: titleSize,
                  lineHeight: 1.02,
                  letterSpacing: "-0.04em",
                  color: state.textColor,
                  margin: 0,
                  fontWeight: 700,
                  width: "100%",
                  padding: 0,
                }}
              />
              <textarea
                ref={subtitleInputRef}
                value={state.subtitle}
                onChange={(event) => onStateChange("subtitle", event.target.value)}
                onInput={(event) => autoSizeTextArea(event.currentTarget)}
                rows={1}
                className="block w-full resize-none overflow-hidden bg-transparent outline-none"
                style={{
                  fontSize: subtitleSize,
                  lineHeight: 1.2,
                  color: state.textColor,
                  opacity: 0.84,
                  margin: 0,
                  marginTop: gapSize,
                  width: "100%",
                  padding: 0,
                }}
              />

              <div
                onPointerDown={handleTextBoxWidthPointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onLostPointerCapture={handlePointerEnd}
                className="absolute bottom-0 right-0 top-0 z-40 flex w-10 translate-x-0 cursor-ew-resize items-center justify-end pr-1"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-sky-200 bg-white/95 text-sky-600 shadow-sm">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12h16" />
                    <path d="m8 8-4 4 4 4" />
                    <path d="m16 8 4 4-4 4" />
                  </svg>
                </div>
              </div>
            </>
          ) : (
            <>
              <h2
                style={{
                  fontSize: titleSize,
                  lineHeight: 1.02,
                  letterSpacing: "-0.04em",
                  color: state.textColor,
                  margin: 0,
                  fontWeight: 700,
                  width: "100%",
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
                  width: "100%",
                }}
              >
                {state.subtitle}
              </p>
            </>
          )}
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
              <div
                onPointerDown={(event) => handleRotatePointerDown(event)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onLostPointerCapture={handlePointerEnd}
                className="absolute -left-4 -top-4 flex h-8 w-8 cursor-ew-resize items-center justify-center rounded-full border border-sky-200 bg-white/95 text-sky-600 opacity-0 shadow-sm transition group-hover:opacity-100"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 8a7 7 0 1 1-1.1 8.3" />
                  <path d="M6 4v4h4" />
                </svg>
              </div>

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

function clampRotation(value: number) {
  return Math.min(Math.max(value, -180), 180);
}

function autoSizeTextArea(node: HTMLTextAreaElement | null) {
  if (!node) {
    return;
  }

  node.style.height = "0px";
  node.style.height = `${node.scrollHeight}px`;
}
