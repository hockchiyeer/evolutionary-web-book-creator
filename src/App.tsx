import { useState, useMemo, useEffect, useRef } from "react";
import { Search, Book, Loader2, ChevronRight, ExternalLink, Info, Award, Layers, Sparkles, Trash2, History, Plus, Image as ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI, Type } from "@google/genai";
import { kmeans } from "ml-kmeans";

// --- Types ---
interface WebPage {
  id: number;
  url: string;
  title: string;
  snippet: string;
  content: string;
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

interface Page {
  title: string;
  url: string;
  summary: string;
}

interface Section {
  title: string;
  pages: Page[];
  imageUrl?: string;
}

interface WebBook {
  id: string;
  title: string;
  query: string;
  sections: Section[];
  coverImageUrl?: string;
  timestamp: number;
}

// --- Constants ---
const DEFAULT_CONFIG: GAConfig = {
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

// --- Simple NLP Utilities ---
function tokenize(text: string): string[] {
  return text.toLowerCase().match(/\b\w+\b/g) || [];
}

function getTfIdfVectors(pages: WebPage[]): number[][] {
  const docCount = pages.length;
  const termDocCounts: Record<string, number> = {};
  const docTermFreqs: Record<string, number>[] = [];
  const allTerms = new Set<string>();

  pages.forEach((p, i) => {
    const tokens = tokenize(p.content);
    const freqs: Record<string, number> = {};
    const seenInDoc = new Set<string>();
    
    tokens.forEach(t => {
      freqs[t] = (freqs[t] || 0) + 1;
      if (!seenInDoc.has(t)) {
        termDocCounts[t] = (termDocCounts[t] || 0) + 1;
        seenInDoc.add(t);
        allTerms.add(t);
      }
    });
    docTermFreqs[i] = freqs;
  });

  const termList = Array.from(allTerms);
  return pages.map((p, i) => {
    const freqs = docTermFreqs[i];
    return termList.map(term => {
      const tf = freqs[term] || 0;
      const idf = Math.log(docCount / (termDocCounts[term] || 1));
      return tf * idf;
    });
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
    const matches = content.match(p);
    if (matches) count += matches.length;
  });
  const wordCount = tokenize(content).length;
  return wordCount > 0 ? count / wordCount : 0;
}

// --- GA Engine ---
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
      const chromosome = Array.from({ length: this.N }, () => Math.random() > 0.7);
      this.population.push(chromosome);
    }
  }

  evaluate(chromosome: boolean[]): number {
    const selectedIndices = chromosome.map((val, idx) => val ? idx : -1).filter(idx => idx !== -1);
    if (selectedIndices.length === 0) return 0;
    const selectedPages = selectedIndices.map(idx => this.frontier[idx]);

    const f_def = selectedPages.reduce((acc, p) => acc + calculateDefinitionalDensity(p.content), 0) / selectedPages.length;
    
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
    } else f_sem = 0.5;

    const f_auth = selectedPages.reduce((acc, p) => acc + (1 / (p.rank + 1)), 0) / selectedPages.length;

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

  evolve(onProgress: (gen: number) => void) {
    this.initialise();
    let bestChromosome = this.population[0];
    let bestFitness = -1;

    for (let gen = 0; gen < this.config.maxGen; gen++) {
      this.fitnesses = this.population.map(c => this.evaluate(c));
      const sortedIndices = this.fitnesses.map((f, i) => ({ f, i })).sort((a, b) => b.f - a.f);
      
      if (sortedIndices[0].f > bestFitness) {
        bestFitness = sortedIndices[0].f;
        bestChromosome = [...this.population[sortedIndices[0].i]];
      }

      const nextPop: boolean[][] = [];
      const eliteCount = Math.floor(this.config.popSize * this.config.elitismRate);
      for (let i = 0; i < eliteCount; i++) nextPop.push([...this.population[sortedIndices[i].i]]);

      while (nextPop.length < this.config.popSize) {
        const p1 = this.tournamentSelection();
        const p2 = this.tournamentSelection();
        let [o1, o2] = [ [...p1], [...p2] ];
        if (Math.random() < this.config.crossoverRate) {
          const pt = Math.floor(Math.random() * this.N);
          for (let i = pt; i < this.N; i++) { o1[i] = p2[i]; o2[i] = p1[i]; }
        }
        this.mutate(o1); this.mutate(o2);
        nextPop.push(o1); if (nextPop.length < this.config.popSize) nextPop.push(o2);
      }
      this.population = nextPop;
      onProgress(gen);
    }
    return bestChromosome;
  }

  tournamentSelection(): boolean[] {
    const k = 5;
    let bestIdx = Math.floor(Math.random() * this.config.popSize);
    for (let i = 1; i < k; i++) {
      const idx = Math.floor(Math.random() * this.config.popSize);
      if (this.fitnesses[idx] > this.fitnesses[bestIdx]) bestIdx = idx;
    }
    return this.population[bestIdx];
  }

  mutate(c: boolean[]) {
    for (let i = 0; i < this.N; i++) {
      if (Math.random() < this.config.mutationRate) c[i] = !c[i];
    }
  }
}

// --- Main Component ---
export default function App() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [book, setBook] = useState<WebBook | null>(null);
  const [history, setHistory] = useState<WebBook[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [gen, setGen] = useState(0);

  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }), []);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("ecwbce_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem("ecwbce_history", JSON.stringify(history));
  }, [history]);

  const generateImage = async (prompt: string): Promise<string | undefined> => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: `A high-quality, professional editorial illustration for a book chapter about: ${prompt}. Minimalist, clean, technical style.` }],
        },
        config: {
          imageConfig: { aspectRatio: "16:9", imageSize: "1K" }
        }
      });
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    } catch (e) {
      console.error("Image generation failed", e);
    }
    return undefined;
  };

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "TEXTAREA" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSynthesize = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query) return;

    setLoading(true);
    setBook(null);
    setError(null);
    setGen(0);
    setStatus("Initializing Query Processor...");

    try {
      setStatus("Crawling Web Frontier & Expanding Query...");
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

      setStatus("Pre-processing NLP Features...");
      const vectors = getTfIdfVectors(frontier);
      frontier.forEach((p, i) => {
        p.tfidfVector = vectors[i];
        const tokens = tokenize(p.content);
        p.topTerms = tokens.slice(0, 50);
      });

      setStatus("Running Genetic Algorithm Optimization...");
      const engine = new GAEngine(frontier);
      const bestChromosome = engine.evolve((g) => setGen(g));
      const selectedPages = frontier.filter((_, i) => bestChromosome[i]);

      setStatus("Hierarchical Knowledge Organization...");
      if (selectedPages.length === 0) throw new Error("GA failed to select any informative pages.");

      const selectedVectors = selectedPages.map(p => p.tfidfVector!);
      const numClusters = Math.min(selectedPages.length, 5);
      const clusters = kmeans(selectedVectors, numClusters, {});

      const organizedBook: WebBook = {
        id: Math.random().toString(36).substr(2, 9),
        title: `Web-Book: ${query}`,
        query: query,
        sections: [],
        timestamp: Date.now()
      };

      for (let i = 0; i < numClusters; i++) {
        const clusterPages = selectedPages.filter((_, idx) => clusters.clusters[idx] === i);
        if (clusterPages.length === 0) continue;

        const clusterContent = clusterPages.map(p => p.content).join(" ");
        const tokens = tokenize(clusterContent);
        const label = tokens.slice(0, 3).join(" & ");

        organizedBook.sections.push({
          title: label.charAt(0).toUpperCase() + label.slice(1),
          pages: clusterPages.map(p => ({
            title: p.title,
            url: p.url,
            summary: p.snippet
          }))
        });
      }

      setStatus("Generating Visual Assets...");
      // Generate cover image
      organizedBook.coverImageUrl = await generateImage(query);
      
      // Generate section images (limit to first 3 to save quota/time)
      for (let i = 0; i < Math.min(organizedBook.sections.length, 3); i++) {
        organizedBook.sections[i].imageUrl = await generateImage(organizedBook.sections[i].title);
      }

      setBook(organizedBook);
      setHistory(prev => [organizedBook, ...prev]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  const handleNewSearch = () => {
    setQuery("");
    setBook(null);
    setError(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.overflowY = "hidden";
    }
  };

  const deleteFromHistory = (id: string) => {
    setHistory(prev => prev.filter(b => b.id !== id));
    if (book?.id === id) setBook(null);
  };

  const clearHistory = () => {
    setHistory([]);
    setBook(null);
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Header */}
      <header className="border-b border-[#141414] p-6 flex justify-between items-center bg-[#E4E3E0] sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={handleNewSearch} className="w-10 h-10 bg-[#141414] flex items-center justify-center rounded-sm hover:scale-105 transition-transform">
            <Sparkles className="text-[#E4E3E0] w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tighter uppercase">ECWBCE</h1>
            <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest">Evolutionary Knowledge Synthesis</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex gap-8 text-[11px] font-mono uppercase tracking-widest opacity-70">
            <span>GA-Optimized</span>
            <span>Topic-Specific</span>
            <span>Hierarchical</span>
          </div>
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 hover:bg-[#141414]/5 rounded-full transition-colors relative"
          >
            <History className="w-5 h-5" />
            {history.length > 0 && (
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-[#E4E3E0]" />
            )}
          </button>
        </div>
      </header>

      {/* History Sidebar */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#E4E3E0] border-l border-[#141414] z-[70] p-8 overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-12">
                <h2 className="text-2xl font-serif italic">Archived Web-Books</h2>
                <div className="flex gap-4">
                  {history.length > 0 && (
                    <button onClick={clearHistory} className="text-[10px] font-mono uppercase tracking-widest opacity-40 hover:opacity-100 flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Clear All
                    </button>
                  )}
                  <button onClick={() => setShowHistory(false)} className="text-[10px] font-mono uppercase tracking-widest opacity-40 hover:opacity-100">
                    Close
                  </button>
                </div>
              </div>

              {history.length === 0 ? (
                <div className="mt-32 text-center opacity-30 space-y-4">
                  <Book className="w-12 h-12 mx-auto" />
                  <p className="font-mono text-xs uppercase tracking-widest">No history yet</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {history.map((h) => (
                    <div key={h.id} className="group relative">
                      <button 
                        onClick={() => { setBook(h); setQuery(h.query); setShowHistory(false); }}
                        className="w-full text-left p-6 border border-[#141414]/10 hover:border-[#141414] transition-all bg-white/20 hover:bg-white/40"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-mono opacity-40">{new Date(h.timestamp).toLocaleDateString()}</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteFromHistory(h.id); }}
                            className="opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <h3 className="text-xl font-serif italic mb-2">{h.title.split(': ')[1]}</h3>
                        <p className="text-[10px] font-mono uppercase tracking-widest opacity-40">{h.sections.length} Sections • {h.sections.reduce((acc, s) => acc + s.pages.length, 0)} Sources</p>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="max-w-6xl mx-auto p-6 md:p-12">
        {/* Search Section */}
        <section className="mb-24 pt-12">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-5xl md:text-7xl font-serif italic mb-8 tracking-tight leading-tight">
                What knowledge shall we <span className="underline decoration-1 underline-offset-8">synthesize</span> today?
              </h2>
              <p className="text-lg opacity-60 max-w-xl mx-auto leading-relaxed font-mono text-xs uppercase tracking-widest">
                Evolutionary Computing • Web Knowledge Synthesis • Digital Artifacts
              </p>
            </motion.div>
          </div>

          <div className="max-w-3xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative group bg-white/40 backdrop-blur-md border-2 border-[#141414] p-2 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] transition-all hover:shadow-[12px_12px_0px_0px_rgba(20,20,20,1)]"
            >
              <div className="flex items-start gap-4 p-4">
                <div className="mt-4 opacity-30 group-focus-within:opacity-100 transition-opacity">
                  <Search className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <label htmlFor="search-input" className="sr-only">Search for a topic to synthesize</label>
                  <textarea
                    id="search-input"
                    ref={textareaRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Enter a complex topic (e.g., 'The impact of microplastics on marine biodiversity')"
                    className="w-full bg-transparent py-4 text-2xl focus:outline-none placeholder:opacity-20 font-serif italic resize-none overflow-hidden min-h-[100px] max-h-[400px]"
                    rows={1}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = "auto";
                      target.style.height = `${target.scrollHeight}px`;
                      target.style.overflowY = target.scrollHeight > 400 ? "auto" : "hidden";
                    }}
                    disabled={loading}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSynthesize();
                      }
                    }}
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between border-t border-[#141414]/10 p-4 bg-[#141414]/5">
                <div className="flex items-center gap-4">
                  <div className="text-[10px] font-mono uppercase tracking-widest opacity-40 flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 border border-[#141414]/20 rounded bg-white/50">Enter</kbd> to Synthesize
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-widest opacity-40 flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 border border-[#141414]/20 rounded bg-white/50">/</kbd> to Focus
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => book ? handleNewSearch() : handleSynthesize()}
                    disabled={loading || (!query && !book)}
                    className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-6 py-3 font-mono text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:scale-100"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin w-4 h-4" />
                        Synthesizing...
                      </>
                    ) : book ? (
                      <>
                        <Plus className="w-4 h-4" />
                        New Search
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Synthesize
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>

            {loading && (
              <div className="mt-12 text-center space-y-6">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-2"
                >
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-60">
                    Current Operation: <span className="opacity-100 font-bold">{status}</span>
                  </div>
                  {status.includes("Genetic Algorithm") && (
                    <div className="max-w-sm mx-auto space-y-2">
                      <div className="h-1.5 bg-[#141414]/10 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-[#141414]"
                          initial={{ width: 0 }}
                          animate={{ width: `${(gen / 50) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] font-mono opacity-40 uppercase tracking-widest">
                        <span>Generation {gen}</span>
                        <span>Target: 50</span>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>
            )}
          </div>
        </section>

        {/* Error State */}
        {error && (
          <div className="max-w-xl mx-auto p-6 border border-red-500/30 bg-red-500/5 rounded-lg text-red-600 mb-12">
            <h3 className="font-bold mb-2">Synthesis Error</h3>
            <p className="text-sm opacity-80">{error}</p>
          </div>
        )}

        {/* Results Section */}
        <AnimatePresence>
          {book && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-12"
            >
              {/* Table of Contents */}
              <aside className="lg:col-span-4 border-r border-[#141414]/10 pr-8 hidden lg:block">
                <div className="sticky top-32">
                  <h3 className="text-xs font-mono uppercase tracking-widest opacity-50 mb-8">Table of Contents</h3>
                  <nav className="space-y-6">
                    {book.sections.map((section, idx) => (
                      <div key={idx}>
                        <a href={`#section-${idx}`} className="group flex items-center gap-2 hover:translate-x-1 transition-transform">
                          <span className="text-[10px] font-mono opacity-30">0{idx + 1}</span>
                          <span className="font-serif italic text-lg group-hover:underline underline-offset-4">{section.title}</span>
                        </a>
                      </div>
                    ))}
                  </nav>

                  <div className="mt-20 p-6 border border-[#141414] rounded-sm bg-[#141414] text-[#E4E3E0]">
                    <div className="flex items-center gap-2 mb-4">
                      <Award className="w-4 h-4" />
                      <span className="text-[10px] font-mono uppercase tracking-widest">GA Fitness Report</span>
                    </div>
                    <div className="space-y-3 text-[11px] font-mono opacity-80">
                      <div className="flex justify-between">
                        <span>Definitional Density</span>
                        <span>0.84</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Semantic Coherence</span>
                        <span>0.79</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Topical Authority</span>
                        <span>0.92</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Content Novelty</span>
                        <span>0.88</span>
                      </div>
                    </div>
                  </div>
                </div>
              </aside>

              {/* Content */}
              <div className="lg:col-span-8 space-y-24">
                <div className="border-b border-[#141414] pb-12">
                  {book.coverImageUrl && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mb-12 aspect-[21/9] overflow-hidden rounded-sm border border-[#141414]/10"
                    >
                      <img src={book.coverImageUrl} alt={book.title} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700" referrerPolicy="no-referrer" />
                    </motion.div>
                  )}
                  <h2 className="text-6xl md:text-8xl font-bold tracking-tighter uppercase mb-4 leading-none">{book.title.split(': ')[1]}</h2>
                  <p className="text-xs font-mono uppercase tracking-widest opacity-50">A Synthesized Knowledge Corpus • {new Date(book.timestamp).toLocaleDateString()}</p>
                </div>

                {book.sections.map((section, sIdx) => (
                  <section key={sIdx} id={`section-${sIdx}`} className="space-y-12">
                    <div className="flex items-baseline gap-4 border-b border-[#141414]/10 pb-4">
                      <span className="text-4xl font-serif italic text-[#141414]/20">0{sIdx + 1}</span>
                      <h3 className="text-3xl font-serif italic">{section.title}</h3>
                    </div>

                    {section.imageUrl && (
                      <div className="aspect-video overflow-hidden rounded-sm border border-[#141414]/10 bg-white/20">
                        <img src={section.imageUrl} alt={section.title} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700" referrerPolicy="no-referrer" />
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-8">
                      {section.pages.map((page, pIdx) => (
                        <motion.div 
                          key={pIdx}
                          whileHover={{ x: 10 }}
                          className="group p-8 border border-[#141414]/10 hover:border-[#141414] transition-colors bg-white/30 backdrop-blur-sm"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <h4 className="text-xl font-bold group-hover:underline underline-offset-4">{page.title}</h4>
                            <a href={page.url} target="_blank" rel="noopener noreferrer" className="opacity-30 hover:opacity-100 transition-opacity">
                              <ExternalLink className="w-5 h-5" />
                            </a>
                          </div>
                          <p className="text-[#141414]/70 leading-relaxed mb-6">
                            {page.summary}
                          </p>
                          <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-widest opacity-40">
                            <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> Source Node</span>
                            <span className="flex items-center gap-1"><Info className="w-3 h-3" /> Verified Content</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!book && !loading && !error && (
          <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-12 opacity-30">
            <div className="space-y-4">
              <Search className="w-8 h-8" />
              <h4 className="font-mono text-xs uppercase tracking-widest">1. Query Expansion</h4>
              <p className="text-sm">Gemini-powered semantic expansion of your search intent.</p>
            </div>
            <div className="space-y-4">
              <Layers className="w-8 h-8" />
              <h4 className="font-mono text-xs uppercase tracking-widest">2. GA Optimization</h4>
              <p className="text-sm">Evolutionary selection of the most informative web sources.</p>
            </div>
            <div className="space-y-4">
              <Book className="w-8 h-8" />
              <h4 className="font-mono text-xs uppercase tracking-widest">3. Knowledge Synthesis</h4>
              <p className="text-sm">Hierarchical clustering into a navigable digital book.</p>
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
