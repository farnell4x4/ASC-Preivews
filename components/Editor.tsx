"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { EditorControls } from "@/components/EditorControls";
import { ExportButton } from "@/components/ExportButton";
import { ScreenshotCanvas } from "@/components/ScreenshotCanvas";
import { defaultPreset, canvasPresets } from "@/lib/canvasPresets";
import { exportNodeAsPng } from "@/lib/exportImage";
import type { EditorState } from "@/lib/types";

const initialState: EditorState = {
  selectedPresetId: defaultPreset.id,
  uploadedScreenshotUrl: null,
  headline: "Track what matters",
  subtitle: "Simple. Clean. Focused.",
  textPosition: "top",
  fontSize: 144,
  textColor: "#0f172a",
  backgroundColor: "#f8fafc",
  phoneScale: 0.92,
  phoneX: 50,
  phoneY: 52.5,
  phoneRotation: 0,
  phoneWidthScale: 1,
  phoneHeightScale: 1,
  phoneCornerScale: 1,
  textSpacing: 28,
};

export function Editor() {
  const [state, setState] = useState<EditorState>(initialState);
  const [isExporting, setIsExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Ready to export exact ASC-sized PNGs.");
  const exportRef = useRef<HTMLDivElement>(null);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(420);

  const selectedPreset = useMemo(
    () => canvasPresets.find((preset) => preset.id === state.selectedPresetId) ?? defaultPreset,
    [state.selectedPresetId],
  );
  const previewScale = previewWidth / selectedPreset.width;

  useEffect(() => {
    const node = previewFrameRef.current;

    if (!node) {
      return;
    }

    const updateWidth = () => {
      setPreviewWidth(node.getBoundingClientRect().width || 420);
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
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
      const nextUrl = await readFileAsDataUrl(file);
      handleStateChange("uploadedScreenshotUrl", nextUrl);
      setStatusMessage(`Loaded ${file.name}.`);
    } catch {
      setStatusMessage("Unable to read that image file.");
    }
  };

  const handleExport = async () => {
    if (!exportRef.current) {
      return;
    }

    setIsExporting(true);
    setStatusMessage("Rendering your PNG...");

    try {
      const blob = await exportNodeAsPng(
        exportRef.current,
        selectedPreset.width,
        selectedPreset.height,
      );
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

        <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)_280px]">
          <aside>
            <EditorControls
              state={state}
              onStateChange={handleStateChange}
              onUpload={handleUpload}
            />
          </aside>

          <section className="rounded-[2rem] border border-slate-200 bg-white/85 p-4 shadow-panel">
            <div className="mb-4 flex items-center justify-between px-1">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Preview
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Scaled preview of the exact {selectedPreset.width}x{selectedPreset.height} export.
                </div>
              </div>
            </div>

            <div className="flex min-h-[720px] items-center justify-center rounded-[1.75rem] bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_35%,#fff_100%)] p-4">
              <div
                ref={previewFrameRef}
                className="relative w-full max-w-[420px] overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_30px_70px_rgba(15,23,42,0.12)]"
                style={{
                  aspectRatio: `${selectedPreset.width} / ${selectedPreset.height}`,
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
          </section>

          <aside className="space-y-4">
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-panel">
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                Export
              </div>
              <div className="mt-3 text-sm leading-6 text-slate-600">
                Downloads a PNG at the exact preset size instead of the smaller preview size.
              </div>
              <div className="mt-5">
                <ExportButton isExporting={isExporting} onExport={handleExport} />
              </div>
              <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Filename: asc-screenshot-{selectedPreset.width}x{selectedPreset.height}.png
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-panel">
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                Tips
              </div>
              <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                <li>Use tall screenshots so the phone crop feels intentional.</li>
                <li>Keep headlines short for cleaner App Store compositions.</li>
                <li>Switch presets before export to generate each required size.</li>
              </ul>
            </div>
          </aside>
        </section>
      </div>

      <div className="pointer-events-none fixed left-[-10000px] top-0 opacity-0">
        <div
          ref={exportRef}
          style={{
            width: selectedPreset.width,
            height: selectedPreset.height,
          }}
        >
          <ScreenshotCanvas preset={selectedPreset} state={state} />
        </div>
      </div>
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
