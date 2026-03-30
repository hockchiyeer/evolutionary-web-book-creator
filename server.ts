import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import natural from "natural";
import { kmeans } from "ml-kmeans";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

const PORT = 3000;

// ECWBCE Logic
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

interface WebPage {
  id: number;
  url: string;
  title: string;
  snippet: string;
  content: string; // Mocked or fetched
  rank: number;
  tfidfVector?: number[];
  topTerms?: string[];
}

interface GAConfig {
  popSize: number;
  maxGen: number;
  crossoverRate: number;
  mutationRate: number;
  elitismRate: number;
  weights: {
    def: number;
    sem: number;
    auth: number;
    nov: number;
  };
}

const DEFAULT_CONFIG: GAConfig = {
  popSize: 200,
  maxGen: 200,
  crossoverRate: 0.85,
  mutationRate: 0.01, // Will be set to 1/N
  elitismRate: 0.1,
  weights: {
    def: 0.35,
    sem: 0.25,
    auth: 0.25,
    nov: 0.15,
  },
};

// NLP Utilities
const TfIdf = natural.TfIdf;
const tokenizer = new natural.WordTokenizer();

function getTfIdfVectors(pages: WebPage[], query: string): number[][] {
  const tfidf = new TfIdf();
  pages.forEach((p) => tfidf.addDocument(p.content));
  
  // Get all unique terms across documents to create a fixed-length vector
  const terms = new Set<string>();
  pages.forEach(p => {
    tokenizer.tokenize(p.content.toLowerCase()).forEach(t => terms.add(t));
  });
  const termList = Array.from(terms);

  return pages.map((p, i) => {
    const vector = termList.map(term => tfidf.tfidf(term, i));
    return vector;
  });
}

function cosineSimilarity(v1: number[], v2: number[]): number {
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  for (let i = 0; i < v1.length; i++) {
    dotProduct += v1[i] * v2[i];
    mag1 += v1[i] * v1[i];
    mag2 += v2[i] * v2[i];
  }
  mag1 = Math.sqrt(mag1);
  mag2 = Math.sqrt(mag2);
  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct / (mag1 * mag2);
}

function jaccardSimilarity(s1: Set<string>, s2: Set<string>): number {
  const intersection = new Set([...s1].filter(x => s2.has(x)));
  const union = new Set([...s1, ...s2]);
  return intersection.size / union.size;
}

// Fitness Metrics
function calculateDefinitionalDensity(content: string): number {
  const patterns = [
    /\b(is|are|was|were) (a|an|the|defined as|known as)\b/i,
    /\brefers to\b/i,
    /\bmeans\b/i,
    /\bdenotes\b/i,
    /\bDefinition of\b/i,
  ];
  let count = 0;
  patterns.forEach(p => {
    const matches = content.match(new RegExp(p, 'gi'));
    if (matches) count += matches.length;
  });
  const wordCount = content.split(/\s+/).length;
  return wordCount > 0 ? count / wordCount : 0;
}

// GA Engine
class GAEngine {
  population: boolean[][] = [];
  fitnesses: number[] = [];
  frontier: WebPage[];
  config: GAConfig;
  N: number;

  constructor(frontier: WebPage[], config = DEFAULT_CONFIG) {
    this.frontier = frontier;
    this.config = config;
    this.N = frontier.length;
    this.config.mutationRate = 1 / this.N;
  }

  initialise() {
    for (let i = 0; i < this.config.popSize; i++) {
      const chromosome = Array.from({ length: this.N }, () => Math.random() > 0.8); // Sparse selection
      this.population.push(chromosome);
    }
  }

  evaluate(chromosome: boolean[]): number {
    const selectedIndices = chromosome.map((val, idx) => val ? idx : -1).filter(idx => idx !== -1);
    if (selectedIndices.length === 0) return 0;

    const selectedPages = selectedIndices.map(idx => this.frontier[idx]);

    // f_def: Definitional Density
    const f_def = selectedPages.reduce((acc, p) => acc + calculateDefinitionalDensity(p.content), 0) / selectedPages.length;

    // f_sem: Semantic Coherence (Mean pairwise cosine similarity)
    let f_sem = 0;
    if (selectedPages.length > 1) {
      let sumSim = 0;
      let pairs = 0;
      for (let i = 0; i < selectedPages.length; i++) {
        for (let j = i + 1; j < selectedPages.length; j++) {
          sumSim += cosineSimilarity(selectedPages[i].tfidfVector!, selectedPages[j].tfidfVector!);
          pairs++;
        }
      }
      f_sem = sumSim / pairs;
    } else {
      f_sem = 0.5; // Neutral for single page
    }

    // f_auth: Topical Authority (Proxy using search rank)
    const f_auth = selectedPages.reduce((acc, p) => acc + (1 / (p.rank + 1)), 0) / selectedPages.length;

    // f_nov: Content Novelty (1 - Mean pairwise Jaccard similarity)
    let f_nov = 1;
    if (selectedPages.length > 1) {
      let sumSim = 0;
      let pairs = 0;
      for (let i = 0; i < selectedPages.length; i++) {
        for (let j = i + 1; j < selectedPages.length; j++) {
          const s1 = new Set(selectedPages[i].topTerms);
          const s2 = new Set(selectedPages[j].topTerms);
          sumSim += jaccardSimilarity(s1, s2);
          pairs++;
        }
      }
      f_nov = 1 - (sumSim / pairs);
    }

    return (
      this.config.weights.def * f_def +
      this.config.weights.sem * f_sem +
      this.config.weights.auth * f_auth +
      this.config.weights.nov * f_nov
    );
  }

  evolve() {
    this.initialise();
    let bestChromosome = this.population[0];
    let bestFitness = -1;

    for (let gen = 0; gen < this.config.maxGen; gen++) {
      this.fitnesses = this.population.map(c => this.evaluate(c));
      
      // Elitism
      const sortedIndices = this.fitnesses.map((f, i) => ({ f, i }))
        .sort((a, b) => b.f - a.f);
      
      if (sortedIndices[0].f > bestFitness) {
        bestFitness = sortedIndices[0].f;
        bestChromosome = [...this.population[sortedIndices[0].i]];
      }

      const nextPop: boolean[][] = [];
      const eliteCount = Math.floor(this.config.popSize * this.config.elitismRate);
      for (let i = 0; i < eliteCount; i++) {
        nextPop.push([...this.population[sortedIndices[i].i]]);
      }

      // Selection & Variation
      while (nextPop.length < this.config.popSize) {
        const p1 = this.tournamentSelection();
        const p2 = this.tournamentSelection();
        
        let [o1, o2] = [ [...p1], [...p2] ];
        if (Math.random() < this.config.crossoverRate) {
          [o1, o2] = this.twoPointCrossover(p1, p2);
        }

        this.mutate(o1);
        this.mutate(o2);

        nextPop.push(o1);
        if (nextPop.length < this.config.popSize) nextPop.push(o2);
      }

      this.population = nextPop;
    }

    return bestChromosome;
  }

  tournamentSelection(): boolean[] {
    const k = 5;
    let bestIdx = Math.floor(Math.random() * this.config.popSize);
    for (let i = 1; i < k; i++) {
      const idx = Math.floor(Math.random() * this.config.popSize);
      if (this.fitnesses[idx] > this.fitnesses[bestIdx]) {
        bestIdx = idx;
      }
    }
    return this.population[bestIdx];
  }

  twoPointCrossover(p1: boolean[], p2: boolean[]): [boolean[], boolean[]] {
    const pt1 = Math.floor(Math.random() * this.N);
    const pt2 = Math.floor(Math.random() * this.N);
    const start = Math.min(pt1, pt2);
    const end = Math.max(pt1, pt2);

    const o1 = [...p1];
    const o2 = [...p2];
    for (let i = start; i <= end; i++) {
      o1[i] = p2[i];
      o2[i] = p1[i];
    }
    return [o1, o2];
  }

  mutate(c: boolean[]) {
    for (let i = 0; i < this.N; i++) {
      if (Math.random() < this.config.mutationRate) {
        c[i] = !c[i];
      }
    }
  }
}

// API Endpoints
app.post("/api/synthesize", async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "Query is required" });

  try {
    // 1. Query Expansion & Search (Frontier Generation)
    // We'll use Gemini to get search results and simulate the crawler
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `I want to create a comprehensive "Web-Book" about "${query}". 
      Please provide a list of at least 20 highly informative, diverse, and authoritative web sources (URLs, titles, and detailed snippets/summaries of their content) that would serve as chapters or sections. 
      Focus on definitional and conceptual content.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sources: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  url: { type: Type.STRING },
                  title: { type: Type.STRING },
                  snippet: { type: Type.STRING },
                  content: { type: Type.STRING, description: "A more detailed summary of the page's knowledge content" }
                },
                required: ["url", "title", "snippet", "content"]
              }
            }
          },
          required: ["sources"]
        }
      }
    });

    const data = JSON.parse(response.text);
    const frontier: WebPage[] = data.sources.map((s: any, i: number) => ({
      id: i,
      ...s,
      rank: i,
    }));

    // Pre-process NLP features for GA
    const vectors = getTfIdfVectors(frontier, query);
    frontier.forEach((p, i) => {
      p.tfidfVector = vectors[i];
      // Get top terms for novelty
      const tfidf = new TfIdf();
      tfidf.addDocument(p.content);
      p.topTerms = tfidf.listTerms(0).slice(0, 50).map(t => t.term);
    });

    // 2. GA Optimization
    const engine = new GAEngine(frontier);
    const bestChromosome = engine.evolve();
    const selectedPages = frontier.filter((_, i) => bestChromosome[i]);

    // 3. Hierarchical Organization (Clustering)
    // We'll use k-means on the selected pages' vectors
    const selectedVectors = selectedPages.map(p => p.tfidfVector!);
    const numClusters = Math.min(selectedPages.length, 5);
    const clusters = kmeans(selectedVectors, numClusters, {});

    const organizedBook: any = {
      title: `Web-Book: ${query}`,
      sections: []
    };

    for (let i = 0; i < numClusters; i++) {
      const clusterPages = selectedPages.filter((_, idx) => clusters.clusters[idx] === i);
      if (clusterPages.length === 0) continue;

      // Label cluster using top terms of the centroid or most representative page
      const clusterContent = clusterPages.map(p => p.content).join(" ");
      const clusterTfidf = new TfIdf();
      clusterTfidf.addDocument(clusterContent);
      const label = clusterTfidf.listTerms(0).slice(0, 3).map(t => t.term).join(" & ");

      organizedBook.sections.push({
        title: label.charAt(0).toUpperCase() + label.slice(1),
        pages: clusterPages.map(p => ({
          title: p.title,
          url: p.url,
          summary: p.snippet
        }))
      });
    }

    res.json(organizedBook);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Serve static files
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
