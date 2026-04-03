import type { WebBook } from "./types";
import { createPdfFileName, getBookDisplayTitle, getBookSourceCount } from "./book";

const PDF_COLORS = {
  ink: [20, 20, 20] as const,
  muted: [92, 92, 92] as const,
  accent: [224, 120, 55] as const,
};

export async function exportBookAsPdf(book: WebBook) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 52;
  const contentWidth = pageWidth - margin * 2;
  const footerHeight = 28;
  const sourceCount = book.fitnessReport?.selectedSourceCount ?? getBookSourceCount(book);
  const state = { cursorY: margin };

  const setTextColor = (color: readonly [number, number, number]) => {
    doc.setTextColor(color[0], color[1], color[2]);
  };

  const startNewPage = () => {
    doc.addPage();
    state.cursorY = margin;
  };

  const ensureSpace = (height: number) => {
    if (state.cursorY + height <= pageHeight - margin - footerHeight) {
      return;
    }

    startNewPage();
  };

  const addRule = (spacingBefore = 14, spacingAfter = 14) => {
    state.cursorY += spacingBefore;
    ensureSpace(2 + spacingAfter);
    doc.setDrawColor(PDF_COLORS.ink[0], PDF_COLORS.ink[1], PDF_COLORS.ink[2]);
    doc.setLineWidth(1);
    doc.line(margin, state.cursorY, pageWidth - margin, state.cursorY);
    state.cursorY += spacingAfter;
  };

  const addParagraph = (
    text: string,
    options?: {
      fontSize?: number;
      color?: readonly [number, number, number];
      indent?: number;
      lineHeight?: number;
      gapAfter?: number;
      maxWidth?: number;
      style?: "normal" | "bold" | "italic" | "bolditalic";
    },
  ) => {
    const fontSize = options?.fontSize ?? 11;
    const indent = options?.indent ?? 0;
    const maxWidth = options?.maxWidth ?? contentWidth - indent;
    const lineHeight = options?.lineHeight ?? fontSize * 1.45;
    const lines = doc.splitTextToSize(text, maxWidth);

    doc.setFont("helvetica", options?.style ?? "normal");
    doc.setFontSize(fontSize);
    setTextColor(options?.color ?? PDF_COLORS.ink);

    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, margin + indent, state.cursorY);
      state.cursorY += lineHeight;
    }

    state.cursorY += options?.gapAfter ?? 0;
  };

  const addLinkedUrl = (url: string) => {
    const fontSize = 10;
    const lineHeight = fontSize * 1.45;
    const lines = doc.splitTextToSize(url, contentWidth);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    setTextColor(PDF_COLORS.accent);

    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.textWithLink(line, margin, state.cursorY, { url });
      state.cursorY += lineHeight;
    }
  };

  const addImageBlock = (dataUrl: string, maxHeight: number) => {
    const props = doc.getImageProperties(dataUrl);
    const scale = Math.min(contentWidth / props.width, maxHeight / props.height);
    const width = props.width * scale;
    const height = props.height * scale;

    ensureSpace(height + 12);
    doc.addImage(dataUrl, props.fileType || "PNG", margin, state.cursorY, width, height);
    state.cursorY += height + 12;
  };

  const addSourceCard = (title: string, url: string, summary: string, index: number) => {
    addParagraph(`${index}. ${title}`, {
      fontSize: 13,
      style: "bold",
      gapAfter: 4,
    });
    addLinkedUrl(url);
    addParagraph(summary, {
      color: PDF_COLORS.muted,
      gapAfter: 10,
    });
    addRule(0, 12);
  };

  const addFooter = (pageIndex: number, totalPages: number) => {
    doc.setPage(pageIndex);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setTextColor(PDF_COLORS.muted);
    doc.text(getBookDisplayTitle(book.title), margin, pageHeight - 16);
    doc.text(`${pageIndex} / ${totalPages}`, pageWidth - margin, pageHeight - 16, { align: "right" });
  };

  doc.setProperties({
    title: book.title,
    subject: `Exported web-book for ${book.query}`,
    author: "ECWBCE",
    creator: "ECWBCE",
    keywords: "web-book, evolutionary computing, gemini, pdf export",
  });

  setTextColor(PDF_COLORS.muted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("ECWBCE / Evolutionary Web-Book Creator", margin, state.cursorY);
  state.cursorY += 26;

  addParagraph(getBookDisplayTitle(book.title), {
    fontSize: 26,
    style: "bold",
    lineHeight: 30,
    gapAfter: 6,
  });
  addParagraph(
    `${book.sections.length} sections / ${sourceCount} curated sources / ${new Date(book.timestamp).toLocaleString()}`,
    {
      fontSize: 11,
      color: PDF_COLORS.muted,
      gapAfter: 18,
    },
  );

  if (book.coverImageUrl) {
    addImageBlock(book.coverImageUrl, 250);
  }

  addParagraph(
    "This PDF is generated directly from the current in-app web-book so it stays independent of the surrounding AI Studio shell and browser print behavior.",
    {
      fontSize: 11,
      color: PDF_COLORS.muted,
      gapAfter: 14,
    },
  );

  if (book.fitnessReport) {
    addRule(0, 16);
    addParagraph("Selection metrics", {
      fontSize: 16,
      style: "bold",
      gapAfter: 10,
    });
    addParagraph(`Overall fitness: ${book.fitnessReport.overallFitness.toFixed(3)}`, {
      fontSize: 11,
      gapAfter: 2,
    });
    addParagraph(`Definitional density: ${book.fitnessReport.definitionalDensity.toFixed(3)}`, {
      fontSize: 11,
      gapAfter: 2,
    });
    addParagraph(`Semantic coherence: ${book.fitnessReport.semanticCoherence.toFixed(3)}`, {
      fontSize: 11,
      gapAfter: 2,
    });
    addParagraph(`Topical authority: ${book.fitnessReport.topicalAuthority.toFixed(3)}`, {
      fontSize: 11,
      gapAfter: 2,
    });
    addParagraph(`Content novelty: ${book.fitnessReport.contentNovelty.toFixed(3)}`, {
      fontSize: 11,
      gapAfter: 8,
    });
  }

  addRule(0, 16);
  addParagraph("Table of contents", {
    fontSize: 16,
    style: "bold",
    gapAfter: 10,
  });

  book.sections.forEach((section, index) => {
    addParagraph(`${String(index + 1).padStart(2, "0")}. ${section.title} (${section.pages.length} sources)`, {
      fontSize: 12,
      gapAfter: 4,
    });
  });

  book.sections.forEach((section, sectionIndex) => {
    startNewPage();

    addParagraph(`Section ${String(sectionIndex + 1).padStart(2, "0")}`, {
      fontSize: 10,
      color: PDF_COLORS.muted,
      gapAfter: 8,
    });
    addParagraph(section.title, {
      fontSize: 22,
      style: "bold",
      lineHeight: 26,
      gapAfter: 12,
    });

    if (section.imageUrl) {
      addImageBlock(section.imageUrl, 170);
    }

    addParagraph(`${section.pages.length} source summaries`, {
      fontSize: 11,
      color: PDF_COLORS.muted,
      gapAfter: 10,
    });
    addRule(0, 12);

    section.pages.forEach((page, pageIndex) => {
      addSourceCard(page.title, page.url, page.summary, pageIndex + 1);
    });
  });

  const totalPages = doc.getNumberOfPages();
  for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
    addFooter(pageIndex, totalPages);
  }

  const blob = doc.output("blob");
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = createPdfFileName(book);
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}
