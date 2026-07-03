"use client";

type ExportButtonProps = {
  isExporting: boolean;
  onExport: () => void;
  label?: string;
};

export function ExportButton({
  isExporting,
  onExport,
  label = "Export PNG",
}: ExportButtonProps) {
  return (
    <button
      type="button"
      onClick={onExport}
      disabled={isExporting}
      className="w-full rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-500 disabled:cursor-wait disabled:bg-blue-300"
    >
      {isExporting ? "Exporting PNG..." : label}
    </button>
  );
}
