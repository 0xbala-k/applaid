import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, zodError } from "@/lib/api";

const PreferencesSchema = z.object({
  email: z.string().email(),
  title: z.string().min(1).max(255).optional(),
  location: z.string().min(1).max(255).optional(),
  minSalary: z.number().int().nonnegative().optional(),
  keywords: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = PreferencesSchema.safeParse(json);

    if (!parsed.success) {
      return zodError(parsed.error);
    }

    const { email, title, location, minSalary, keywords } = parsed.data;

    const preference = await prisma.preference.upsert({
      where: { email },
      update: {
        title,
        location,
        minSalary,
        keywords,
      },
      create: {
        email,
        title,
        location,
        minSalary,
        keywords,
      },
    });

    return apiSuccess({ preference });
  } catch (error) {
    console.error("Error saving preferences", error);
    if (error instanceof SyntaxError) {
      return apiError("BAD_REQUEST", "Invalid JSON body.");
    }
    return apiError("INTERNAL_SERVER_ERROR", "Failed to save preferences.");
  }
}

