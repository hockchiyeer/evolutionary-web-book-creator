import { kmeans } from "ml-kmeans";

import { DEFAULT_CONFIG, calculateWeightedFitness, tokenize } from "./ga";
import type { FitnessMetrics, GAFitnessReport, WebBook, WebPage } from "./types";

function toTitleCase(term: string) {
  return term
    .split(/[_-]+/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function createSectionTitle(pages: WebPage[]) {
  const labelTerms = Array.from(
    new Set(
      pages
        .flatMap((page) => page.topTerms || [])
        .filter((term) => term.length > 2),
    ),
  ).slice(0, 3);

  if (labelTerms.length > 0) {
    return labelTerms.map(toTitleCase).join(" / ");
  }

  const fallbackTerms = tokenize(pages.map((page) => page.content).join(" "))
    .filter((term) => term.length > 3)
    .slice(0, 3);

  if (fallbackTerms.length > 0) {
    return fallbackTerms.map(toTitleCase).join(" / ");
  }

  return pages[0]?.title || "Untitled Section";
}

export function getBookDisplayTitle(title: string) {
  return title.replace(/^Web-Book:\s*/i, "").trim() || title;
}

export function createPdfFileName(book: WebBook) {
  const base = getBookDisplayTitle(book.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${base || "web-book"}.pdf`;
}

export function getBookSourceCount(book: Pick<WebBook, "sections">) {
  return book.sections.reduce((count, section) => count + section.pages.length, 0);
}

function createBookId() {
  return globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 11);
}

export function buildOrganizedBook(params: {
  query: string;
  selectedPages: WebPage[];
  fitnessReport: GAFitnessReport;
  timestamp?: number;
}): WebBook {
  const { query, selectedPages, fitnessReport, timestamp = Date.now() } = params;

  if (selectedPages.length === 0) {
    throw new Error("GA failed to select any informative pages.");
  }

  const selectedVectors = selectedPages.map((page) => page.tfidfVector || []);
  const numClusters = Math.min(selectedPages.length, 5);
  const clusters = kmeans(selectedVectors, numClusters, {});

  const sections: WebBook["sections"] = [];
  for (let clusterIndex = 0; clusterIndex < numClusters; clusterIndex += 1) {
    const clusterPages = selectedPages.filter((_, pageIndex) => clusters.clusters[pageIndex] === clusterIndex);
    if (clusterPages.length === 0) {
      continue;
    }

    sections.push({
      title: createSectionTitle(clusterPages),
      pages: clusterPages.map((page) => ({
        title: page.title,
        url: page.url,
        summary: page.snippet,
      })),
    });
  }

  return {
    id: createBookId(),
    title: `Web-Book: ${query}`,
    query,
    sections,
    fitnessReport,
    timestamp,
  };
}

function isFitnessMetrics(value: unknown): value is FitnessMetrics {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return [
    "definitionalDensity",
    "semanticCoherence",
    "topicalAuthority",
    "contentNovelty",
  ].every((key) => typeof candidate[key] === "number");
}

function normalizeFitnessReport(
  fitnessReport: unknown,
  fallbackMetrics: unknown,
  selectedSourceCount: number,
): GAFitnessReport | undefined {
  if (fitnessReport && typeof fitnessReport === "object") {
    const candidate = fitnessReport as Record<string, unknown>;
    if (isFitnessMetrics(candidate)) {
      const metrics = candidate as FitnessMetrics;
      return {
        overallFitness:
          typeof candidate.overallFitness === "number"
            ? candidate.overallFitness
            : calculateWeightedFitness(metrics, DEFAULT_CONFIG.weights),
        selectedSourceCount:
          typeof candidate.selectedSourceCount === "number"
            ? candidate.selectedSourceCount
            : selectedSourceCount,
        ...metrics,
      };
    }
  }

  if (isFitnessMetrics(fallbackMetrics)) {
    return {
      overallFitness: calculateWeightedFitness(fallbackMetrics, DEFAULT_CONFIG.weights),
      selectedSourceCount,
      ...fallbackMetrics,
    };
  }

  return undefined;
}

export function hydrateStoredBook(value: unknown): WebBook | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.title !== "string" ||
    typeof candidate.query !== "string" ||
    !Array.isArray(candidate.sections)
  ) {
    return null;
  }

  const draftBook = {
    id: candidate.id,
    title: candidate.title,
    query: candidate.query,
    sections: candidate.sections,
  } as WebBook;

  return {
    ...draftBook,
    coverImageUrl: typeof candidate.coverImageUrl === "string" ? candidate.coverImageUrl : undefined,
    fitnessReport: normalizeFitnessReport(
      candidate.fitnessReport,
      candidate.metrics,
      getBookSourceCount(draftBook),
    ),
    timestamp: typeof candidate.timestamp === "number" ? candidate.timestamp : Date.now(),
  };
}
