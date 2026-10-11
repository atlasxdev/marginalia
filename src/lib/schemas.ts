import { z } from "zod";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_QUESTION_CHARS = 2000;

export const ACCEPTED_TYPES = {
  "text/markdown": ".md",
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
} as const;

const acceptedExtensions = Object.values(ACCEPTED_TYPES) as string[];

export const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const signUpSchema = signInSchema
  .extend({
    name: z.string().trim().min(1, "Enter your name.").max(80),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

// Browsers often report .md as "" or text/plain, so the extension is the source of truth.
export const uploadSchema = z.object({
  file: z
    .instanceof(File, { message: "Choose a file to upload." })
    .refine((f) => f.size > 0, "Choose a file to upload.")
    .refine((f) => f.size <= MAX_FILE_BYTES, "Files must be 10 MB or smaller.")
    .refine(
      (f) => acceptedExtensions.some((ext) => f.name.toLowerCase().endsWith(ext)),
      "Upload a Markdown, PDF, or Word file."
    ),
});

// Notes are saved through a server action, so they stay well under its 1 MB body limit.
export const MAX_NOTE_CHARS = 200_000;

export const noteSchema = z.object({
  id: z.uuid().optional(),
  title: z
    .string()
    .trim()
    .transform((t) => t.replace(/\.md$/i, "").trim())
    .pipe(z.string().min(1, "Give it a title.").max(120, "Keep titles under 120 characters.")),
  content: z
    .string()
    .refine((c) => c.trim().length > 0, "Write something first.")
    .refine((c) => c.length <= MAX_NOTE_CHARS, "This document is too long to edit here."),
});

export const questionSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Type a question first.")
    .max(MAX_QUESTION_CHARS, `Keep questions under ${MAX_QUESTION_CHARS} characters.`),
  conversationId: z.string().optional(),
  spaceId: z.uuid().optional(),
});

export const MAX_SPACE_INSTRUCTIONS = 1000;

// Without an id, a new space is created
export const spaceSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Give the space a name.").max(80, "Keep names under 80 characters."),
  instructions: z
    .string()
    .trim()
    .max(MAX_SPACE_INSTRUCTIONS, `Keep instructions under ${MAX_SPACE_INSTRUCTIONS} characters.`),
  documentIds: z.array(z.uuid()).max(500),
});
