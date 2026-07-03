"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ExportButton } from "@/components/ExportButton";
import { ScreenshotCanvas } from "@/components/ScreenshotCanvas";
import { getBackgroundModeLabel, getBackgroundStyle } from "@/lib/backgroundStyle";
import { defaultPreset, canvasPresets } from "@/lib/canvasPresets";
import {
  DEFAULT_SESSION_ID,
  getFileSessionId,
  listSavedEditorSessions,
  loadActiveSessionId,
  loadEditorSession,
  saveActiveSessionId,
  saveEditorSession,
} from "@/lib/editorSessionStore";
import { exportStateAsPng } from "@/lib/exportImage";
import type { EditorState } from "@/lib/types";
import type { SavedEditorSessionSummary } from "@/lib/editorSessionStore";

const initialState: EditorState = {
  selectedPresetId: defaultPreset.id,
  uploadedScreenshotUrl: null,
  headline: "Track what matters",
  subtitle: "Simple. Clean. Focused.",
  textPosition: "top",
  textBoxX: 4,
  textBoxY: 0,
  textBoxWidth: 112,
  fontSize: 144,
  textColor: "#0f172a",
  backgroundColor: "#ffffff",
  backgroundMode: "solid",
  backgroundAccentColor: "#000000",
  backgroundAngle: 180,
  backgroundFlip: false,
  backgroundSpread: 36,
  phoneScale: 0.92,
  phoneX: 50,
  phoneY: 52.5,
  phoneRotation: 0,
  phoneWidthScale: 1,
  phoneHeightScale: 1,
  phoneCornerScale: 1,
  titleLineHeight: 1.08,
  textSpacing: 28,
};

export function Editor() {
  const [state, setState] = useState<EditorState>(initialState);
  const [isExporting, setIsExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Ready to export exact ASC-sized PNGs.");
  const [previewZoom, setPreviewZoom] = useState(1);
  const [isBackgroundSheetOpen, setIsBackgroundSheetOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(DEFAULT_SESSION_ID);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [savedSessions, setSavedSessions] = useState<SavedEditorSessionSummary[]>([]);
  const [isSavedFilesOpen, setIsSavedFilesOpen] = useState(false);
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const [previewViewportWidth, setPreviewViewportWidth] = useState(420);
  const [fitHeight, setFitHeight] = useState(720);

  const selectedPreset = useMemo(
    () => canvasPresets.find((preset) => preset.id === state.selectedPresetId) ?? defaultPreset,
    [state.selectedPresetId],
  );
  const fitScale = Math.min(
    previewViewportWidth / selectedPreset.width,
    fitHeight / selectedPreset.height,
  );
  const previewScale = fitScale * previewZoom;
  const previewWidth = selectedPreset.width * previewScale;
  const previewHeight = selectedPreset.height * previewScale;
  const backgroundButtonStyle = useMemo(() => getBackgroundStyle(state), [state]);

  const refreshSavedSessions = () => {
    void listSavedEditorSessions()
      .then((sessions) => {
        setSavedSessions(sessions);
      })
      .catch(() => {
        setSavedSessions([]);
      });
  };

  useEffect(() => {
    let isCancelled = false;

    void loadActiveSessionId()
      .then(async (savedActiveSessionId) => {
        const nextSessionId = savedActiveSessionId ?? DEFAULT_SESSION_ID;
        const savedSession = await loadEditorSession(nextSessionId);

        if (isCancelled) {
          return;
        }

        setActiveSessionId(nextSessionId);

        if (!savedSession) {
          return;
        }

        setState({
          ...initialState,
          ...savedSession.state,
        });
        setPreviewZoom(savedSession.previewZoom);
        setStatusMessage(
          nextSessionId === DEFAULT_SESSION_ID
            ? "Restored your last editing session."
            : "Restored the saved settings for your last file.",
        );
      })
      .catch(() => {
        if (!isCancelled) {
          setStatusMessage("Ready to export exact ASC-sized PNGs.");
        }
      })
      .finally(() => {
        if (!isCancelled) {
          refreshSavedSessions();
          setIsSessionReady(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isSessionReady) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void Promise.all([
        saveEditorSession(activeSessionId, { state, previewZoom }),
        saveActiveSessionId(activeSessionId),
      ]).then(() => {
        refreshSavedSessions();
      });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeSessionId, isSessionReady, previewZoom, state]);

  useEffect(() => {
    const node = previewViewportRef.current;

    if (!node) {
      return;
    }

    const updatePreviewMetrics = () => {
      const rect = node.getBoundingClientRect();
      const nextWidth = node.clientWidth || 420;
      const availableHeight = window.innerHeight - rect.top - 32;
      setPreviewViewportWidth(nextWidth);
      setFitHeight(Math.max(availableHeight, 720));
    };

    updatePreviewMetrics();

    const observer = new ResizeObserver(() => {
      updatePreviewMetrics();
    });

    observer.observe(node);
    window.addEventListener("resize", updatePreviewMetrics);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePreviewMetrics);
    };
  }, [selectedPreset.id]);

  const handleStateChange = <K extends keyof EditorState>(key: K, value: EditorState[K]) => {
    setState((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleUpload = async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      setIsSessionReady(false);

      const sessionId = getFileSessionId(file);
      const nextUrl = await readFileAsDataUrl(file);
      const savedSession = await loadEditorSession(sessionId);
      const restoredState = savedSession
        ? {
            ...initialState,
            ...savedSession.state,
          }
        : null;
      const nextState = restoredState
        ? {
            ...restoredState,
            uploadedScreenshotUrl: nextUrl,
          }
        : {
            ...state,
            uploadedScreenshotUrl: nextUrl,
            ...getAutoFitPhoneLayout(
              state,
              selectedPreset,
              await readImageDimensions(nextUrl),
            ),
          };

      setActiveSessionId(sessionId);
      setPreviewZoom(savedSession?.previewZoom ?? previewZoom);
      setState(nextState);
      setStatusMessage(`Loaded ${file.name}.`);
    } catch {
      setStatusMessage("Unable to read that image file.");
    } finally {
      setIsSessionReady(true);
    }
  };

  const handleSelectSavedSession = async (sessionId: string) => {
    try {
      setIsSessionReady(false);
      const savedSession = await loadEditorSession(sessionId);

      if (!savedSession) {
        setStatusMessage("That saved file could not be restored.");
        return;
      }

      setActiveSessionId(sessionId);
      setState({
        ...initialState,
        ...savedSession.state,
      });
      setPreviewZoom(savedSession.previewZoom);
      setIsSavedFilesOpen(false);
      setStatusMessage("Restored the saved settings for that file.");
    } catch {
      setStatusMessage("Unable to load that saved file.");
    } finally {
      setIsSessionReady(true);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setStatusMessage("Rendering your PNG...");

    try {
      const blob = await exportStateAsPng(selectedPreset, state);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `asc-screenshot-${selectedPreset.width}x${selectedPreset.height}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 1000);
      setStatusMessage(`Exported ${selectedPreset.width}x${selectedPreset.height} PNG.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to export PNG.";
      setStatusMessage(message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-4 lg:px-6">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-white/70 bg-white/80 px-6 py-5 shadow-panel backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
              ASC Screenshot Maker
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Build export-ready App Store screenshots
            </h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
            >
              Back to home
            </Link>
            <div className="min-w-[280px] rounded-full border border-blue-100 bg-blue-50 px-5 py-3 text-sm text-blue-900">
              {statusMessage}
            </div>
          </div>
        </header>

        {savedSessions.length > 0 ? (
          <section className="rounded-[2rem] border border-slate-200 bg-white/85 p-4 shadow-panel">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Saved Files
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Jump back into any saved screenshot setup from IndexedDB.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSavedFilesOpen((current) => !current)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
              >
                {isSavedFilesOpen ? "Collapse" : `Show ${savedSessions.length}`}
              </button>
            </div>

            {isSavedFilesOpen ? (
              <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                {savedSessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => void handleSelectSavedSession(session.id)}
                    className={`group w-[136px] shrink-0 rounded-[1.4rem] border bg-white p-2 text-left transition ${
                      activeSessionId === session.id
                        ? "border-slate-900 shadow-[0_18px_45px_rgba(15,23,42,0.14)]"
                        : "border-slate-200 hover:border-slate-300 hover:shadow-[0_14px_36px_rgba(15,23,42,0.08)]"
                    }`}
                  >
                    <div className="relative aspect-[9/19.5] overflow-hidden rounded-[1rem] bg-slate-100">
                      {session.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={session.previewUrl}
                          alt={session.displayName}
                          className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                          draggable={false}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs font-medium text-slate-400">
                          No preview
                        </div>
                      )}
                    </div>
                    <div className="mt-3 truncate text-sm font-semibold text-slate-800">
                      {session.displayName}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="rounded-[2rem] border border-slate-200 bg-white/85 p-4 shadow-panel">
          <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start">
            <div className="space-y-4">
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Preview
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Scaled preview of the exact {selectedPreset.width}x{selectedPreset.height} export.
                </div>

                <div className="mt-4 inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                  {[1.5, 1, 0.75, 0.5].map((zoom) => (
                    <button
                      key={zoom}
                      type="button"
                      onClick={() => setPreviewZoom(zoom)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        previewZoom === zoom
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {Math.round(zoom * 100)}%
                    </button>
                  ))}
                </div>

                <div className="mt-4">
                  <ExportButton isExporting={isExporting} onExport={handleExport} />
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Text & Color
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                  <label className="block">
                    <div className="mb-2 text-sm font-medium text-slate-700">
                      Font size: {state.fontSize}px
                    </div>
                    <input
                      type="range"
                      min={92}
                      max={192}
                      step={2}
                      value={state.fontSize}
                      onChange={(event) => handleStateChange("fontSize", Number(event.target.value))}
                      className="w-full"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 text-sm font-medium text-slate-700">
                      Title line spacing: {state.titleLineHeight.toFixed(2)}x
                    </div>
                    <input
                      type="range"
                      min={0.9}
                      max={1.4}
                      step={0.01}
                      value={state.titleLineHeight}
                      onChange={(event) => handleStateChange("titleLineHeight", Number(event.target.value))}
                      className="w-full"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 text-sm font-medium text-slate-700">
                      Text spacing: {state.textSpacing}px
                    </div>
                    <input
                      type="range"
                      min={18}
                      max={72}
                      step={2}
                      value={state.textSpacing}
                      onChange={(event) => handleStateChange("textSpacing", Number(event.target.value))}
                      className="w-full"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 text-sm font-medium text-slate-700">
                      Text color
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                      <input
                        type="color"
                        value={state.textColor}
                        onChange={(event) => handleStateChange("textColor", event.target.value)}
                        className="h-11 w-11 cursor-pointer rounded-full"
                      />
                      <span className="text-sm text-slate-600">{state.textColor}</span>
                    </div>
                  </label>

                  <label className="block">
                    <div className="mb-2 text-sm font-medium text-slate-700">
                      Background color
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsBackgroundSheetOpen(true)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-slate-300"
                    >
                      <span
                        className="h-11 w-11 rounded-full border border-slate-200 shadow-inner"
                        style={backgroundButtonStyle}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-700">
                          {getBackgroundModeLabel(state.backgroundMode)}
                        </span>
                        <span className="block truncate text-sm text-slate-500">
                          {state.backgroundMode === "solid"
                            ? state.backgroundColor
                            : `${state.backgroundColor} -> ${state.backgroundAccentColor}`}
                        </span>
                      </span>
                    </button>
                  </label>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                <label className="block">
                  <div className="mb-2 text-sm font-medium text-slate-700">
                    ASC preset
                  </div>
                  <select
                    value={state.selectedPresetId}
                    onChange={(event) => handleStateChange("selectedPresetId", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-0 transition focus:border-blue-400"
                  >
                    {canvasPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label} ({preset.width}x{preset.height})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <div className="mb-2 text-sm font-medium text-slate-700">
                    Choose file
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={(event) => handleUpload(event.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-3 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
                  />
                </label>
              </div>
            </div>

            <div
              ref={previewViewportRef}
              className="flex items-start justify-center rounded-[1.75rem] bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_35%,#fff_100%)] p-4"
              style={{
                minHeight: previewHeight + 32,
              }}
            >
              <div
                className="relative overflow-visible rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_30px_70px_rgba(15,23,42,0.12)]"
                style={{
                  width: previewWidth,
                  height: previewHeight,
                }}
              >
                <ScreenshotCanvas
                  preset={selectedPreset}
                  state={state}
                  renderScale={previewScale}
                  interactive
                  onStateChange={handleStateChange}
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      {isBackgroundSheetOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/30 p-4 md:items-center">
          <button
            type="button"
            aria-label="Close background options"
            className="absolute inset-0 cursor-default"
            onClick={() => setIsBackgroundSheetOpen(false)}
          />
          <div className="relative z-10 w-full max-w-[720px] rounded-[2rem] border border-white/70 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Background
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  Solid and gradient fills
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsBackgroundSheetOpen(false)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              {(["solid", "linear", "advanced", "radial"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleStateChange("backgroundMode", mode)}
                  className={`rounded-[1.4rem] border px-4 py-4 text-left transition ${
                    state.backgroundMode === mode
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <div className="text-sm font-semibold">{getBackgroundModeLabel(mode)}</div>
                  <div className={`mt-2 h-14 rounded-2xl border ${state.backgroundMode === mode ? "border-white/20" : "border-slate-200"}`} style={getBackgroundStyle({ ...state, backgroundMode: mode })} />
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block">
                <div className="mb-2 text-sm font-medium text-slate-700">
                  Primary color
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <input
                    type="color"
                    value={state.backgroundColor}
                    onChange={(event) => handleStateChange("backgroundColor", event.target.value)}
                    className="h-11 w-11 cursor-pointer rounded-full"
                  />
                  <span className="text-sm text-slate-600">{state.backgroundColor}</span>
                </div>
              </label>

              <label className="block">
                <div className="mb-2 text-sm font-medium text-slate-700">
                  Secondary color
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <input
                    type="color"
                    value={state.backgroundAccentColor}
                    onChange={(event) => handleStateChange("backgroundAccentColor", event.target.value)}
                    className="h-11 w-11 cursor-pointer rounded-full"
                  />
                  <span className="text-sm text-slate-600">{state.backgroundAccentColor}</span>
                </div>
              </label>
            </div>

            {state.backgroundMode !== "solid" ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {state.backgroundMode !== "radial" ? (
                  <label className="block">
                    <div className="mb-2 text-sm font-medium text-slate-700">
                      Angle: {state.backgroundAngle}deg
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      step={5}
                      value={state.backgroundAngle}
                      onChange={(event) => handleStateChange("backgroundAngle", Number(event.target.value))}
                      className="w-full"
                    />
                  </label>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    Circle gradients radiate from the center of the canvas.
                  </div>
                )}

                <label className="block">
                  <div className="mb-2 text-sm font-medium text-slate-700">
                    Spread: {state.backgroundSpread}%
                  </div>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    step={1}
                    value={state.backgroundSpread}
                    onChange={(event) => handleStateChange("backgroundSpread", Number(event.target.value))}
                    className="w-full"
                  />
                  <div className="mt-2 text-sm text-slate-500">
                    Lower values pull the first color back sooner. Higher values let it travel farther.
                  </div>
                </label>

                <button
                  type="button"
                  onClick={() => handleStateChange("backgroundFlip", !state.backgroundFlip)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    state.backgroundFlip
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <div className="text-sm font-semibold">Flip inside out</div>
                  <div className={`mt-1 text-sm ${state.backgroundFlip ? "text-white/74" : "text-slate-500"}`}>
                    Reverse which color sits on the outside versus the inside.
                  </div>
                </button>
              </div>
            ) : null}

            <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Preview
              </div>
              <div className="h-28 rounded-[1.25rem] border border-slate-200" style={backgroundButtonStyle} />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}



function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unexpected file reader result."));
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error("Unable to read file."));
    };

    reader.readAsDataURL(file);
  });
}

function readImageDimensions(src: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };

    image.onerror = () => {
      reject(new Error("Unable to read image dimensions."));
    };

    image.src = src;
  });
}

function getAutoFitPhoneLayout(
  state: EditorState,
  preset: { width: number; height: number; device: "phone" | "tablet" },
  image: { width: number; height: number },
) {
  const basePhoneWidthPercent = preset.device === "tablet" ? 0.56 : 0.62;
  const deviceAspect = preset.device === "tablet" ? 0.78 : 0.49;
  const screenshotAspect = image.width / image.height;
  const widthScale = 1;
  const heightScale = clamp(deviceAspect / screenshotAspect, 0.82, 1.22);

  const topPad = preset.height * 0.072;
  const bottomPad = preset.height * 0.078;
  const titleHeight = state.fontSize * state.titleLineHeight;
  const subtitleHeight = Math.max(state.fontSize * 0.36, 34) * 1.2;
  const textGap = state.textSpacing;
  const textBlockHeight = titleHeight + subtitleHeight + textGap + preset.height * 0.05;
  const horizontalPadding = preset.width * 0.08;
  const maxPhoneWidth = (preset.width - horizontalPadding * 2) * (preset.device === "tablet" ? 0.88 : 0.8);
  const maxPhoneHeight = Math.max(
    preset.height * 0.42,
    preset.height - textBlockHeight - topPad - bottomPad - preset.height * 0.06,
  );

  const basePhoneWidth = preset.width * basePhoneWidthPercent * widthScale;
  const basePhoneHeight = (preset.width * basePhoneWidthPercent * heightScale) / deviceAspect;
  const fittedScale = Math.min(maxPhoneWidth / basePhoneWidth, maxPhoneHeight / basePhoneHeight);
  const phoneScale = clamp(fittedScale, 0.45, 1.6);
  const renderedPhoneHeight = basePhoneHeight * phoneScale;
  const phoneY =
    state.textPosition === "top"
      ? ((topPad + textBlockHeight + (preset.height - renderedPhoneHeight - topPad - textBlockHeight) / 2 + renderedPhoneHeight / 2) /
          preset.height) *
        100
      : (((preset.height - bottomPad - textBlockHeight - renderedPhoneHeight) / 2 + renderedPhoneHeight / 2) /
          preset.height) *
        100;

  return {
    phoneScale,
    phoneWidthScale: widthScale,
    phoneHeightScale: heightScale,
    phoneX: 50,
    phoneY: clamp(phoneY, 18, 82),
    phoneRotation: 0,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
