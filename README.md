# ECWBCE: Evolutionary Web-Book Creator Engine

> **Synthesize distributed web knowledge into structured digital artifacts using Evolutionary Computing.**

ECWBCE is an autonomous knowledge synthesis engine that transforms a simple search query into a comprehensive, hierarchically organized "Web-Book." It leverages Genetic Algorithms (GA) to evolve the most informative collection of web sources and organizes them into a navigable digital book complete with AI-generated illustrations.

👉 The live application is available at: https://aistudio.google.com/apps/668e2c29-2a5b-46cb-ada1-10d82255f10f?showPreview=true&showAssistant=true

---

## 📖 Table of Contents
- [For Users: Functional Gain](#-for-users-functional-gain)
- [For Developers: Technical Improvement](#-for-developers-technical-improvement)
- [Core Features](#-core-features)
- [How It Works](#-how-it-works)
- [Installation & Setup](#-installation--setup)
- [Technical Architecture](#-technical-architecture)

---

## 🌟 For Users: Functional Gain

### What can I do with this?
If you are a researcher, student, or curious explorer, ECWBCE helps you bypass the "search engine fatigue" of clicking through dozens of tabs. 

1.  **Instant Synthesis**: Enter any complex topic (e.g., "The history of Stoicism" or "Quantum Computing for beginners").
2.  **Structured Learning**: Instead of a list of links, you get a **Digital Book** with chapters, summaries, and authoritative sources.
3.  **Visual Context**: Every book comes with AI-generated cover art and chapter illustrations to help you visualize the topic.
4.  **Persistent Library**: Your creations are saved in your local browser history, allowing you to build a personal library of synthesized knowledge.

---

## 🛠 For Developers: Technical Improvement

### Why is this technically interesting?
ECWBCE is a reference implementation of combining **Generative AI** with **Evolutionary Computing** and **Classical NLP**.

1.  **Genetic Algorithm (GA) Optimization**: The engine doesn't just pick the top search results. It treats a collection of web pages as a "chromosome" and evolves it over 50 generations to maximize:
    *   **Definitional Density**: How well the sources define the topic.
    *   **Semantic Coherence**: How well the sources relate to each other.
    *   **Topical Authority**: The search-rank credibility of the sources.
    *   **Content Novelty**: Minimizing redundancy between selected chapters.
2.  **NLP Pipeline**: Uses TF-IDF (Term Frequency-Inverse Document Frequency) vectorization and Cosine Similarity to understand the semantic relationships between web pages.
3.  **Unsupervised Clustering**: Employs **K-Means clustering** to automatically group selected web pages into logical "Chapters" based on their semantic vectors.
4.  **AI Orchestration**: Uses **Gemini 3 Flash** for query expansion and synthesis, and **Gemini 2.5 Flash Image** for real-time editorial illustration.

---

## ✨ Core Features

-   **Evolutionary Selection**: Uses a Genetic Algorithm to find the "fittest" set of information.
-   **AI Illustrations**: Professional-grade editorial graphics generated on-the-fly.
-   **History Archiving**: LocalStorage persistence for your synthesized books.
-   **Command Center UI**: A "Brutalist" design aesthetic optimized for focus and usability.
-   **Keyboard Shortcuts**: Press `/` to focus the search bar instantly.
-   **Responsive Design**: Fully optimized for desktop and mobile synthesis.

---

## ⚙️ How It Works

1.  **Query Expansion**: Gemini 3 Flash expands your query into a "Web Frontier" of 20+ diverse sources.
2.  **Feature Extraction**: The engine calculates TF-IDF vectors and definitional density for every source.
3.  **Evolution**: The GA runs for 50 generations, selecting the best subset of sources that provide the most comprehensive and non-redundant coverage.
4.  **Clustering**: K-Means groups the winners into 3-5 distinct chapters.
5.  **Synthesis**: The final artifact is rendered with AI-generated visuals and structured navigation.

---

## 🚀 Installation & Setup

### Prerequisites
-   Node.js (v18 or higher)
-   An API Key for **Google Gemini** (available via Google AI Studio)

### Setup
1.  **Clone the repository**:
    ```bash
    git clone <your-repo-url>
    cd ecwbce
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Configure Environment Variables**:
    Create a `.env` file in the root directory and add your Gemini API key:
    ```env
    GEMINI_API_KEY=your_api_key_here
    ```
4.  **Run the development server**:
    ```bash
    npm run dev
    ```
    The app will be available at `http://localhost:3000`.

---

## 🏗 Technical Architecture

-   **Frontend**: React 18, Vite, TypeScript.
-   **Styling**: Tailwind CSS (Utility-first, Brutalist aesthetic).
-   **Animations**: Framer Motion (`motion/react`).
-   **Icons**: Lucide React.
-   **AI Models**: 
    *   `gemini-3-flash-preview` (Synthesis & Search Grounding)
    *   `gemini-2.5-flash-image` (Editorial Illustrations)
-   **Algorithms**:
    *   `ml-kmeans`: For hierarchical knowledge organization.
    *   Custom GA Engine: For multi-objective optimization of information quality.

---

## 📜 License
This project is licensed under the MIT License - see the LICENSE file for details.

---

*Built with ❤️ using Evolutionary Computing and Gemini AI.*
