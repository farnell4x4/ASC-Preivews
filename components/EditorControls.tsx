import { canvasPresets } from "@/lib/canvasPresets";
import type { EditorState, TextPosition } from "@/lib/types";

type EditorControlsProps = {
  state: EditorState;
  onStateChange: <K extends keyof EditorState>(key: K, value: EditorState[K]) => void;
  onUpload: (file: File | null) => void;
};

function ControlGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-slate-700">{label}</div>
      {children}
    </label>
  );
}

export function EditorControls({ state, onStateChange, onUpload }: EditorControlsProps) {
  const handlePhoneScaleInput = (value: string) => {
    const nextValue = Number(value);

    if (Number.isFinite(nextValue) && nextValue > 0) {
      onStateChange("phoneScale", nextValue);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-panel">
        <div className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
          Canvas
        </div>
        <div className="space-y-4">
          <ControlGroup label="ASC preset">
            <select
              value={state.selectedPresetId}
              onChange={(event) => onStateChange("selectedPresetId", event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-0 transition focus:border-blue-400"
            >
              {canvasPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label} ({preset.width}x{preset.height})
                </option>
              ))}
            </select>
          </ControlGroup>

          <ControlGroup label="Upload screenshot">
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={(event) => onUpload(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
            />
          </ControlGroup>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-panel">
        <div className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
          Copy
        </div>
        <div className="space-y-4">
          <ControlGroup label="Headline">
            <input
              value={state.headline}
              onChange={(event) => onStateChange("headline", event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-400"
            />
          </ControlGroup>
          <ControlGroup label="Subtitle">
            <input
              value={state.subtitle}
              onChange={(event) => onStateChange("subtitle", event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-400"
            />
          </ControlGroup>
          <ControlGroup label="Text position">
            <div className="grid grid-cols-2 gap-3">
              {(["top", "bottom"] as TextPosition[]).map((position) => (
                <button
                  key={position}
                  type="button"
                  onClick={() => onStateChange("textPosition", position)}
                  className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    state.textPosition === position
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {position === "top" ? "Top" : "Bottom"}
                </button>
              ))}
            </div>
          </ControlGroup>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-panel">
        <div className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
          Style
        </div>
        <div className="space-y-4">
          <ControlGroup label={`Font size: ${state.fontSize}px`}>
            <input
              type="range"
              min={92}
              max={192}
              step={2}
              value={state.fontSize}
              onChange={(event) => onStateChange("fontSize", Number(event.target.value))}
              className="w-full"
            />
          </ControlGroup>
          <ControlGroup label={`Text spacing: ${state.textSpacing}px`}>
            <input
              type="range"
              min={18}
              max={72}
              step={2}
              value={state.textSpacing}
              onChange={(event) => onStateChange("textSpacing", Number(event.target.value))}
              className="w-full"
            />
          </ControlGroup>
          <div className="grid grid-cols-2 gap-4">
            <ControlGroup label="Text color">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <input
                  type="color"
                  value={state.textColor}
                  onChange={(event) => onStateChange("textColor", event.target.value)}
                  className="h-11 w-11 cursor-pointer rounded-full"
                />
                <span className="text-sm text-slate-600">{state.textColor}</span>
              </div>
            </ControlGroup>
            <ControlGroup label="Background color">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <input
                  type="color"
                  value={state.backgroundColor}
                  onChange={(event) => onStateChange("backgroundColor", event.target.value)}
                  className="h-11 w-11 cursor-pointer rounded-full"
                />
                <span className="text-sm text-slate-600">{state.backgroundColor}</span>
              </div>
            </ControlGroup>
          </div>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-panel">
        <div className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
          Layout
        </div>
        <div className="space-y-4">
          <ControlGroup label={`Phone size: ${state.phoneScale.toFixed(2)}x`}>
            <div className="space-y-3">
              <input
                type="range"
                min={0.2}
                max={3}
                step={0.01}
                value={Math.min(state.phoneScale, 3)}
                onChange={(event) => onStateChange("phoneScale", Number(event.target.value))}
                className="w-full"
              />
              <input
                type="number"
                min={0.1}
                step={0.01}
                value={state.phoneScale}
                onChange={(event) => handlePhoneScaleInput(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-400"
              />
            </div>
          </ControlGroup>
          <ControlGroup label={`Phone horizontal position: ${state.phoneX.toFixed(1)}%`}>
            <input
              type="range"
              min={-50}
              max={150}
              step={0.5}
              value={state.phoneX}
              onChange={(event) => onStateChange("phoneX", Number(event.target.value))}
              className="w-full"
            />
          </ControlGroup>
          <ControlGroup label={`Phone vertical position: ${state.phoneY.toFixed(1)}%`}>
            <input
              type="range"
              min={-50}
              max={150}
              step={0.5}
              value={state.phoneY}
              onChange={(event) => onStateChange("phoneY", Number(event.target.value))}
              className="w-full"
            />
          </ControlGroup>
          <ControlGroup label={`Phone rotation: ${state.phoneRotation.toFixed(0)}deg`}>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={state.phoneRotation}
              onChange={(event) => onStateChange("phoneRotation", Number(event.target.value))}
              className="w-full"
            />
          </ControlGroup>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
            Drag the phone directly in the preview to place it anywhere on the canvas.
          </div>
        </div>
      </div>
    </div>
  );
}
