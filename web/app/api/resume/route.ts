import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, zodError } from "@/lib/api";

const ResumeBodySchema = z
  .object({
    label: z.string().min(1).max(255),
    text: z.string().min(1_000).max(200_000),
    email: z.string().email().optional(),
    preferenceId: z.string().min(1).optional(),
  })
  .refine(
    (value) => value.email || value.preferenceId,
    "Either email or preferenceId is required."
  );

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "have",
  "your",
  "you",
  "are",
  "our",
  "will",
  "about",
  "into",
  "more",
  "such",
  "than",
  "also",
  "them",
  "they",
  "over",
  "were",
  "been",
  "their",
  "what",
  "when",
  "where",
  "while",
  "which",
  "would",
  "there",
]);

function extractKeywords(text: string, limit = 32): string[] {
  const words = text.toLowerCase().match(/[a-z][a-z0-9]+/g) ?? [];
  const counts = new Map<string, number>();

  for (const word of words) {
    if (word.length < 4 || STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = ResumeBodySchema.safeParse(json);

    if (!parsed.success) {
      return zodError(parsed.error);
    }

    const { label, text, email, preferenceId } = parsed.data;

    let preference =
      preferenceId != null
        ? await prisma.preference.findUnique({ where: { id: preferenceId } })
        : null;

    if (!preference && email) {
      preference = await prisma.preference.upsert({
        where: { email },
        update: {},
        create: { email },
      });
    }

    if (!preference) {
      return apiError("BAD_REQUEST", "Associated preference not found.", {
        details: { email, preferenceId },
      });
    }

    const keywordsArray = extractKeywords(text);
    const keywords = keywordsArray.join(", ");

    const resume = await prisma.resume.create({
      data: {
        label,
        rawText: text,
        keywords,
        storageKey: "inline",
        preferenceId: preference.id,
      },
    });

    return apiSuccess({
      resume,
      keywords: keywordsArray,
    });
  } catch (error) {
    console.error("Error saving resume", error);
    if (error instanceof SyntaxError) {
      return apiError("BAD_REQUEST", "Invalid JSON body.");
    }
    return apiError("INTERNAL_SERVER_ERROR", "Failed to save resume.");
  }
}

