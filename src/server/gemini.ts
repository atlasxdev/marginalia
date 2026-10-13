import "server-only";
import { ApiError, GoogleGenAI, ThinkingLevel, type Content } from "@google/genai";
import { env } from "@/lib/env";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

/* Every chat model is out of quota or overloaded */
export class ModelsUnavailableError extends Error {}

const statusOf = (error: unknown) => (error instanceof ApiError ? error.status : 0);
const isUnavailable = (error: unknown) => [429, 503].includes(statusOf(error));

// Gemini 2.5 turns thinking off with a budget; newer models take a level
const thinkingFor = (model: string) =>
  model.startsWith("gemini-2.5") ? { thinkingBudget: 0 } : { thinkingLevel: ThinkingLevel.MINIMAL };

/* The free tier gives each model its own daily quota, so on 429 (out of quota)
   or 503 (overloaded) the next model in GEMINI_CHAT_MODELS is tried. */
async function withFallback<T>(run: (model: string) => Promise<T>): Promise<T> {
  for (const model of env.GEMINI_CHAT_MODELS) {
    try {
      return await run(model);
    } catch (error) {
      if (!isUnavailable(error)) throw error;
      console.warn(`Gemini: ${model} unavailable (${statusOf(error)}), trying the next model`);
    }
  }
  throw new ModelsUnavailableError("All chat models are unavailable.");
}

export function streamChat(systemInstruction: string, contents: Content[]) {
  return withFallback((model) =>
    ai.models.generateContentStream({
      model,
      contents,
      config: { systemInstruction, temperature: 0.2, thinkingConfig: thinkingFor(model) },
    })
  );
}

export async function generateChat(systemInstruction: string, contents: Content[]) {
  const response = await withFallback((model) =>
    ai.models.generateContent({
      model,
      contents,
      config: { systemInstruction, temperature: 0.2, thinkingConfig: thinkingFor(model) },
    })
  );
  return response.text?.trim() ?? "";
}

export async function generateText(prompt: string) {
  const response = await withFallback((model) =>
    ai.models.generateContent({
      model,
      contents: prompt,
      config: { temperature: 0, thinkingConfig: thinkingFor(model) },
    })
  );
  return response.text?.trim() ?? "";
}

/** What's written in a picture of handwriting, as Markdown. Empty if there are no words. */
export async function readHandwriting(png: string) {
  const response = await withFallback((model) =>
    ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/png", data: png } },
            {
              text: "Transcribe the handwritten notes in this image as Markdown. Keep the student's wording, line breaks and lists. Write formulas in plain text. If part is a drawing or diagram, describe it in one short line in square brackets. If nothing is readable, reply with nothing. Reply with the transcription only.",
            },
          ],
        },
      ],
      config: { temperature: 0, thinkingConfig: thinkingFor(model) },
    })
  );
  return response.text?.trim() ?? "";
}

/* Structured output: the model must reply with JSON matching `schema`.
   The caller still validates it, since the schema only guides the model. */
export async function generateJson(systemInstruction: string, prompt: string, schema: object): Promise<unknown> {
  const response = await withFallback((model) =>
    ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2,
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        thinkingConfig: thinkingFor(model),
      },
    })
  );
  return JSON.parse(response.text ?? "null");
}

type EmbedTask = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

const EMBED_BATCH = 100;

/* One embedding model only, with no fallback: vectors from different models
   can't be compared. Below 3072 dimensions Gemini's vectors aren't unit length,
   so they're normalized for cosine distance. Per-minute limits are waited out. */
export async function embed(texts: string[], taskType: EmbedTask): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH);
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await ai.models.embedContent({
          model: env.GEMINI_EMBEDDING_MODEL,
          contents: batch,
          config: { taskType, outputDimensionality: env.EMBEDDING_DIMENSIONS },
        });
        for (const e of res.embeddings ?? []) vectors.push(normalize(e.values ?? []));
        break;
      } catch (error) {
        if (statusOf(error) !== 429 || attempt >= 3) throw error;
        await new Promise((r) => setTimeout(r, 15_000 * (attempt + 1)));
      }
    }
  }
  if (vectors.length !== texts.length) throw new Error("Embedding count mismatch.");
  return vectors;
}

function normalize(v: number[]) {
  const length = Math.hypot(...v) || 1;
  return v.map((x) => x / length);
}
