import "server-only";
import { z } from "zod";

// Server-side config, validated once. Secrets never use the NEXT_PUBLIC_ prefix.
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_CHAT_MODELS: z
    .string()
    .min(1)
    .transform((s) => s.split(",").map((m) => m.trim()).filter(Boolean)),
  GEMINI_EMBEDDING_MODEL: z.string().min(1),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive(),
  NEXT_PUBLIC_SITE_URL: z.url(),
});

export const env = schema.parse(process.env);
