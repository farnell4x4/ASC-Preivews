import { useEffect, useRef } from "react";
import { PhoneMockup } from "@/components/PhoneMockup";
import { getBackgroundStyle } from "@/lib/backgroundStyle";
import { computeCanvasLayout } from "@/lib/canvasLayout";
import { getTimelineTextState } from "@/lib/timelineText";
import type { CanvasPreset, EditorState } from "@/lib/types";

const EXPORT_FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

type ScreenshotCanvasProps = {
  preset: CanvasPreset;
  state: EditorState;
  renderScale?: number;
  interactive?: boolean;
  currentTime?: number;
  syncVideoFrame?: boolean;
  autoPlayVideo?: boolean;
  loopVideo?: boolean;
  onVideoElementReady?: (video: HTMLVideoElement | null) => void;
  onVideoTimeUpdate?: (currentTime: number, duration: number) => void;
  onStateChange?: <K extends keyof EditorState>(key: K, value: EditorState[K]) => void;
};

export function ScreenshotCanvas({
  preset,
  state,
  renderScale = 1,
  interactive = false,
  currentTime = 0,
  syncVideoFrame = true,
  autoPlayVideo = false,
  loopVideo = false,
  onVideoElementReady,
  onVideoTimeUpdate,
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
    originTextBoxY: number;
    originTextBoxWidth: number;
  } | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    mode: "move" | "width" | "height" | "scale" | "corner" | "rotate";
    startX: number;
    startY: number;
    originPhoneScale: number;
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
  const timelineState = getTimelineTextState(state, currentTime);
  const isTop = timelineState.textPosition === "top";
  const scalePx = (value: number) => value * renderScale;
  const {
    canvasWidthPx,
    canvasHeightPx,
    topPad,
    bottomPad,
    textBoxLeftPx,
    textBoxOffsetYPx,
    textBoxWidthPx,
    titleSize,
    titleLineHeight,
    subtitleSize,
    gapSize,
    basePhoneWidthPx,
    basePhoneHeightPx,
    phoneWidthPx,
    phoneHeightPx,
    phoneCenterXPx,
    phoneCenterYPx,
  } = computeCanvasLayout(preset, timelineState, renderScale);
  const backgroundStyle = getBackgroundStyle(timelineState);

  useEffect(() => {
    autoSizeTextArea(headlineInputRef.current);
    autoSizeTextArea(subtitleInputRef.current);
  }, [timelineState.headline, timelineState.subtitle, titleSize, subtitleSize, gapSize, interactive]);

  const beginDrag = (
    event: import("react").PointerEvent<HTMLDivElement>,
    mode: "move" | "width" | "height" | "scale" | "corner" | "rotate",
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
      originPhoneScale: timelineState.phoneScale,
      originPhoneX: timelineState.phoneX,
      originPhoneY: timelineState.phoneY,
      originPhoneWidthScale: timelineState.phoneWidthScale,
      originPhoneHeightScale: timelineState.phoneHeightScale,
      originPhoneCornerScale: timelineState.phoneCornerScale,
      axisSign,
      rotationDegrees: timelineState.phoneRotation,
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

  const handleScalePointerDown = (event: import("react").PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    beginDrag(event, "scale");
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
      originTextBoxX: timelineState.textBoxX,
      originTextBoxY: timelineState.textBoxY,
      originTextBoxWidth: timelineState.textBoxWidth,
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
      originTextBoxX: timelineState.textBoxX,
      originTextBoxY: timelineState.textBoxY,
      originTextBoxWidth: timelineState.textBoxWidth,
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
      const deltaYPercent = ((event.clientY - textBoxDragState.startY) / rect.height) * 100;

      if (textBoxDragState.mode === "move") {
        onStateChange("textBoxX", textBoxDragState.originTextBoxX + deltaXPercent);
        onStateChange("textBoxY", textBoxDragState.originTextBoxY + deltaYPercent);
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

    if (dragState.mode === "scale") {
      const nextScale = Math.max(0.2, Math.min(3, dragState.originPhoneScale + diagonalDelta / 240));
      onStateChange("phoneScale", nextScale);
      return;
    }

    const nextCornerScale = Math.max(0.35, dragState.originPhoneCornerScale + diagonalDelta / 120);
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
      style={backgroundStyle}
    >
      <div
        className="absolute z-30"
        style={{
          left: textBoxLeftPx,
          width: textBoxWidthPx,
          top: isTop ? topPad : undefined,
          bottom: isTop ? undefined : bottomPad,
          transform: `translateY(${textBoxOffsetYPx}px)`,
        }}
      >
        {interactive ? (
          <div
            onPointerDown={handleTextBoxMovePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onLostPointerCapture={handlePointerEnd}
            className="absolute -top-12 left-0 z-50 inline-flex cursor-grab touch-none items-center gap-2 rounded-full border border-sky-200 bg-white/95 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 shadow-sm active:cursor-grabbing"
          >
            Text
          </div>
        ) : null}

        <div className="relative">
          <textarea
            ref={headlineInputRef}
            value={timelineState.headline}
            onChange={(event) => onStateChange?.("headline", event.target.value)}
            onInput={(event) => autoSizeTextArea(event.currentTarget)}
            rows={1}
            readOnly={!interactive || state.mediaType === "video"}
            className="block w-full resize-none overflow-hidden bg-transparent outline-none"
            style={{
              fontSize: titleSize,
              lineHeight: `${titleLineHeight}px`,
              letterSpacing: "-0.04em",
              fontFamily: EXPORT_FONT_FAMILY,
              color: timelineState.textColor,
              margin: 0,
              fontWeight: 700,
              width: "100%",
              padding: 0,
              border: "none",
              pointerEvents: interactive && state.mediaType !== "video" ? "auto" : "none",
            }}
          />
          <textarea
            ref={subtitleInputRef}
            value={timelineState.subtitle}
            onChange={(event) => onStateChange?.("subtitle", event.target.value)}
            onInput={(event) => autoSizeTextArea(event.currentTarget)}
            rows={1}
            readOnly={!interactive || state.mediaType === "video"}
            className="block w-full resize-none overflow-hidden bg-transparent outline-none"
            style={{
              fontSize: subtitleSize,
              lineHeight: 1.2,
              fontFamily: EXPORT_FONT_FAMILY,
              color: timelineState.textColor,
              opacity: 0.84,
              margin: 0,
              marginTop: gapSize,
              width: "100%",
              padding: 0,
              border: "none",
              pointerEvents: interactive && state.mediaType !== "video" ? "auto" : "none",
            }}
          />

          {interactive && onStateChange ? (
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
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute"
          style={{
            width: phoneWidthPx,
            height: phoneHeightPx,
            left: phoneCenterXPx,
            top: phoneCenterYPx,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div
            onPointerDown={handleMovePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onLostPointerCapture={handlePointerEnd}
            className={interactive ? "group pointer-events-auto relative h-full w-full touch-none cursor-grab active:cursor-grabbing" : "relative h-full w-full"}
            style={{
              transform: `rotate(${timelineState.phoneRotation}deg)`,
              transformOrigin: "center center",
            }}
          >
            <PhoneMockup
              screenshotUrl={timelineState.uploadedScreenshotUrl}
              videoUrl={timelineState.mediaType === "video" ? timelineState.uploadedMediaUrl : null}
              device={preset.device}
              renderScale={renderScale}
              cornerScale={timelineState.phoneCornerScale}
              frameWidthPx={phoneWidthPx}
              showVideoControls={false}
              shouldSyncPreviewFrame={syncVideoFrame}
              autoPlayVideo={autoPlayVideo}
              loopVideo={loopVideo}
              onVideoElementReady={onVideoElementReady}
              previewFrameTime={timelineState.mediaType === "video" ? currentTime : undefined}
              onVideoTimeUpdate={onVideoTimeUpdate}
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
                  onPointerDown={(event) => handleScalePointerDown(event)}
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
                  onPointerDown={(event) => handleCornerPointerDown(event)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerEnd}
                  onPointerCancel={handlePointerEnd}
                  onLostPointerCapture={handlePointerEnd}
                  className="absolute -bottom-4 -left-4 flex h-8 w-8 cursor-nwse-resize items-center justify-center rounded-full border border-sky-200 bg-white/95 text-sky-600 opacity-0 shadow-sm transition group-hover:opacity-100"
                >
                  <CornerRadiusIcon className="h-4 w-4" />
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

function CornerRadiusIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: "rotate(90deg)" }}
    >
      <path d="M5 19V10a5 5 0 0 1 5-5h9" />
      <path d="M15 15l-4-4" />
      <path d="M11 15v-4h4" />
    </svg>
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
  node.style.height = `${node.scrollHeight + 2}px`;
}
