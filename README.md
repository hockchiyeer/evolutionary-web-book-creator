# ECWBCE: Evolutionary Web-Book Creator

ECWBCE is a browser-first prototype that turns a topic prompt into a structured "web-book" made from grouped source summaries. The current app expands a query with Gemini, runs a lightweight evolutionary selection pass over the returned source set, clusters the selected sources into sections, optionally generates images, stores results in local browser history, and can export the active web-book as a PDF.

👉 The live application is available at: (https://aistudio.google.com/apps/668e2c29-2a5b-46cb-ada1-10d82255f10f?showPreview=true&showAssistant=true)[https://aistudio.google.com/apps/668e2c29-2a5b-46cb-ada1-10d82255f10f?showPreview=true&showAssistant=true]

## What This Repo Actually Does Today

- The main user flow lives in `src/App.tsx`.
- The frontend asks Gemini for at least 20 candidate sources and summaries by using the Google Search tool through `@google/genai`.
- The frontend computes simple TF-IDF-style vectors in the browser.
- A client-side genetic algorithm selects a subset of sources using these weights:
  - definitional density: `0.35`
  - semantic coherence: `0.25`
  - topical authority proxy: `0.25`
  - novelty: `0.15`
- The current frontend GA settings are:
  - population size: `50`
  - generations: `50`
  - crossover rate: `0.85`
  - elitism rate: `0.1`
  - mutation rate: `1 / N`
- The selected sources are grouped into up to 5 sections with `ml-kmeans`.
- The generated book stores the live GA selection metrics used by the sidebar and PDF export:
  - definitional density
  - semantic coherence
  - topical authority
  - content novelty
- The app can generate:
  - 1 cover image
  - up to 3 section images
- Generated books are saved to `localStorage` under `ecwbce_history`.
- The active web-book can be exported locally as a PDF generated in the browser with `jspdf`.

## Important Limits And Caveats

- The app does not crawl arbitrary URLs or fetch full page HTML itself. It relies on Gemini to return structured source summaries.
- The generated "web-book" is currently a grouped source digest, not a long-form authored manuscript with original chapter prose.
- The current frontend talks directly to Gemini from the browser. In this repo, `vite.config.ts` injects `GEMINI_API_KEY` into the client bundle for local or AI Studio-style prototyping. That is convenient for experiments, but it is not a hardened public-production pattern.
- `server.ts` contains an Express host plus a prototype `/api/synthesize` route, but the current React UI does not call that endpoint.
- There is no automated test suite in the repo beyond TypeScript checking with `npm run lint`.

## Stack

- React 19
- TypeScript
- Vite 6
- Tailwind CSS 4
- Motion
- Lucide React
- `@google/genai`
- `ml-kmeans`
- `jspdf`
- Express and `natural` in the optional server/prototype API layer

## Local Development

### Prerequisites

- Node.js 18 or newer
- npm
- A Gemini API key

### Environment

Create a `.env` file in the repo root:

```env
GEMINI_API_KEY=your_api_key_here
```

Notes:

- `.env.example` also includes `APP_URL` for AI Studio-style deployments, but the current frontend code does not require it for local development.
- `npm run dev` starts `server.ts`, which hosts the Vite app on port `3000`.

### Run

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

### Other Scripts

```bash
npm run build
npm run preview
npm run lint
```

## File Guide

- `src/App.tsx`: primary UI, client-side synthesis flow, image generation, history, and PDF export
- `src/index.css`: Tailwind theme and font setup
- `server.ts`: Express host plus a prototype API route that mirrors the synthesis idea on the server
- `vite.config.ts`: Vite setup and client-side environment injection
- `.env.example`: example environment variables for local use or AI Studio deployment

## AI Studio Notes

This repo is compatible with a Google AI Studio app-style workflow because the frontend can use an injected Gemini API key directly. If you run it inside AI Studio, some browser-console messages may come from the surrounding AI Studio shell rather than from this app itself.

## License

MIT. See [LICENSE.txt](LICENSE.txt).
