import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api";
import { extractKeywords } from "@/lib/resume-utils";

const MIN_TEXT_LENGTH = 100;
const MAX_TEXT_LENGTH = 200_000;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const pdfParseModule = await import("pdf-parse/lib/pdf-parse.js");
  const pdfParse = pdfParseModule.default ?? pdfParseModule;
  const data = await pdfParse(buffer);
  return (data?.text ?? "").trim();
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.convertToHtml({ buffer });
  return stripHtml(result.value ?? "");
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const email = formData.get("email") as string | null;

    if (!file || typeof file === "string") {
      return apiError("BAD_REQUEST", "Missing or invalid file.");
    }
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return apiError("BAD_REQUEST", "Valid email is required.");
    }

    const trimmedEmail = email.trim();
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const name = file.name.toLowerCase();
    let text: string;

    if (name.endsWith(".pdf") || file.type === "application/pdf") {
      text = await extractTextFromPdf(buffer);
    } else if (name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      text = await extractTextFromDocx(buffer);
    } else {
      return apiError("BAD_REQUEST", "Only PDF and DOCX files are supported.");
    }

    if (!text || text.length < MIN_TEXT_LENGTH) {
      return apiError("BAD_REQUEST", `Extracted text is too short (min ${MIN_TEXT_LENGTH} characters). The file may be empty, image-only, or corrupted.`);
    }
    if (text.length > MAX_TEXT_LENGTH) {
      text = text.slice(0, MAX_TEXT_LENGTH);
    }

    const preference = await prisma.preference.upsert({
      where: { email: trimmedEmail },
      update: {},
      create: { email: trimmedEmail },
    });

    const keywordsArray = extractKeywords(text);
    const keywords = keywordsArray.join(", ");

    const resume = await prisma.resume.create({
      data: {
        label: file.name,
        rawText: text,
        keywords,
        storageKey: "inline",
        preferenceId: preference.id,
      },
    });

    return apiSuccess({
      resume: { id: resume.id, label: resume.label },
      keywords: keywordsArray,
    });
  } catch (error) {
    console.error("Error uploading resume", error);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to process resume file.");
  }
}
