import { ExternalLink, Info, Layers } from "lucide-react";
import { motion } from "motion/react";

import { getBookDisplayTitle, getBookSourceCount } from "../lib/book";
import type { WebBook } from "../lib/types";
import { ExportActions } from "./ExportActions";
import { FitnessPanel } from "./FitnessPanel";

interface BookResultsProps {
  book: WebBook;
  exportingPdf: boolean;
  onExport: () => void;
}

export function BookResults({ book, exportingPdf, onExport }: BookResultsProps) {
  const displayTitle = getBookDisplayTitle(book.title);
  const sourceCount = getBookSourceCount(book);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid grid-cols-1 gap-12 lg:grid-cols-12"
    >
      <aside className="hidden min-w-0 border-r border-[#141414]/10 pr-8 lg:col-span-4 lg:block">
        <div className="sticky top-32 space-y-10">
          <div>
            <h3 className="mb-8 text-xs font-mono uppercase tracking-widest opacity-50">
              Table of Contents
            </h3>
            <nav className="space-y-6">
              {book.sections.map((section, index) => (
                <div key={`${section.title}-${index}`}>
                  <a
                    href={`#section-${index}`}
                    className="group flex items-center gap-2 transition-transform hover:translate-x-1"
                  >
                    <span className="text-[10px] font-mono opacity-30">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 break-words text-lg font-serif italic underline-offset-4 group-hover:underline">
                      {section.title}
                    </span>
                  </a>
                </div>
              ))}
            </nav>
          </div>

          <FitnessPanel report={book.fitnessReport} theme="dark" compact />
        </div>
      </aside>

      <div className="space-y-14 lg:col-span-8 lg:space-y-24">
        <div className="space-y-8 border-b border-[#141414] pb-12">
          <div className="lg:hidden">
            <ExportActions
              bookTitle={displayTitle}
              exporting={exportingPdf}
              onExport={onExport}
            />
          </div>

          {book.coverImageUrl && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="aspect-[21/9] overflow-hidden rounded-sm border border-[#141414]/10"
            >
              <img
                src={book.coverImageUrl}
                alt={book.title}
                className="h-full w-full object-cover grayscale transition-all duration-700 hover:grayscale-0"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          )}

          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-4">
              <h2 className="text-5xl font-bold uppercase leading-none tracking-tighter md:text-7xl xl:text-8xl">
                {displayTitle}
              </h2>
              <p className="text-xs font-mono uppercase tracking-widest opacity-50">
                A Synthesized Knowledge Corpus / {new Date(book.timestamp).toLocaleDateString()}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-widest opacity-60">
              <span className="rounded-full border border-[#141414]/15 px-3 py-2">
                {book.sections.length} Sections
              </span>
              <span className="rounded-full border border-[#141414]/15 px-3 py-2">
                {sourceCount} Sources
              </span>
              <span className="rounded-full border border-[#141414]/15 px-3 py-2">PDF Ready</span>
            </div>
          </div>

          <div className="hidden lg:block">
            <ExportActions
              bookTitle={displayTitle}
              exporting={exportingPdf}
              onExport={onExport}
            />
          </div>

          <div className="lg:hidden">
            <FitnessPanel report={book.fitnessReport} theme="light" />
          </div>
        </div>

        {book.sections.map((section, sectionIndex) => (
          <section key={`${section.title}-${sectionIndex}`} id={`section-${sectionIndex}`} className="space-y-12">
            <div className="flex items-baseline gap-4 border-b border-[#141414]/10 pb-4">
              <span className="text-4xl font-serif italic text-[#141414]/20">
                {String(sectionIndex + 1).padStart(2, "0")}
              </span>
              <h3 className="text-3xl font-serif italic">{section.title}</h3>
            </div>

            {section.imageUrl && (
              <div className="aspect-video overflow-hidden rounded-sm border border-[#141414]/10 bg-white/20">
                <img
                  src={section.imageUrl}
                  alt={section.title}
                  className="h-full w-full object-cover grayscale transition-all duration-700 hover:grayscale-0"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-8">
              {section.pages.map((page, pageIndex) => (
                <motion.article
                  key={`${page.url}-${pageIndex}`}
                  whileHover={{ x: 10 }}
                  className="group rounded-sm border border-[#141414]/10 bg-white/30 p-8 backdrop-blur-sm transition-colors hover:border-[#141414]"
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <h4 className="text-xl font-bold underline-offset-4 group-hover:underline">
                      {page.title}
                    </h4>
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-30 transition-opacity hover:opacity-100"
                    >
                      <ExternalLink className="h-5 w-5" />
                    </a>
                  </div>

                  <p className="mb-6 leading-relaxed text-[#141414]/70">{page.summary}</p>

                  <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono uppercase tracking-widest opacity-40">
                    <span className="flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      Source Node
                    </span>
                    <span className="flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Verified Content
                    </span>
                  </div>
                </motion.article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </motion.div>
  );
}
