import { Book, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { getBookDisplayTitle, getBookSourceCount } from "../lib/book";
import type { WebBook } from "../lib/types";

interface HistorySidebarProps {
  show: boolean;
  history: WebBook[];
  activeBookId?: string | null;
  onClose: () => void;
  onClear: () => void;
  onDelete: (id: string) => void;
  onSelect: (book: WebBook) => void;
}

export function HistorySidebar({
  show,
  history,
  activeBookId,
  onClose,
  onClear,
  onDelete,
  onSelect,
}: HistorySidebarProps) {
  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm"
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Archived web-books"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            className="fixed right-0 top-0 bottom-0 z-[70] w-full max-w-md overflow-y-auto border-l border-[#141414] bg-[#E4E3E0] p-8"
          >
            <div className="mb-12 flex items-center justify-between">
              <h2 className="text-2xl font-serif italic">Archived Web-Books</h2>
              <div className="flex gap-4">
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest opacity-40 hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear All
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="text-[10px] font-mono uppercase tracking-widest opacity-40 hover:opacity-100"
                >
                  Close
                </button>
              </div>
            </div>

            {history.length === 0 ? (
              <div className="mt-32 space-y-4 text-center opacity-30">
                <Book className="mx-auto h-12 w-12" />
                <p className="font-mono text-xs uppercase tracking-widest">No history yet</p>
              </div>
            ) : (
              <div className="space-y-8">
                {history.map((entry) => {
                  const active = entry.id === activeBookId;
                  return (
                    <article key={entry.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => onSelect(entry)}
                        className={`w-full rounded-sm border p-6 pr-14 text-left transition-all ${
                          active
                            ? "border-[#141414] bg-white/60"
                            : "border-[#141414]/10 bg-white/20 hover:border-[#141414] hover:bg-white/40"
                        }`}
                      >
                        <div className="mb-2 flex justify-between gap-4">
                          <span className="text-[10px] font-mono uppercase tracking-widest opacity-40">
                            {new Date(entry.timestamp).toLocaleDateString()}
                          </span>
                          {active && (
                            <span className="text-[10px] font-mono uppercase tracking-widest opacity-50">
                              Active
                            </span>
                          )}
                        </div>

                        <h3 className="mb-2 text-xl font-serif italic">
                          {getBookDisplayTitle(entry.title)}
                        </h3>
                        <p className="text-[10px] font-mono uppercase tracking-widest opacity-40">
                          {entry.sections.length} Sections / {getBookSourceCount(entry)} Sources
                        </p>
                      </button>

                      <button
                        type="button"
                        aria-label={`Delete ${getBookDisplayTitle(entry.title)} from history`}
                        onClick={() => onDelete(entry.id)}
                        className="absolute top-6 right-6 opacity-30 transition-opacity hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
