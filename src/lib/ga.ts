import type {
  GAConfig,
  GAEvolutionSnapshot,
  GAFitnessReport,
  FitnessMetrics,
  WebPage,
} from "./types";

export const DEFAULT_CONFIG: GAConfig = {
  popSize: 50,
  maxGen: 50,
  crossoverRate: 0.85,
  mutationRate: 0.01,
  elitismRate: 0.1,
  weights: {
    def: 0.35,
    sem: 0.25,
    auth: 0.25,
    nov: 0.15,
  },
};

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/\b\w+\b/g) || [];
}

function buildTfIdfFeatureSpace(pages: WebPage[]) {
  const docCount = pages.length;
  const termDocCounts: Record<string, number> = {};
  const docTermFreqs: Record<string, number>[] = [];
  const allTerms = new Set<string>();

  pages.forEach((page, index) => {
    const tokens = tokenize(page.content);
    const freqs: Record<string, number> = {};
    const seenInDoc = new Set<string>();

    tokens.forEach((token) => {
      freqs[token] = (freqs[token] || 0) + 1;
      if (!seenInDoc.has(token)) {
        termDocCounts[token] = (termDocCounts[token] || 0) + 1;
        seenInDoc.add(token);
        allTerms.add(token);
      }
    });

    docTermFreqs[index] = freqs;
  });

  const termList = Array.from(allTerms);
  const vectors = pages.map((_, index) => {
    const freqs = docTermFreqs[index];
    return termList.map((term) => {
      const tf = freqs[term] || 0;
      const idf = Math.log(docCount / (termDocCounts[term] || 1));
      return tf * idf;
    });
  });

  return { termList, vectors };
}

function extractTopTerms(termList: string[], vector: number[], limit = 24): string[] {
  const rankedTerms = vector
    .map((weight, index) => ({ term: termList[index], weight }))
    .filter(({ term, weight }) => weight > 0 && term.length > 2)
    .sort((left, right) => right.weight - left.weight)
    .slice(0, limit)
    .map(({ term }) => term);

  return Array.from(new Set(rankedTerms));
}

export function enrichFrontier(pages: WebPage[]): WebPage[] {
  const { termList, vectors } = buildTfIdfFeatureSpace(pages);

  return pages.map((page, index) => {
    const vector = vectors[index];
    const topTerms = extractTopTerms(termList, vector);

    return {
      ...page,
      tfidfVector: vector,
      topTerms: topTerms.length > 0 ? topTerms : tokenize(page.content).slice(0, 24),
    };
  });
}

function cosineSimilarity(left: number[], right: number[]): number {
  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dotProduct += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  leftMagnitude = Math.sqrt(leftMagnitude);
  rightMagnitude = Math.sqrt(rightMagnitude);

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dotProduct / (leftMagnitude * rightMagnitude);
}

function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  const intersection = new Set([...left].filter((value) => right.has(value)));
  const union = new Set([...left, ...right]);

  if (union.size === 0) {
    return 0;
  }

  return intersection.size / union.size;
}

export function calculateDefinitionalDensity(content: string): number {
  const patterns = [
    /\b(is|are|was|were) (a|an|the|defined as|known as)\b/i,
    /\brefers to\b/i,
    /\bmeans\b/i,
    /\bdenotes\b/i,
    /\bdefinition of\b/i,
  ];

  let count = 0;
  patterns.forEach((pattern) => {
    const matches = content.match(pattern);
    if (matches) {
      count += matches.length;
    }
  });

  const wordCount = tokenize(content).length;
  return wordCount > 0 ? count / wordCount : 0;
}

export function calculateFitnessMetrics(selectedPages: WebPage[]): FitnessMetrics {
  if (selectedPages.length === 0) {
    return {
      definitionalDensity: 0,
      semanticCoherence: 0,
      topicalAuthority: 0,
      contentNovelty: 0,
    };
  }

  const definitionalDensity =
    selectedPages.reduce((sum, page) => sum + calculateDefinitionalDensity(page.content), 0) /
    selectedPages.length;

  let semanticCoherence = 0.5;
  if (selectedPages.length > 1) {
    let sumSimilarity = 0;
    let pairs = 0;

    for (let leftIndex = 0; leftIndex < selectedPages.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < selectedPages.length; rightIndex += 1) {
        sumSimilarity += cosineSimilarity(
          selectedPages[leftIndex].tfidfVector || [],
          selectedPages[rightIndex].tfidfVector || [],
        );
        pairs += 1;
      }
    }

    semanticCoherence = pairs > 0 ? sumSimilarity / pairs : 0.5;
  }

  const topicalAuthority =
    selectedPages.reduce((sum, page) => sum + 1 / (page.rank + 1), 0) / selectedPages.length;

  let contentNovelty = 1;
  if (selectedPages.length > 1) {
    let sumSimilarity = 0;
    let pairs = 0;

    for (let leftIndex = 0; leftIndex < selectedPages.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < selectedPages.length; rightIndex += 1) {
        const leftTerms = new Set(selectedPages[leftIndex].topTerms ?? []);
        const rightTerms = new Set(selectedPages[rightIndex].topTerms ?? []);
        sumSimilarity += jaccardSimilarity(leftTerms, rightTerms);
        pairs += 1;
      }
    }

    contentNovelty = pairs > 0 ? 1 - sumSimilarity / pairs : 1;
  }

  return {
    definitionalDensity,
    semanticCoherence,
    topicalAuthority,
    contentNovelty,
  };
}

export function calculateWeightedFitness(metrics: FitnessMetrics, weights: GAConfig["weights"]): number {
  return (
    weights.def * metrics.definitionalDensity +
    weights.sem * metrics.semanticCoherence +
    weights.auth * metrics.topicalAuthority +
    weights.nov * metrics.contentNovelty
  );
}

export function buildFitnessReport(
  selectedPages: WebPage[],
  weights: GAConfig["weights"],
): GAFitnessReport {
  const metrics = calculateFitnessMetrics(selectedPages);

  return {
    overallFitness: calculateWeightedFitness(metrics, weights),
    selectedSourceCount: selectedPages.length,
    ...metrics,
  };
}

function yieldToBrowser() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

export class GAEngine {
  population: boolean[][] = [];

  fitnesses: number[] = [];

  frontier: WebPage[];

  config: GAConfig;

  N: number;

  constructor(frontier: WebPage[], config = DEFAULT_CONFIG) {
    this.frontier = frontier;
    this.N = frontier.length;
    this.config = {
      ...config,
      weights: { ...config.weights },
      mutationRate: frontier.length > 0 ? 1 / frontier.length : config.mutationRate,
    };
  }

  initialise() {
    this.population = [];
    this.fitnesses = [];

    for (let index = 0; index < this.config.popSize; index += 1) {
      const chromosome = Array.from({ length: this.N }, () => Math.random() > 0.7);
      this.population.push(chromosome);
    }
  }

  evaluate(chromosome: boolean[]): GAFitnessReport {
    const selectedPages = this.frontier.filter((_, index) => chromosome[index]);
    return buildFitnessReport(selectedPages, this.config.weights);
  }

  async evolve(onProgress?: (snapshot: GAEvolutionSnapshot) => void) {
    this.initialise();

    let bestChromosome = this.population[0] ? [...this.population[0]] : [];
    let bestReport = buildFitnessReport([], this.config.weights);
    let bestFitness = -1;

    for (let generation = 0; generation < this.config.maxGen; generation += 1) {
      const scoredPopulation = this.population.map((chromosome) => {
        const report = this.evaluate(chromosome);
        return {
          chromosome,
          report,
          fitness: report.overallFitness,
        };
      });

      this.fitnesses = scoredPopulation.map(({ fitness }) => fitness);

      const sortedCandidates = scoredPopulation
        .map((candidate, index) => ({ ...candidate, index }))
        .sort((left, right) => right.fitness - left.fitness);

      const generationBest = sortedCandidates[0];
      if (generationBest && generationBest.fitness > bestFitness) {
        bestFitness = generationBest.fitness;
        bestChromosome = [...generationBest.chromosome];
        bestReport = generationBest.report;
      }

      const averageFitness =
        this.fitnesses.reduce((sum, fitness) => sum + fitness, 0) / (this.fitnesses.length || 1);

      onProgress?.({
        ...bestReport,
        generation: generation + 1,
        maxGenerations: this.config.maxGen,
        averageFitness,
      });

      const nextPopulation: boolean[][] = [];
      const eliteCount = Math.floor(this.config.popSize * this.config.elitismRate);

      for (let index = 0; index < eliteCount; index += 1) {
        nextPopulation.push([...sortedCandidates[index].chromosome]);
      }

      while (nextPopulation.length < this.config.popSize) {
        const parentOne = this.tournamentSelection();
        const parentTwo = this.tournamentSelection();
        const offspringOne = [...parentOne];
        const offspringTwo = [...parentTwo];

        if (Math.random() < this.config.crossoverRate) {
          const crossoverPoint = Math.floor(Math.random() * this.N);
          for (let index = crossoverPoint; index < this.N; index += 1) {
            offspringOne[index] = parentTwo[index];
            offspringTwo[index] = parentOne[index];
          }
        }

        this.mutate(offspringOne);
        this.mutate(offspringTwo);

        nextPopulation.push(offspringOne);
        if (nextPopulation.length < this.config.popSize) {
          nextPopulation.push(offspringTwo);
        }
      }

      this.population = nextPopulation;

      if (generation < this.config.maxGen - 1) {
        await yieldToBrowser();
      }
    }

    return {
      bestChromosome,
      bestReport,
    };
  }

  tournamentSelection(): boolean[] {
    const tournamentSize = 5;
    let bestIndex = Math.floor(Math.random() * this.config.popSize);

    for (let index = 1; index < tournamentSize; index += 1) {
      const candidateIndex = Math.floor(Math.random() * this.config.popSize);
      if (this.fitnesses[candidateIndex] > this.fitnesses[bestIndex]) {
        bestIndex = candidateIndex;
      }
    }

    return this.population[bestIndex];
  }

  mutate(chromosome: boolean[]) {
    for (let index = 0; index < this.N; index += 1) {
      if (Math.random() < this.config.mutationRate) {
        chromosome[index] = !chromosome[index];
      }
    }
  }
}
