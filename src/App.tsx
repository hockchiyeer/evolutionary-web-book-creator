import { startTransition, useEffect, useEffectEvent, useMemo, useRef, useState, type FormEvent } from "react";
import { Download, History, Loader2, Plus, Search, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { BookResults } from "./components/BookResults";
import { FitnessPanel } from "./components/FitnessPanel";
import { HistorySidebar } from "./components/HistorySidebar";
import { buildOrganizedBook, getBookDisplayTitle, hydrateStoredBook } from "./lib/book";
import { DEFAULT_CONFIG, GAEngine, enrichFrontier } from "./lib/ga";
import { createAiClient, expandQueryToFrontier, generateEditorialImage } from "./lib/google-ai";
import { exportBookAsPdf } from "./lib/pdf";
import type { GAEvolutionSnapshot, WebBook } from "./lib/types";

export default function App() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [book, setBook] = useState<WebBook | null>(null);
  const [history, setHistory] = useState<WebBook[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [gaSnapshot, setGaSnapshot] = useState<GAEvolutionSnapshot | null>(null);

  const ai = useMemo(() => createAiClient(process.env.GEMINI_API_KEY!), []);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("ecwbce_history");
    if (!saved) {
      return;
    }

    try {
      const parsed = JSON.parse(saved);
      const hydratedHistory = Array.isArray(parsed)
        ? parsed.map(hydrateStoredBook).filter((entry): entry is WebBook => entry !== null)
        : [];
      setHistory(hydratedHistory);
    } catch (storageError) {
      console.error("Failed to load history", storageError);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("ecwbce_history", JSON.stringify(history));
  }, [history]);

  const handleExportPdf = async () => {
    if (!book || exportingPdf) {
      return;
    }

    setExportingPdf(true);
    setError(null);

    try {
      await exportBookAsPdf(book);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Failed to export the current web-book as a PDF.",
      );
    } finally {
      setExportingPdf(false);
    }
  };

  const handleGlobalKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const activeTag = document.activeElement?.tagName;

    if (event.key === "/" && activeTag !== "TEXTAREA" && activeTag !== "INPUT") {
      event.preventDefault();
      textareaRef.current?.focus();
      return;
    }

    if (
      (event.ctrlKey || event.metaKey) &&
      event.shiftKey &&
      event.key.toLowerCase() === "e" &&
      book &&
      !loading &&
      !exportingPdf
    ) {
      event.preventDefault();
      void handleExportPdf();
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      handleGlobalKeyDown(event);
    };

    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [handleGlobalKeyDown]);

  const handleSynthesize = async (event?: FormEvent) => {
    event?.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return;
    }

    setLoading(true);
    setBook(null);
    setError(null);
    setStatus("Initializing Query Processor...");
    setGaSnapshot(null);

    try {
      setStatus("Crawling Web Frontier & Expanding Query...");
      const frontier = await expandQueryToFrontier(ai, trimmedQuery);

      setStatus("Pre-processing NLP Features...");
      const enrichedFrontier = enrichFrontier(frontier);

      setStatus("Running Genetic Algorithm Optimization...");
      const engine = new GAEngine(enrichedFrontier);
      const { bestChromosome, bestReport } = await engine.evolve((snapshot) => {
        startTransition(() => {
          setGaSnapshot(snapshot);
        });
      });

      const selectedPages = enrichedFrontier.filter((_, index) => bestChromosome[index]);

      setStatus("Hierarchical Knowledge Organization...");
      const organizedBook = buildOrganizedBook({
        query: trimmedQuery,
        selectedPages,
        fitnessReport: bestReport,
      });

      setStatus("Generating Visual Assets...");
      organizedBook.coverImageUrl = await generateEditorialImage(ai, trimmedQuery);

      const sectionImageCount = Math.min(organizedBook.sections.length, 3);
      for (let index = 0; index < sectionImageCount; index += 1) {
        setStatus(`Generating Visual Assets... (${index + 1}/${sectionImageCount})`);
        organizedBook.sections[index].imageUrl = await generateEditorialImage(
          ai,
          organizedBook.sections[index].title,
        );
      }

      setBook(organizedBook);
      setHistory((currentHistory) => [organizedBook, ...currentHistory]);
      setQuery(trimmedQuery);
    } catch (synthesisError) {
      setError(synthesisError instanceof Error ? synthesisError.message : "Synthesis failed.");
    } finally {
      setLoading(false);
      setStatus("");
      setGaSnapshot(null);
    }
  };

  const handleNewSearch = () => {
    setQuery("");
    setBook(null);
    setError(null);
    setGaSnapshot(null);

    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.overflowY = "hidden";
    }
  };

  const deleteFromHistory = (id: string) => {
    setHistory((currentHistory) => currentHistory.filter((entry) => entry.id !== id));
    if (book?.id === id) {
      setBook(null);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    setBook(null);
  };

  const currentGeneration = gaSnapshot?.generation ?? 0;
  const maxGenerations = gaSnapshot?.maxGenerations ?? DEFAULT_CONFIG.maxGen;
  const progressPercent = maxGenerations > 0 ? (currentGeneration / maxGenerations) * 100 : 0;
  const canSubmit = query.trim().length > 0;
  const activeBookTitle = book ? getBookDisplayTitle(book.title) : "current web-book";

  return (
    <div className="min-h-screen bg-[#E4E3E0] font-sans text-[#141414] selection:bg-[#141414] selection:text-[#E4E3E0]">
      <header className="sticky top-0 z-50 border-b border-[#141414] bg-[#E4E3E0] p-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleNewSearch}
              className="flex h-10 w-10 items-center justify-center rounded-sm bg-[#141414] transition-transform hover:scale-105"
            >
              <Sparkles className="h-6 w-6 text-[#E4E3E0]" />
            </button>
            <div>
              <h1 className="text-xl font-bold uppercase tracking-tighter">ECWBCE</h1>
              <p className="text-[10px] font-mono uppercase tracking-widest opacity-50">
                Evolutionary Knowledge Synthesis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden gap-8 text-[11px] font-mono uppercase tracking-widest opacity-70 md:flex">
              <span>GA-Optimized</span>
              <span>Topic-Specific</span>
              <span>Hierarchical</span>
            </div>

            {book && (
              <button
                type="button"
                onClick={() => {
                  void handleExportPdf();
                }}
                disabled={loading || exportingPdf}
                title="Export PDF (Ctrl/Cmd+Shift+E)"
                aria-label={`Export ${activeBookTitle} as a PDF`}
                className="inline-flex items-center gap-2 rounded-sm border border-[#141414] bg-white/70 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {exportingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Export PDF</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowHistory((open) => !open)}
              className="relative rounded-full p-2 transition-colors hover:bg-[#141414]/5"
              aria-label="Open archived web-books"
            >
              <History className="h-5 w-5" />
              {history.length > 0 && (
                <span className="absolute top-0 right-0 h-2 w-2 rounded-full border-2 border-[#E4E3E0] bg-red-500" />
              )}
            </button>
          </div>
        </div>
      </header>

      <HistorySidebar
        show={showHistory}
        history={history}
        activeBookId={book?.id}
        onClose={() => setShowHistory(false)}
        onClear={clearHistory}
        onDelete={deleteFromHistory}
        onSelect={(entry) => {
          setBook(entry);
          setQuery(entry.query);
          setShowHistory(false);
        }}
      />

      <main className="mx-auto max-w-6xl p-6 md:p-12">
        <section className="mb-24 pt-12">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="mb-8 text-5xl leading-tight tracking-tight md:text-7xl">
                What knowledge shall we{" "}
                <span className="font-serif italic underline decoration-1 underline-offset-8">
                  synthesize
                </span>{" "}
                today?
              </h2>
              <p className="mx-auto max-w-xl text-xs font-mono uppercase tracking-widest opacity-60">
                Evolutionary Computing / Web Knowledge Synthesis / Digital Artifacts
              </p>
            </motion.div>
          </div>

          <div className="mx-auto max-w-3xl">
            <motion.form
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              onSubmit={handleSynthesize}
              className="group relative border-2 border-[#141414] bg-white/40 p-2 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] transition-all hover:shadow-[12px_12px_0px_0px_rgba(20,20,20,1)]"
            >
              <div className="flex items-start gap-4 p-4">
                <div className="mt-4 opacity-30 transition-opacity group-focus-within:opacity-100">
                  <Search className="h-6 w-6" />
                </div>

                <div className="flex-1">
                  <label htmlFor="search-input" className="sr-only">
                    Search for a topic to synthesize
                  </label>
                  <textarea
                    id="search-input"
                    ref={textareaRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Enter a complex topic (for example, 'The impact of microplastics on marine biodiversity')"
                    className="min-h-[100px] w-full resize-none overflow-hidden bg-transparent py-4 font-serif text-2xl italic placeholder:opacity-20 focus:outline-none"
                    rows={1}
                    disabled={loading}
                    onInput={(event) => {
                      const target = event.target as HTMLTextAreaElement;
                      target.style.height = "auto";
                      target.style.height = `${target.scrollHeight}px`;
                      target.style.overflowY = target.scrollHeight > 400 ? "auto" : "hidden";
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleSynthesize();
                      }
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4 border-t border-[#141414]/10 bg-[#141414]/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest opacity-40">
                    <kbd className="rounded border border-[#141414]/20 bg-white/50 px-1.5 py-0.5">
                      Enter
                    </kbd>
                    to Synthesize
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest opacity-40">
                    <kbd className="rounded border border-[#141414]/20 bg-white/50 px-1.5 py-0.5">
                      /
                    </kbd>
                    to Focus
                  </div>
                  {book && (
                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest opacity-40">
                      <kbd className="rounded border border-[#141414]/20 bg-white/50 px-1.5 py-0.5">
                        Ctrl/Cmd+Shift+E
                      </kbd>
                      to Export
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (book) {
                        handleNewSearch();
                      } else {
                        void handleSynthesize();
                      }
                    }}
                    disabled={loading || (!canSubmit && !book)}
                    className="inline-flex items-center gap-2 bg-[#141414] px-6 py-3 font-mono text-xs uppercase tracking-widest text-[#E4E3E0] transition-all hover:scale-105 active:scale-95 disabled:scale-100 disabled:opacity-30"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Synthesizing...
                      </>
                    ) : book ? (
                      <>
                        <Plus className="h-4 w-4" />
                        New Search
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Synthesize
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.form>

            {loading && (
              <div className="mt-12 space-y-6">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  <div className="text-center font-mono text-[10px] uppercase tracking-[0.3em] opacity-60">
                    Current Operation: <span className="font-bold opacity-100">{status}</span>
                  </div>

                  {gaSnapshot && (
                    <div className="mx-auto max-w-3xl space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest opacity-50">
                          <span>Generation {currentGeneration}</span>
                          <span>Target: {maxGenerations}</span>
                        </div>
                        <div
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={maxGenerations}
                          aria-valuenow={currentGeneration}
                          className="h-1.5 overflow-hidden rounded-full bg-[#141414]/10"
                        >
                          <motion.div
                            className="h-full bg-[#141414]"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>

                      <FitnessPanel report={gaSnapshot} live theme="light" />
                    </div>
                  )}
                </motion.div>
              </div>
            )}
          </div>
        </section>

        {error && (
          <div className="mx-auto mb-12 max-w-xl rounded-lg border border-red-500/30 bg-red-500/5 p-6 text-red-600">
            <h3 className="mb-2 font-bold">Operation Error</h3>
            <p className="text-sm opacity-80">{error}</p>
          </div>
        )}

        <AnimatePresence>
          {book && (
            <BookResults
              book={book}
              exportingPdf={exportingPdf}
              onExport={() => {
                void handleExportPdf();
              }}
            />
          )}
        </AnimatePresence>

        {!book && !loading && !error && (
          <div className="mt-32 grid grid-cols-1 gap-12 opacity-30 md:grid-cols-3">
            <div className="space-y-4">
              <Search className="h-8 w-8" />
              <h4 className="font-mono text-xs uppercase tracking-widest">1. Query Expansion</h4>
              <p className="text-sm">Gemini-powered semantic expansion of your search intent.</p>
            </div>
            <div className="space-y-4">
              <Sparkles className="h-8 w-8" />
              <h4 className="font-mono text-xs uppercase tracking-widest">2. GA Optimization</h4>
              <p className="text-sm">
                Weighted selection of the most informative, coherent, authoritative, and novel
                sources.
              </p>
            </div>
            <div className="space-y-4">
              <Download className="h-8 w-8" />
              <h4 className="font-mono text-xs uppercase tracking-widest">3. Portable Output</h4>
              <p className="text-sm">
                Review the live score report, archive results locally, and export a linked PDF.
              </p>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-32 border-t border-[#141414] p-12 text-center">
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] opacity-40">
          Based on Evolutionary Computing-Driven Web Knowledge Synthesis (2024)
        </p>
      </footer>
    </div>
  );
}
