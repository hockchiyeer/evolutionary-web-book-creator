import type { GAEvolutionSnapshot, GAFitnessReport } from "../lib/types";

type Theme = "light" | "dark";
type MetricKey =
  | "overallFitness"
  | "definitionalDensity"
  | "semanticCoherence"
  | "topicalAuthority"
  | "contentNovelty";

const METRIC_ITEMS: Array<{ key: MetricKey; label: string; hint: string }> = [
  { key: "overallFitness", label: "Overall fitness", hint: "weighted objective" },
  { key: "definitionalDensity", label: "Definitional density", hint: "weight 0.35" },
  { key: "semanticCoherence", label: "Semantic coherence", hint: "weight 0.25" },
  { key: "topicalAuthority", label: "Topical authority", hint: "weight 0.25" },
  { key: "contentNovelty", label: "Content novelty", hint: "weight 0.15" },
];

interface FitnessPanelProps {
  report?: GAFitnessReport | GAEvolutionSnapshot | null;
  live?: boolean;
  theme?: Theme;
  compact?: boolean;
  className?: string;
}

function formatScore(value: number | undefined) {
  return typeof value === "number" ? value.toFixed(3) : "N/A";
}

export function FitnessPanel({
  report,
  live = false,
  theme = "light",
  compact = false,
  className = "",
}: FitnessPanelProps) {
  const palette =
    theme === "dark"
      ? {
          wrapper: "border-[#141414] bg-[#141414] text-[#E4E3E0]",
          card: "border-white/10 bg-white/5",
          muted: "text-[#E4E3E0]/65",
          badge: "border-white/10 bg-white/5 text-[#E4E3E0]/75",
        }
      : {
          wrapper: "border-[#141414]/15 bg-white/70 text-[#141414]",
          card: "border-[#141414]/10 bg-white/70",
          muted: "text-[#141414]/65",
          badge: "border-[#141414]/10 bg-[#141414]/5 text-[#141414]/70",
        };

  const liveSnapshot = live ? (report as GAEvolutionSnapshot | null | undefined) : undefined;

  return (
    <section
      aria-live={live ? "polite" : undefined}
      className={`min-w-0 rounded-sm border p-5 sm:p-6 ${palette.wrapper} ${className}`.trim()}
    >
      <div className="flex flex-col gap-5">
        <div
          className={`flex gap-4 ${
            compact ? "flex-col" : "flex-col xl:flex-row xl:items-start xl:justify-between"
          }`}
        >
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-[0.25em] opacity-70">
              {live ? "Live GA telemetry" : "GA Fitness Report"}
            </p>
            <h3 className="text-2xl font-serif italic">
              {live ? "Selection is evolving in real time" : "Final selection report"}
            </h3>
            <p className={`max-w-2xl text-sm leading-relaxed ${palette.muted}`}>
              Sequence mirrors the weighted objective: definitional density, semantic coherence,
              topical authority, then content novelty.
            </p>
          </div>

          <div className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-2 xl:min-w-[16rem]"}`}>
            <div className={`min-w-0 rounded-sm border p-3 ${palette.card}`}>
              <p className="text-[10px] font-mono uppercase tracking-widest opacity-60">
                Selected sources
              </p>
              <p className="mt-2 text-2xl font-serif italic">
                {report?.selectedSourceCount ?? "N/A"}
              </p>
            </div>

            {liveSnapshot ? (
              <div className={`min-w-0 rounded-sm border p-3 ${palette.card}`}>
                <p className="text-[10px] font-mono uppercase tracking-widest opacity-60">
                  Generation
                </p>
                <p className="mt-2 text-2xl font-serif italic">
                  {liveSnapshot.generation}/{liveSnapshot.maxGenerations}
                </p>
              </div>
            ) : (
              <div className={`min-w-0 rounded-sm border p-3 ${palette.card}`}>
                <p className="text-[10px] font-mono uppercase tracking-widest opacity-60">
                  Report type
                </p>
                <p className="mt-2 text-2xl font-serif italic">Final</p>
              </div>
            )}

            {liveSnapshot && (
              <div className={`col-span-2 min-w-0 rounded-sm border p-3 ${palette.card}`}>
                <p className="text-[10px] font-mono uppercase tracking-widest opacity-60">
                  Population mean
                </p>
                <p className="mt-2 text-2xl font-serif italic">
                  {formatScore(liveSnapshot.averageFitness)}
                </p>
              </div>
            )}
          </div>
        </div>

        <dl className={`grid gap-3 ${compact ? "grid-cols-1" : "sm:grid-cols-2"}`}>
          {METRIC_ITEMS.map((item, index) => {
            const value = report ? report[item.key] : undefined;
            return (
              <div
                key={item.key}
                className={`min-w-0 rounded-sm border p-4 ${palette.card} ${
                  index === 0 && !compact ? "sm:col-span-2" : ""
                }`}
              >
                <dt className="flex flex-wrap items-start justify-between gap-2 text-[10px] font-mono uppercase tracking-widest">
                  <span className="min-w-0 flex-1 break-words">{item.label}</span>
                  <span
                    className={`max-w-full rounded-full border px-2 py-1 text-right whitespace-normal ${palette.badge}`}
                  >
                    {item.hint}
                  </span>
                </dt>
                <dd
                  className={`mt-3 min-w-0 break-words font-serif italic ${
                    index === 0 && !compact ? "text-4xl" : compact ? "text-[2rem]" : "text-2xl"
                  }`}
                >
                  {formatScore(value)}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
