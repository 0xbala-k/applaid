import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, zodError } from "@/lib/api";

const LeadsQuerySchema = z.object({
  minScore: z
    .string()
    .optional()
    .transform((value) => (value == null || value === "" ? undefined : Number(value)))
    .pipe(
      z
        .number({
          invalid_type_error: "minScore must be a number between 0 and 1.",
        })
        .min(0)
        .max(1)
        .optional()
    ),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = {
      minScore: searchParams.get("minScore") ?? undefined,
    };

    const parsed = LeadsQuerySchema.safeParse(raw);

    if (!parsed.success) {
      return zodError(parsed.error);
    }

    const minScore = parsed.data.minScore ?? 0.8;

    const leads = await prisma.jobLead.findMany({
      where: {
        OR: [{ score: null }, { score: { gte: minScore } }],
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        preference: true,
        applyTasks: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return apiSuccess({
      leads: leads.map((lead) => ({
        id: lead.id,
        title: lead.title,
        company: lead.company,
        location: lead.location,
        url: lead.url,
        source: lead.source,
        score: lead.score,
        createdAt: lead.createdAt,
        preference: lead.preference
          ? {
              id: lead.preference.id,
              email: lead.preference.email,
              title: lead.preference.title,
              location: lead.preference.location,
              minSalary: lead.preference.minSalary,
            }
          : null,
        latestTask: lead.applyTasks[0]
          ? {
              id: lead.applyTasks[0].id,
              status: lead.applyTasks[0].status,
              runAt: lead.applyTasks[0].runAt,
              lastError: lead.applyTasks[0].lastError,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("Error fetching leads", error);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch leads.");
  }
}

