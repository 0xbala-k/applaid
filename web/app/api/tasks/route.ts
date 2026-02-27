import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, zodError } from "@/lib/api";

const ApplyTaskStatusValues = [
  "QUEUED",
  "PREFILLED",
  "SUBMITTED",
  "NEEDS_OTP",
  "CONFIRMED",
  "REJECTED",
  "FAILED",
] as const;

type ApplyTaskStatus = (typeof ApplyTaskStatusValues)[number];

const TasksQuerySchema = z.object({
  status: z.enum(ApplyTaskStatusValues).optional(),
  limit: z
    .string()
    .optional()
    .transform((value) => (value == null || value === "" ? undefined : Number(value)))
    .pipe(
      z
        .number({
          invalid_type_error: "limit must be a number.",
        })
        .int()
        .min(1)
        .max(200)
        .optional()
    ),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = {
      status: (searchParams.get("status") as ApplyTaskStatus | null) ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    };

    const parsed = TasksQuerySchema.safeParse(raw);

    if (!parsed.success) {
      return zodError(parsed.error);
    }

    const { status, limit } = parsed.data;

    const tasks = await prisma.applyTask.findMany({
      where: {
        status: status ?? undefined,
      },
      orderBy: { createdAt: "desc" },
      take: limit ?? 50,
      include: {
        jobLead: true,
      },
    });

    return apiSuccess({
      tasks: tasks.map((task) => ({
        id: task.id,
        status: task.status,
        runAt: task.runAt,
        lastError: task.lastError,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        jobLead: task.jobLead && {
          id: task.jobLead.id,
          title: task.jobLead.title,
          company: task.jobLead.company,
          location: task.jobLead.location,
          url: task.jobLead.url,
          score: task.jobLead.score,
        },
      })),
    });
  } catch (error) {
    console.error("Error fetching tasks", error);
    return apiError("INTERNAL_SERVER_ERROR", "Failed to fetch tasks.");
  }
}

