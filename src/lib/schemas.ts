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

export const questionSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Type a question first.")
    .max(MAX_QUESTION_CHARS, `Keep questions under ${MAX_QUESTION_CHARS} characters.`),
  conversationId: z.string().optional(),
});
