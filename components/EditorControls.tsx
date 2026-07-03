import type { EditorState } from "@/lib/types";

type EditorControlsProps = {
  state: EditorState;
  onStateChange: <K extends keyof EditorState>(key: K, value: EditorState[K]) => void;
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

export function EditorControls({ state, onStateChange }: EditorControlsProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-panel">
        <div className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
          Style
        </div>
        <div className="space-y-4">
          <ControlGroup label="Text position">
            <div className="grid grid-cols-2 gap-3">
              {(["top", "bottom"] as const).map((position) => (
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
          <ControlGroup label={`Title line spacing: ${state.titleLineHeight.toFixed(2)}x`}>
            <input
              type="range"
              min={0.9}
              max={1.4}
              step={0.01}
              value={state.titleLineHeight}
              onChange={(event) => onStateChange("titleLineHeight", Number(event.target.value))}
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

    </div>
  );
}
