"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ExportButton } from "@/components/ExportButton";
import { PhoneMockup } from "@/components/PhoneMockup";
import { ScreenshotCanvas } from "@/components/ScreenshotCanvas";
import { getBackgroundModeLabel, getBackgroundStyle } from "@/lib/backgroundStyle";
import { defaultPreset, canvasPresets } from "@/lib/canvasPresets";
import {
  type ControlPanelPosition,
  DEFAULT_SESSION_ID,
  deleteEditorSession,
  getFileSessionId,
  listSavedEditorSessions,
  loadActiveSessionId,
  loadControlPanelPosition,
  loadLoadedSessionIds,
  loadEditorSession,
  loadPreviewZoom,
  saveActiveSessionId,
  saveControlPanelPosition,
  saveLoadedSessionIds,
  saveEditorSession,
  savePreviewZoom,
} from "@/lib/editorSessionStore";
import { exportStateAsPng } from "@/lib/exportImage";
import { exportStateAsVideo } from "@/lib/exportVideo";
import type { EditorMediaType, EditorState, TimelineTextCue } from "@/lib/types";
import type { SavedEditorSessionSummary } from "@/lib/editorSessionStore";

const initialState: EditorState = {
  selectedPresetId: defaultPreset.id,
  mediaType: "image",
  uploadedScreenshotUrl: null,
  uploadedMediaUrl: null,
  mediaName: null,
  timelineTextCues: [],
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

const CUE_GAP_SECONDS = 0.001;
const CONTROL_PANEL_MARGIN = 16;
const CONTROL_PANEL_DEFAULT_TOP = 96;

/*
UI naming glossary:
- Editor: the full screenshot-making screen.
- Saved Files: the collapsible section of previously saved items.
- Saved file card: one item inside Saved Files.
- Preview controls: the control row above the live preview area.
- Preview panel: the large section that contains the live preview(s).
- Canvas: the screenshot composition area rendered by ScreenshotCanvas.
- Canvas strip: the horizontal row of loaded canvas cards.
- Canvas card: one preview item in the strip.
that di
- Active canvas card: the canvas card currently being edited.
- Inactive canvas card: any other loaded canvas card in the strip.
- File: one uploaded image plus its saved layout/settings.
- Session: the saved state for one file.
- Active session: the file/session currently loaded in the editor.
- Loaded sessions: the sessions currently shown in the canvas strip.
- Default draft: the non-file fallback editing state.
- Phone mockup: the phone frame inside the canvas.
- Text box: the draggable headline/subtitle area inside the canvas.
- Background sheet: the modal used for background options.
*/
export function Editor() {
  type ControlPanel = "files" | "format" | "preview" | "timeline" | "export" | "background";

  const [state, setState] = useState<EditorState>(initialState);
  const [isExporting, setIsExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Ready to export exact ASC-sized PNGs.");
  const [previewZoom, setPreviewZoom] = useState(1);
  const [activeSessionId, setActiveSessionId] = useState(DEFAULT_SESSION_ID);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [savedSessions, setSavedSessions] = useState<SavedEditorSessionSummary[]>([]);
  const [loadedSessionIds, setLoadedSessionIds] = useState<string[]>([]);
  const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);
  const [activeControlPanel, setActiveControlPanel] = useState<ControlPanel | null>(null);
  const [previewVideoTime, setPreviewVideoTime] = useState(0);
  const [previewVideoDuration, setPreviewVideoDuration] = useState(0);
  const [selectedCueId, setSelectedCueId] = useState<string | null>(null);
  const [controlPanelPosition, setControlPanelPosition] = useState<ControlPanelPosition | null>(null);
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const controlPanelRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const [isDraggingControlPanel, setIsDraggingControlPanel] = useState(false);
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
  const savedSessionMap = useMemo(
    () => new Map(savedSessions.map((session) => [session.id, session])),
    [savedSessions],
  );
  const loadedPreviewItems = useMemo(
    () =>
      loadedSessionIds
        .filter((sessionId, index, allIds) => allIds.indexOf(sessionId) === index)
        .map((sessionId) => {
          if (sessionId === activeSessionId && hasLoadedMedia(state)) {
            return {
              id: sessionId,
              displayName:
                savedSessionMap.get(sessionId)?.displayName ??
                getDisplayNameFromSessionId(sessionId),
              state,
            };
          }

          const savedSession = savedSessionMap.get(sessionId);
          return savedSession
            ? {
                id: savedSession.id,
                displayName: savedSession.displayName,
                state: savedSession.state,
              }
            : null;
        })
        .filter((item): item is { id: string; displayName: string; state: EditorState } => Boolean(item)),
    [activeSessionId, loadedSessionIds, savedSessionMap, state],
  );

  const refreshSavedSessions = async () => {
    try {
      const sessions = await listSavedEditorSessions();
      setSavedSessions(sessions);
      return sessions;
    } catch {
      setSavedSessions([]);
      return [];
    }
  };

  const activateSession = async (sessionId: string) => {
    const savedSession = await loadEditorSession(sessionId);

    if (!savedSession) {
      throw new Error("That saved file could not be restored.");
    }

    setActiveSessionId(sessionId);
    setState({
      ...initialState,
      ...savedSession.state,
    });
  };

  const selectedCue = useMemo(
    () =>
      state.timelineTextCues.find((cue) => cue.id === selectedCueId) ??
      state.timelineTextCues[0] ??
      null,
    [selectedCueId, state.timelineTextCues],
  );

  const resetToDefaultDraft = () => {
    setActiveSessionId(DEFAULT_SESSION_ID);
    setState(initialState);
    setPreviewVideoTime(0);
    setPreviewVideoDuration(0);
    setSelectedCueId(null);
  };

  useEffect(() => {
    let isCancelled = false;

    void Promise.all([loadActiveSessionId(), loadLoadedSessionIds(), loadPreviewZoom(), loadControlPanelPosition()])
      .then(async ([savedActiveSessionId, savedLoadedSessionIds, savedPreviewZoom, savedControlPanelPosition]) => {
        const nextSessionId = savedActiveSessionId ?? DEFAULT_SESSION_ID;
        const savedSession = await loadEditorSession(nextSessionId);

        if (isCancelled) {
          return;
        }

        setActiveSessionId(nextSessionId);
        setLoadedSessionIds(
          savedLoadedSessionIds.filter((sessionId, index, allIds) => allIds.indexOf(sessionId) === index),
        );
        if (savedPreviewZoom !== null) {
          setPreviewZoom(savedPreviewZoom);
        }
        if (savedControlPanelPosition) {
          setControlPanelPosition(savedControlPanelPosition);
        }

        if (!savedSession) {
          return;
        }

        if (
          nextSessionId !== DEFAULT_SESSION_ID &&
          hasLoadedMedia(savedSession.state) &&
          !savedLoadedSessionIds.includes(nextSessionId)
        ) {
          setLoadedSessionIds([nextSessionId]);
        }

        setState({
          ...initialState,
          ...savedSession.state,
        });
        setSelectedCueId(savedSession.state.timelineTextCues?.[0]?.id ?? null);
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
        saveEditorSession(activeSessionId, { state }),
        saveActiveSessionId(activeSessionId),
        saveLoadedSessionIds(loadedSessionIds),
        savePreviewZoom(previewZoom),
      ]).then(() => refreshSavedSessions());
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeSessionId, isSessionReady, loadedSessionIds, previewZoom, state]);

  useEffect(() => {
    if (!isSessionReady || !controlPanelPosition) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveControlPanelPosition(controlPanelPosition);
    }, 150);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [controlPanelPosition, isSessionReady]);

  useEffect(() => {
    if (!activeControlPanel) {
      return;
    }

    const updatePosition = () => {
      const panelNode = controlPanelRef.current;

      if (!panelNode) {
        return;
      }

      const nextPosition = clampControlPanelPosition(
        controlPanelPosition ?? getDefaultControlPanelPosition(panelNode.offsetWidth),
        panelNode.offsetWidth,
        panelNode.offsetHeight,
      );

      setControlPanelPosition((current) =>
        current && current.x === nextPosition.x && current.y === nextPosition.y ? current : nextPosition,
      );
    };

    const frameId = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePosition);
    };
  }, [activeControlPanel, controlPanelPosition]);

  useEffect(() => {
    if (!isDraggingControlPanel) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const panelNode = controlPanelRef.current;
      const dragOffset = dragOffsetRef.current;

      if (!panelNode || !dragOffset) {
        return;
      }

      setControlPanelPosition(
        clampControlPanelPosition(
          {
            x: event.clientX - dragOffset.x,
            y: event.clientY - dragOffset.y,
          },
          panelNode.offsetWidth,
          panelNode.offsetHeight,
        ),
      );
    };

    const finishDragging = () => {
      dragOffsetRef.current = null;
      setIsDraggingControlPanel(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDragging);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDragging);
    };
  }, [isDraggingControlPanel]);

  useEffect(() => {
    let isCancelled = false;

    if (state.mediaType !== "video" || !state.uploadedMediaUrl) {
      setPreviewVideoDuration(0);
      return;
    }

    void readVideoDimensions(state.uploadedMediaUrl)
      .then(({ duration }) => {
        if (!isCancelled) {
          setPreviewVideoDuration(Number.isFinite(duration) && duration > 0 ? duration : 0);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setPreviewVideoDuration(0);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [state.mediaType, state.uploadedMediaUrl]);

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

  const handleVideoTimeUpdate = (currentTime: number, duration: number) => {
    setPreviewVideoTime(currentTime);
    if (Number.isFinite(duration) && duration > 0) {
      setPreviewVideoDuration(duration);
    }
  };

  const handleSelectCue = (cue: TimelineTextCue) => {
    setSelectedCueId(cue.id);
    setPreviewVideoTime(cue.startTime);
  };

  const handlePreviewFrameChange = (nextTime: number) => {
    setPreviewVideoTime(Math.max(0, nextTime));
  };

  const updateSelectedCue = <K extends keyof TimelineTextCue>(
    key: K,
    value: TimelineTextCue[K],
  ) => {
    if (!selectedCue) {
      return;
    }

    setState((current) => ({
      ...current,
      timelineTextCues: current.timelineTextCues
        .map((cue) =>
          cue.id === selectedCue.id
            ? normalizeCue({
                ...cue,
                [key]: value,
              })
            : cue,
        )
        .sort((a, b) => a.startTime - b.startTime),
    }));
  };

  const addTimelineCue = () => {
    const duration = previewVideoDuration || 6;
    const cueId = createTimelineCueId();

    setState((current) => {
      const latestCueEnd = current.timelineTextCues.reduce(
        (latestEnd, cue) => Math.max(latestEnd, cue.endTime),
        0,
      );
      const startTime = Math.min(
        Math.max(previewVideoTime, latestCueEnd + CUE_GAP_SECONDS),
        Math.max(0, duration - 0.1),
      );
      const cue = normalizeCue({
        id: cueId,
        startTime,
        endTime: Math.min(duration, startTime + 2),
        headline: "",
        subtitle: "",
      });

      return {
        ...current,
        timelineTextCues: [...current.timelineTextCues, cue].sort((a, b) => a.startTime - b.startTime),
      };
    });
    setSelectedCueId(cueId);
  };

  const deleteSelectedCue = () => {
    if (!selectedCue) {
      return;
    }

    setState((current) => ({
      ...current,
      timelineTextCues: current.timelineTextCues.filter((cue) => cue.id !== selectedCue.id),
    }));
    setSelectedCueId(null);
  };

  const moveLoadedSession = (
    draggedId: string,
    targetId: string,
    placement: "before" | "after",
  ) => {
    if (draggedId === targetId) {
      return;
    }

    setLoadedSessionIds((current) => {
      const fromIndex = current.indexOf(draggedId);
      const targetIndex = current.indexOf(targetId);

      if (fromIndex === -1 || targetIndex === -1) {
        return current;
      }

      const next = [...current];
      next.splice(fromIndex, 1);

      const adjustedTargetIndex = next.indexOf(targetId);
      const insertIndex = placement === "before" ? adjustedTargetIndex : adjustedTargetIndex + 1;
      next.splice(insertIndex, 0, draggedId);
      return next;
    });
  };

  const handlePreviewDragStart = (sessionId: string) => {
    if (sessionId === activeSessionId) {
      return;
    }

    setDraggedSessionId(sessionId);
  };

  const handlePreviewDragEnd = () => {
    setDraggedSessionId(null);
  };

  const handlePreviewDragOver = (
    event: import("react").DragEvent<HTMLDivElement>,
    targetId: string,
  ) => {
    if (!draggedSessionId || draggedSessionId === targetId) {
      return;
    }

    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const placement = event.clientX < rect.left + rect.width / 2 ? "before" : "after";
    moveLoadedSession(draggedSessionId, targetId, placement);
  };

  const handleUpload = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);

    if (files.length === 0) {
      return;
    }

    try {
      setIsSessionReady(false);
      const baseState = state;
      const processedFiles = await Promise.all(
        files.map(async (file) => {
          const sessionId = getFileSessionId(file);
          const nextUrl = await readFileAsDataUrl(file);
          const savedSession = await loadEditorSession(sessionId);
          const mediaType: EditorMediaType = file.type.startsWith("video/") ? "video" : "image";
          const restoredState = savedSession
            ? {
                ...initialState,
                ...savedSession.state,
              }
            : null;
          const presetForFile =
            canvasPresets.find(
              (preset) =>
                preset.id === (restoredState?.selectedPresetId ?? baseState.selectedPresetId),
            ) ?? defaultPreset;
          const mediaDimensions =
            mediaType === "video"
              ? await readVideoDimensions(nextUrl)
              : await readImageDimensions(nextUrl);
          const nextState = restoredState
            ? {
                ...restoredState,
                mediaType,
                uploadedScreenshotUrl: mediaType === "image" ? nextUrl : null,
                uploadedMediaUrl: nextUrl,
                mediaName: file.name,
              }
            : {
                ...baseState,
                mediaType,
                uploadedScreenshotUrl: mediaType === "image" ? nextUrl : null,
                uploadedMediaUrl: nextUrl,
                mediaName: file.name,
                timelineTextCues: mediaType === "video" ? [] : baseState.timelineTextCues,
                ...getAutoFitPhoneLayout(
                  baseState,
                  presetForFile,
                  mediaDimensions,
                ),
              };

          await saveEditorSession(sessionId, {
            state: nextState,
          });

          return {
            sessionId,
            state: nextState,
          };
        }),
      );

      const [nextActiveFile] = processedFiles;

      if (!nextActiveFile) {
        return;
      }

      setLoadedSessionIds((current) => {
        const nextIds = [...processedFiles.map((file) => file.sessionId), ...current];
        return nextIds.filter((sessionId, index) => nextIds.indexOf(sessionId) === index);
      });
      setActiveSessionId(nextActiveFile.sessionId);
      setState(nextActiveFile.state);
      setSelectedCueId(nextActiveFile.state.timelineTextCues[0]?.id ?? null);
      setPreviewVideoTime(0);
      setPreviewVideoDuration(0);
      await refreshSavedSessions();
      setStatusMessage(
        files.length === 1
          ? `Loaded ${files[0]?.name}.`
          : `Loaded ${files.length} files into the preview strip.`,
      );
    } catch {
      setStatusMessage("Unable to read that media file.");
    } finally {
      setIsSessionReady(true);
    }
  };

  const handleSelectSavedSession = async (sessionId: string) => {
    try {
      setIsSessionReady(false);
      await activateSession(sessionId);
      const savedSession = await loadEditorSession(sessionId);
      setSelectedCueId(savedSession?.state.timelineTextCues?.[0]?.id ?? null);
      setPreviewVideoTime(0);
      setPreviewVideoDuration(0);
      setLoadedSessionIds((current) =>
        current.includes(sessionId) ? current : [sessionId, ...current],
      );
      setStatusMessage("Restored the saved settings for that file.");
    } catch {
      setStatusMessage("Unable to load that saved file.");
    } finally {
      setIsSessionReady(true);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setStatusMessage(state.mediaType === "video" ? "Rendering your video..." : "Rendering your PNG...");

    try {
      if (state.mediaType === "video") {
        const { blob, extension, isAppleCompatible, label } = await exportStateAsVideo(selectedPreset, state);
        downloadBlob(
          blob,
          `asc-preview-${selectedPreset.width}x${selectedPreset.height}.${extension}`,
        );
        setStatusMessage(
          isAppleCompatible
            ? `Exported ${selectedPreset.width}x${selectedPreset.height} ${label} for QuickTime and Photos.`
            : `Exported ${label}; this browser cannot encode Apple-compatible MP4 locally.`,
        );
      } else {
        const blob = await exportStateAsPng(selectedPreset, state);
        downloadBlob(
          blob,
          `asc-screenshot-${selectedPreset.width}x${selectedPreset.height}.png`,
        );
        setStatusMessage(`Exported ${selectedPreset.width}x${selectedPreset.height} PNG.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to export PNG.";
      setStatusMessage(message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAll = async () => {
    if (loadedPreviewItems.length === 0) {
      setStatusMessage("Load files into the canvas strip to export all.");
      return;
    }

    setIsExporting(true);
    setStatusMessage(`Rendering ${loadedPreviewItems.length} loaded exports...`);

    try {
      for (const item of loadedPreviewItems) {
        const itemPreset =
          canvasPresets.find((preset) => preset.id === item.state.selectedPresetId) ?? defaultPreset;
        if (item.state.mediaType === "video") {
          const { blob, extension } = await exportStateAsVideo(itemPreset, item.state);
          downloadBlob(
            blob,
            `${slugifyFilename(item.displayName)}-${itemPreset.width}x${itemPreset.height}.${extension}`,
          );
        } else {
          const blob = await exportStateAsPng(itemPreset, item.state);
          downloadBlob(
            blob,
            `${slugifyFilename(item.displayName)}-${itemPreset.width}x${itemPreset.height}.png`,
          );
        }
      }

      setStatusMessage(`Exported ${loadedPreviewItems.length} loaded files.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to export all PNGs.";
      setStatusMessage(message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteSavedSession = async (sessionId: string) => {
    try {
      await deleteEditorSession(sessionId);
      const remainingLoadedSessionIds = loadedSessionIds.filter((loadedSessionId) => loadedSessionId !== sessionId);
      setLoadedSessionIds(remainingLoadedSessionIds);

      if (activeSessionId === sessionId) {
        const nextSessionId = remainingLoadedSessionIds[0];

        if (nextSessionId) {
          setIsSessionReady(false);

          try {
            await activateSession(nextSessionId);
          } finally {
            setIsSessionReady(true);
          }
        } else {
          resetToDefaultDraft();
        }
      }

      void refreshSavedSessions();
      setStatusMessage("Deleted saved file.");
    } catch {
      setStatusMessage("Unable to delete that saved file.");
    }
  };

  const handleControlPanelDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    if ((event.target as HTMLElement).closest("button, input, select, textarea, label, a")) {
      return;
    }

    const panelNode = controlPanelRef.current;

    if (!panelNode) {
      return;
    }

    const rect = panelNode.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    setIsDraggingControlPanel(true);
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

        <section className="rounded-[2rem] border border-slate-200 bg-white/85 p-4 shadow-panel">
          <div className="space-y-4">
            <div className="rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] p-3 shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: "files", label: "Files", meta: `${savedSessions.length} saved` },
                  { id: "format", label: "Format", meta: "Text and spacing" },
                  { id: "preview", label: "Preview", meta: `${selectedPreset.width}x${selectedPreset.height}` },
                  {
                    id: "timeline",
                    label: "Timeline",
                    meta: state.mediaType === "video" ? `${state.timelineTextCues.length} cues` : "Image only",
                  },
                  { id: "export", label: "Export", meta: loadedPreviewItems.length > 0 ? `${loadedPreviewItems.length} loaded` : "Single export" },
                  { id: "background", label: "Background", meta: getBackgroundModeLabel(state.backgroundMode) },
                ].map((panel) => (
                  <button
                    key={panel.id}
                    type="button"
                    onClick={() =>
                      setActiveControlPanel((current) => (current === panel.id ? null : (panel.id as ControlPanel)))
                    }
                    className={`rounded-full border px-4 py-2 text-left text-sm transition ${
                      activeControlPanel === panel.id
                        ? "border-slate-900 bg-slate-900 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <span className="block font-semibold">{panel.label}</span>
                    <span className={`block text-[11px] ${activeControlPanel === panel.id ? "text-slate-300" : "text-slate-500"}`}>
                      {panel.meta}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div
              ref={previewViewportRef}
              className="rounded-[1.75rem] bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_35%,#fff_100%)] p-4"
              style={{
                minHeight: previewHeight + 32,
              }}
            >
              <div className="flex gap-5 overflow-x-auto pb-2">
                {loadedPreviewItems.length > 0 ? (
                  loadedPreviewItems.map((item) => {
                    const itemPreset =
                      canvasPresets.find((preset) => preset.id === item.state.selectedPresetId) ??
                      defaultPreset;
                    const itemScale =
                      Math.min(Math.min(previewViewportWidth, 420) / itemPreset.width, fitHeight / itemPreset.height) *
                      previewZoom;

                    return (
                      <div
                        key={item.id}
                        draggable={item.id !== activeSessionId}
                        onClick={() => {
                          if (item.id !== activeSessionId) {
                            void handleSelectSavedSession(item.id);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (
                            item.id !== activeSessionId &&
                            (event.key === "Enter" || event.key === " ")
                          ) {
                            event.preventDefault();
                            void handleSelectSavedSession(item.id);
                          }
                        }}
                        onDragStart={() => handlePreviewDragStart(item.id)}
                        onDragEnd={handlePreviewDragEnd}
                        onDragOver={(event) => handlePreviewDragOver(event, item.id)}
                        role={item.id === activeSessionId ? undefined : "button"}
                        tabIndex={item.id === activeSessionId ? undefined : 0}
                        className={`group relative shrink-0 rounded-[1.7rem] text-left transition ${
                          item.id === activeSessionId
                            ? ""
                            : draggedSessionId === item.id
                              ? "cursor-grabbing opacity-70"
                              : "cursor-grab hover:-translate-y-0.5"
                        }`}
                        style={{
                          width: itemPreset.width * itemScale,
                        }}
                      >
                        <div className="mb-3 flex items-center justify-between gap-3 px-1">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {item.displayName}
                            </div>
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                              {itemPreset.width}x{itemPreset.height}
                            </div>
                          </div>
                          {item.id === activeSessionId ? (
                            <span className="shrink-0 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                              Active
                            </span>
                          ) : null}
                        </div>

                        <div
                          className="relative overflow-visible rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_30px_70px_rgba(15,23,42,0.12)]"
                          style={{
                            height: itemPreset.height * itemScale,
                          }}
                        >
                          <ScreenshotCanvas
                            preset={itemPreset}
                            state={item.state}
                            renderScale={itemScale}
                            interactive={item.id === activeSessionId}
                            currentTime={item.id === activeSessionId ? previewVideoTime : 0}
                            onVideoTimeUpdate={
                              item.id === activeSessionId ? handleVideoTimeUpdate : undefined
                            }
                            onStateChange={item.id === activeSessionId ? handleStateChange : undefined}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
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
                      currentTime={previewVideoTime}
                      onVideoTimeUpdate={handleVideoTimeUpdate}
                      onStateChange={handleStateChange}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {activeControlPanel ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/20 p-4 md:items-start md:pt-24">
          <button
            type="button"
            aria-label="Close editor controls"
            className="absolute inset-0 cursor-default"
            onClick={() => setActiveControlPanel(null)}
          />
          <div
            ref={controlPanelRef}
            className="fixed z-10 w-full max-w-[1180px] rounded-[2rem] border border-white/70 bg-white/95 p-5 shadow-[0_30px_80px_rgba(15,23,42,0.18)] backdrop-blur"
            style={{
              left: controlPanelPosition?.x ?? CONTROL_PANEL_MARGIN,
              top: controlPanelPosition?.y ?? CONTROL_PANEL_DEFAULT_TOP,
            }}
          >
            <div
              onPointerDown={handleControlPanelDragStart}
              className={`flex items-start justify-between gap-4 ${isDraggingControlPanel ? "cursor-grabbing" : "cursor-grab"}`}
            >
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {activeControlPanel === "files"
                    ? "Files"
                    : activeControlPanel === "format"
                      ? "Format"
                    : activeControlPanel === "preview"
                      ? "Preview"
                      : activeControlPanel === "timeline"
                        ? "Timeline"
                        : activeControlPanel === "export"
                          ? "Export"
                          : "Background"}
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {activeControlPanel === "files"
                    ? "Media, presets, and saved sessions"
                    : activeControlPanel === "format"
                      ? "Typography and spacing"
                    : activeControlPanel === "preview"
                      ? "Preview scale controls"
                      : activeControlPanel === "timeline"
                        ? "Video cue editing"
                        : activeControlPanel === "export"
                          ? "Single and batch export"
                          : "Solid and gradient fills"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveControlPanel(null)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
              >
                Close
              </button>
            </div>

            <div className="mt-5 max-h-[72vh] overflow-y-auto pr-1">
              {activeControlPanel === "files" ? (
                <div className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
                    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Source
                      </div>
                      <label className="mt-3 block">
                        <div className="mb-2 text-sm font-medium text-slate-700">
                          Choose file
                        </div>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,video/mp4,video/webm,video/quicktime,video/*"
                          multiple
                          onChange={(event) => {
                            void handleUpload(event.target.files);
                            event.currentTarget.value = "";
                          }}
                          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-3 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
                        />
                        <div className="mt-2 text-sm text-slate-500">
                          Add screenshots or videos. Each file keeps its own saved layout locally.
                        </div>
                      </label>
                    </div>

                    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Preset
                      </div>
                      <label className="mt-3 block">
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
                    </div>
                  </div>

                  {savedSessions.length > 0 ? (
                    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
                      <div className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Saved sessions
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                        {savedSessions.map((session) => (
                          <div
                            key={session.id}
                            onClick={() => void handleSelectSavedSession(session.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                void handleSelectSavedSession(session.id);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            className={`group rounded-[1.2rem] border bg-white p-2 text-left transition ${
                              activeSessionId === session.id
                                ? "border-slate-900 shadow-[0_18px_45px_rgba(15,23,42,0.14)]"
                                : "border-slate-200 hover:border-slate-300 hover:shadow-[0_14px_36px_rgba(15,23,42,0.08)]"
                            }`}
                          >
                            <div className="relative aspect-[9/19.5] overflow-hidden rounded-[0.9rem] bg-slate-100">
                              <button
                                type="button"
                                aria-label={`Delete ${session.displayName}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleDeleteSavedSession(session.id);
                                }}
                                className="absolute right-1.5 top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition hover:bg-red-600"
                              >
                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                                  <path d="M6 12h12" />
                                </svg>
                              </button>

                              <div
                                className="flex h-full w-full items-center justify-center p-2 transition group-hover:scale-[1.02]"
                                style={getBackgroundStyle(session.state)}
                              >
                                <div className="h-full max-h-[160px] w-[64%]">
                                  <PhoneMockup
                                    screenshotUrl={session.mediaType === "image" ? session.previewUrl : null}
                                    videoUrl={session.mediaType === "video" ? session.previewUrl : null}
                                    device={
                                      (canvasPresets.find((preset) => preset.id === session.state.selectedPresetId) ??
                                        defaultPreset).device
                                    }
                                    cornerScale={session.state.phoneCornerScale}
                                    showVideoControls={false}
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 truncate text-xs font-semibold text-slate-800">
                              {session.displayName}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white px-5 py-6 text-sm text-slate-500">
                      Saved files will appear here after you load media into the editor.
                    </div>
                  )}
                </div>
              ) : null}

              {activeControlPanel === "format" ? (
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                    <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Type
                    </div>
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
                  </div>

                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                    <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Spacing
                    </div>
                    <div className="space-y-4">
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
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                    <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Color
                    </div>
                    <div className="space-y-4">
                      <label className="block">
                        <div className="mb-2 text-sm font-medium text-slate-700">
                          Text color
                        </div>
                        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <input
                            type="color"
                            value={state.textColor}
                            onChange={(event) => handleStateChange("textColor", event.target.value)}
                            className="h-11 w-11 cursor-pointer rounded-full"
                          />
                          <span className="text-sm text-slate-600">{state.textColor}</span>
                        </div>
                      </label>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                        Background controls now live in the Background menu.
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeControlPanel === "preview" ? (
                <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.9fr)_minmax(220px,0.7fr)]">
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                    <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Preview
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      Scaled preview of the exact {selectedPreset.width}x{selectedPreset.height} export.
                    </div>
                    <div className="mt-4 inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 shadow-sm">
                      {[1.5, 1, 0.75, 0.5].map((zoom) => (
                        <button
                          key={zoom}
                          type="button"
                          onClick={() => setPreviewZoom(zoom)}
                          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                            previewZoom === zoom
                              ? "bg-slate-900 text-white"
                              : "text-slate-600 hover:bg-white"
                          }`}
                        >
                          {Math.round(zoom * 100)}%
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    Export actions now live in the Export menu.
                  </div>
                </div>
              ) : null}

              {activeControlPanel === "export" ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                    <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Export current
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      Download the active canvas exactly as currently configured.
                    </div>
                    <div className="mt-4">
                      <ExportButton
                        isExporting={isExporting}
                        onExport={handleExport}
                        label={state.mediaType === "video" ? "Export Video" : "Export PNG"}
                      />
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                    <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Export loaded
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      Export the loaded strip in its current order.
                    </div>
                    <div className="mt-4 space-y-3">
                      {loadedPreviewItems.length > 0 ? (
                        <ExportButton
                          isExporting={isExporting}
                          onExport={handleExportAll}
                          label={`Export All Loaded (${loadedPreviewItems.length})`}
                        />
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                          Load files into the canvas strip to export all.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {activeControlPanel === "timeline" ? (
                state.mediaType === "video" ? (
                  <div className="grid gap-4 lg:grid-cols-[minmax(280px,0.9fr)_minmax(220px,0.65fr)_minmax(360px,1.1fr)]">
                    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Timeline
                          </div>
                          <div className="mt-1 text-sm text-slate-500">
                            {formatSeconds(previewVideoTime)} / {formatSeconds(previewVideoDuration)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={addTimelineCue}
                          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
                        >
                          Add cue
                        </button>
                      </div>

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium text-slate-700">Preview frame</span>
                          <span className="text-slate-500">{formatSeconds(previewVideoTime)}</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(previewVideoDuration, 0)}
                          step={0.1}
                          value={Math.min(previewVideoTime, Math.max(previewVideoDuration, 0))}
                          onChange={(event) => handlePreviewFrameChange(Number(event.target.value))}
                          disabled={previewVideoDuration <= 0}
                          className="w-full"
                        />
                        <div className="mt-2 text-sm text-slate-500">
                          Scrub to the frame you want to line up, then place or edit cues.
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                      <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Cues
                      </div>
                      {state.timelineTextCues.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {state.timelineTextCues.map((cue) => (
                            <button
                              key={cue.id}
                              type="button"
                              onClick={() => handleSelectCue(cue)}
                              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                                selectedCue?.id === cue.id
                                  ? "bg-slate-900 text-white"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              {formatSeconds(cue.startTime)}-{formatSeconds(cue.endTime)}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                          Add a cue to start swapping text over time.
                        </div>
                      )}
                    </div>

                    {selectedCue ? (
                      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                        <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Active cue
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="block">
                            <div className="mb-2 text-sm font-medium text-slate-700">
                              Start: {formatSeconds(selectedCue.startTime)}
                            </div>
                            <input
                              type="number"
                              min={0}
                              max={Math.max(previewVideoDuration, selectedCue.endTime)}
                              step={0.1}
                              value={selectedCue.startTime}
                              onChange={(event) => updateSelectedCue("startTime", Number(event.target.value))}
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                            />
                          </label>
                          <label className="block">
                            <div className="mb-2 text-sm font-medium text-slate-700">
                              End: {formatSeconds(selectedCue.endTime)}
                            </div>
                            <input
                              type="number"
                              min={0.1}
                              max={Math.max(previewVideoDuration, selectedCue.endTime)}
                              step={0.1}
                              value={selectedCue.endTime}
                              onChange={(event) => updateSelectedCue("endTime", Number(event.target.value))}
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                            />
                          </label>
                          <label className="block md:col-span-2">
                            <div className="mb-2 text-sm font-medium text-slate-700">Headline</div>
                            <input
                              type="text"
                              value={selectedCue.headline}
                              onChange={(event) => updateSelectedCue("headline", event.target.value)}
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                            />
                          </label>
                          <label className="block md:col-span-2">
                            <div className="mb-2 text-sm font-medium text-slate-700">Subtitle</div>
                            <input
                              type="text"
                              value={selectedCue.subtitle}
                              onChange={(event) => updateSelectedCue("subtitle", event.target.value)}
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={deleteSelectedCue}
                            className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:border-red-200"
                          >
                            Delete cue
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-500">
                    Timeline controls are available when the active file is a video.
                  </div>
                )
              ) : null}

              {activeControlPanel === "background" ? (
                <div className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-4">
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

                  <div className="grid gap-4 md:grid-cols-2">
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
                    <div className="grid gap-4 md:grid-cols-2">
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

                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Preview
                    </div>
                    <div className="h-28 rounded-[1.25rem] border border-slate-200" style={backgroundButtonStyle} />
                  </div>
                </div>
              ) : null}
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

function readVideoDimensions(src: string) {
  return new Promise<{ width: number; height: number; duration: number }>((resolve, reject) => {
    const video = document.createElement("video");

    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
      });
    };

    video.onerror = () => {
      reject(new Error("Unable to read video dimensions."));
    };

    video.preload = "metadata";
    video.src = src;
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

function hasLoadedMedia(state: EditorState) {
  return Boolean(state.uploadedMediaUrl ?? state.uploadedScreenshotUrl);
}

function normalizeCue(cue: TimelineTextCue) {
  const startTime = Math.max(0, Number.isFinite(cue.startTime) ? cue.startTime : 0);
  const endTime = Math.max(
    startTime + 0.1,
    Number.isFinite(cue.endTime) ? cue.endTime : startTime + 2,
  );

  return {
    ...cue,
    startTime: roundToThousandths(startTime),
    endTime: roundToThousandths(endTime),
  };
}

function createTimelineCueId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `cue:${crypto.randomUUID()}`;
  }

  return `cue:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function formatSeconds(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0.0s";
  }

  return `${roundToTenths(value).toFixed(1)}s`;
}

function roundToTenths(value: number) {
  return Math.round(value * 10) / 10;
}

function roundToThousandths(value: number) {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getDefaultControlPanelPosition(panelWidth: number): ControlPanelPosition {
  const viewportWidth = typeof window === "undefined" ? panelWidth + CONTROL_PANEL_MARGIN * 2 : window.innerWidth;
  return {
    x: Math.max((viewportWidth - panelWidth) / 2, CONTROL_PANEL_MARGIN),
    y: CONTROL_PANEL_DEFAULT_TOP,
  };
}

function clampControlPanelPosition(
  position: ControlPanelPosition,
  panelWidth: number,
  panelHeight: number,
): ControlPanelPosition {
  const viewportWidth = typeof window === "undefined" ? panelWidth + CONTROL_PANEL_MARGIN * 2 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? panelHeight + CONTROL_PANEL_MARGIN * 2 : window.innerHeight;

  return {
    x: clamp(position.x, CONTROL_PANEL_MARGIN, Math.max(CONTROL_PANEL_MARGIN, viewportWidth - panelWidth - CONTROL_PANEL_MARGIN)),
    y: clamp(position.y, CONTROL_PANEL_MARGIN, Math.max(CONTROL_PANEL_MARGIN, viewportHeight - panelHeight - CONTROL_PANEL_MARGIN)),
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 1000);
}

function slugifyFilename(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "asc-screenshot";
}

function getDisplayNameFromSessionId(sessionId: string) {
  if (sessionId === DEFAULT_SESSION_ID) {
    return "Current draft";
  }

  const prefix = "file:";

  if (!sessionId.startsWith(prefix)) {
    return "Saved file";
  }

  const remainder = sessionId.slice(prefix.length);
  const sizeSeparator = remainder.lastIndexOf(":");

  if (sizeSeparator === -1) {
    return "Saved file";
  }

  const withoutTimestamp = remainder.slice(0, sizeSeparator);
  const nameSeparator = withoutTimestamp.lastIndexOf(":");

  if (nameSeparator === -1) {
    return withoutTimestamp || "Saved file";
  }

  const withoutSize = withoutTimestamp.slice(0, nameSeparator);
  const typeSeparator = withoutSize.indexOf(":");

  if (typeSeparator !== -1 && withoutSize.slice(0, typeSeparator).includes("/")) {
    return withoutSize.slice(typeSeparator + 1) || "Saved file";
  }

  return withoutSize || "Saved file";
}
