import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, zodError } from "@/lib/api";

const ParamsSchema = z.object({
  id: z.string().min(1),
});

export async function POST(
  _req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const parsedParams = ParamsSchema.safeParse(context.params);

    if (!parsedParams.success) {
      return zodError(parsedParams.error);
    }

    const { id } = parsedParams.data;

    const existing = await prisma.applyTask.findUnique({
      where: { id },
      include: { jobLead: true },
    });

    if (!existing) {
      return apiError("NOT_FOUND", "Task not found.");
    }

    const updated = await prisma.applyTask.update({
      where: { id },
      data: {
        status: "QUEUED",
        lastError: null,
        runAt: null,
      },
      include: { jobLead: true },
    });

    return apiSuccess({
      task: {
        id: updated.id,
        status: updated.status,
        runAt: updated.runAt,
        lastError: updated.lastError,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        jobLead: updated.jobLead && {
          id: updated.jobLead.id,
          title: updated.jobLead.title,
          company: updated.jobLead.company,
          location: updated.jobLead.location,
          url: updated.jobLead.url,
          score: updated.jobLead.score,
        },
      },
    });
  } catch (error) {
    console.error("Error retrying task", error);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to retry task.");
  }
}

