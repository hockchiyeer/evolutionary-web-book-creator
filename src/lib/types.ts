export interface WebPage {
  id: number;
  url: string;
  title: string;
  snippet: string;
  content: string;
  rank: number;
  tfidfVector?: number[];
  topTerms?: string[];
}

export interface GAWeights {
  def: number;
  sem: number;
  auth: number;
  nov: number;
}

export interface GAConfig {
  popSize: number;
  maxGen: number;
  crossoverRate: number;
  mutationRate: number;
  elitismRate: number;
  weights: GAWeights;
}

export interface BookPage {
  title: string;
  url: string;
  summary: string;
}

export interface Section {
  title: string;
  pages: BookPage[];
  imageUrl?: string;
}

export interface FitnessMetrics {
  definitionalDensity: number;
  semanticCoherence: number;
  topicalAuthority: number;
  contentNovelty: number;
}

export interface GAFitnessReport extends FitnessMetrics {
  overallFitness: number;
  selectedSourceCount: number;
}

export interface GAEvolutionSnapshot extends GAFitnessReport {
  generation: number;
  maxGenerations: number;
  averageFitness: number;
}

export interface WebBook {
  id: string;
  title: string;
  query: string;
  sections: Section[];
  coverImageUrl?: string;
  fitnessReport?: GAFitnessReport;
  timestamp: number;
}
