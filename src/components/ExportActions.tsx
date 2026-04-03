import { Download, Loader2 } from "lucide-react";

interface ExportActionsProps {
  bookTitle: string;
  exporting: boolean;
  onExport: () => void;
  className?: string;
}

export function ExportActions({
  bookTitle,
  exporting,
  onExport,
  className = "",
}: ExportActionsProps) {
  return (
    <section
      className={`rounded-sm border border-[#141414] bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(255,244,235,0.88))] p-5 shadow-[8px_8px_0px_0px_rgba(20,20,20,0.16)] ${className}`.trim()}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.25em] opacity-60">
            Portable Output
          </p>
          <h3 className="text-2xl font-serif italic">Export a linked PDF edition</h3>
          <p className="max-w-2xl text-sm leading-relaxed opacity-70">
            Download the active web-book with section navigation, source links, and the live GA
            fitness report that shaped the final selection.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[18rem]">
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            aria-label={`Export ${bookTitle} as a PDF`}
            className="inline-flex items-center justify-center gap-2 rounded-sm bg-[#141414] px-5 py-3 font-mono text-xs uppercase tracking-[0.25em] text-[#E4E3E0] transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export PDF
              </>
            )}
          </button>

          <p className="text-center text-[10px] font-mono uppercase tracking-widest opacity-55 sm:text-right">
            Desktop shortcut: Ctrl / Cmd + Shift + E. On mobile, use the export button.
          </p>
        </div>
      </div>
    </section>
  );
}
