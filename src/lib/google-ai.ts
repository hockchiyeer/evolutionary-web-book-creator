import { GoogleGenAI, Type } from "@google/genai";

import type { WebPage } from "./types";

interface RawSource {
  url: string;
  title: string;
  snippet: string;
  content: string;
}

export function createAiClient(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}

export async function expandQueryToFrontier(ai: GoogleGenAI, query: string): Promise<WebPage[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `I want to create a comprehensive "Web-Book" about "${query}".
Please provide a list of at least 20 highly informative, diverse, and authoritative web sources (URLs, titles, and detailed snippets or summaries of their content) that would serve as chapters or sections.
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
                content: {
                  type: Type.STRING,
                  description: "A more detailed summary of the page's knowledge content",
                },
              },
              required: ["url", "title", "snippet", "content"],
            },
          },
        },
        required: ["sources"],
      },
    },
  });

  const data = JSON.parse(response.text) as { sources: RawSource[] };
  return data.sources.map((source, index) => ({
    id: index,
    rank: index,
    ...source,
  }));
}

export async function generateEditorialImage(
  ai: GoogleGenAI,
  prompt: string,
): Promise<string | undefined> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            text: `A high-quality, professional editorial illustration for a book chapter about: ${prompt}. Minimalist, clean, technical style.`,
          },
        ],
      },
      config: {
        imageConfig: { aspectRatio: "16:9", imageSize: "1K" },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (error) {
    console.error("Image generation failed", error);
  }

  return undefined;
}
