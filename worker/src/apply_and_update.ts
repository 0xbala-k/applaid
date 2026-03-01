import "dotenv/config";
import { ApplyTaskStatus, PrismaClient } from "@prisma/client";
import { ApplyRunner } from "./apply_runner";
import { StubYutoriAdapter, YutoriBrowsingAdapter } from "./yutori_adapter";
import type { ApplyRunnerConfig, ApplyRunnerInput } from "./types";

const prisma = new PrismaClient();

// ── Logging (same pattern as discover_and_queue.ts) ─────────────────────

type LogPayload = Record<string, unknown>;

function log(level: string, event: string, payload: LogPayload = {}): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...payload,
  };

  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

// ── Status mapping ──────────────────────────────────────────────────────

/**
 * Map runner output status to the Prisma enum.
 * BLOCKED has no Prisma value — it maps to FAILED with a descriptive
 * lastError written by the orchestrator.
 */
function toPrismaStatus(runnerStatus: string): ApplyTaskStatus {
  switch (runnerStatus) {
    case "PREFILLED":
      return ApplyTaskStatus.PREFILLED;
    case "SUBMITTED":
      return ApplyTaskStatus.SUBMITTED;
    case "NEEDS_OTP":
      return ApplyTaskStatus.NEEDS_OTP;
    case "BLOCKED":
      return ApplyTaskStatus.FAILED;
    case "FAILED":
      return ApplyTaskStatus.FAILED;
    default:
      return ApplyTaskStatus.FAILED;
  }
}

// ── Config from env ─────────────────────────────────────────────────────

function loadConfig(): Partial<ApplyRunnerConfig> {
  return {
    // Only enable safe mode (prefill, no submit) when explicitly set to "true"
    safeMode: process.env.APPLY_SAFE_MODE === "true",
    maxRetries: parseInt(process.env.APPLY_MAX_RETRIES ?? "3", 10),
    baseDelayMs: parseInt(process.env.APPLY_BASE_DELAY_MS ?? "1000", 10),
    maxDelayMs: parseInt(process.env.APPLY_MAX_DELAY_MS ?? "30000", 10),
    domainThrottleMs: parseInt(
      process.env.APPLY_DOMAIN_THROTTLE_MS ?? "5000",
      10,
    ),
  };
}

// ── Constants ───────────────────────────────────────────────────────────

const BATCH_SIZE = 10;

// ── Main orchestrator ───────────────────────────────────────────────────

export async function apply_and_update(): Promise<void> {
  const startedAt = new Date();
  log("info", "apply_and_update.start", {
    startedAt: startedAt.toISOString(),
  });

  const config = loadConfig();
  const apiKey = process.env.YUTORI_API_KEY;
  const adapter = apiKey
    ? new YutoriBrowsingAdapter(apiKey)
    : new StubYutoriAdapter();
  log(
    "info",
    "apply_and_update.adapter",
    { adapter: apiKey ? "YutoriBrowsingAdapter" : "StubYutoriAdapter" },
  );
  const runner = new ApplyRunner(adapter, config, log);

  const tasks = await prisma.applyTask.findMany({
    where: {
      status: ApplyTaskStatus.QUEUED,
      OR: [{ runAt: null }, { runAt: { lte: new Date() } }],
    },
    include: {
      jobLead: {
        include: {
          preference: {
            include: { resumes: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  log("info", "apply_and_update.tasks_loaded", { count: tasks.length });

  let succeeded = 0;
  let failed = 0;

  for (const task of tasks) {
    const lead = task.jobLead;
    const pref = lead.preference;

    if (!pref) {
      log("warn", "apply_and_update.skip_no_preference", {
        taskId: task.id,
        jobLeadId: lead.id,
      });
      continue;
    }

    const resume = pref.resumes[0];

    if (!resume?.rawText) {
      log("warn", "apply_and_update.skip_no_resume", {
        taskId: task.id,
        preferenceId: pref.id,
      });
      continue;
    }

    const input: ApplyRunnerInput = {
      jobUrl: lead.url,
      userProfile: {
        name: pref.email.split("@")[0],
        email: pref.email,
      },
      resumeText: resume.rawText,
      preferences: {
        title: pref.title ?? undefined,
        location: pref.location ?? undefined,
        minSalary: pref.minSalary ?? undefined,
        keywords: pref.keywords
          ? pref.keywords
              .split(",")
              .map((k: string) => k.trim())
              .filter(Boolean)
          : undefined,
      },
      // Tell Yutori to submit the application (fill and click Submit/Apply)
      submit: true,
    };

    // Claim the task
    await prisma.applyTask.update({
      where: { id: task.id },
      data: { runAt: new Date() },
    });

    const result = await runner.run(input);

    const prismaStatus = toPrismaStatus(result.status);

    await prisma.applyTask.update({
      where: { id: task.id },
      data: {
        status: prismaStatus,
        lastError:
          prismaStatus === ApplyTaskStatus.FAILED ? result.notes : null,
      },
    });

    log("info", "apply_and_update.task_complete", {
      taskId: task.id,
      jobUrl: lead.url,
      runnerStatus: result.status,
      prismaStatus,
    });

    if (prismaStatus === ApplyTaskStatus.FAILED) {
      failed += 1;
    } else {
      succeeded += 1;
    }
  }

  const finishedAt = new Date();

  log("info", "apply_and_update.finish", {
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    total: tasks.length,
    succeeded,
    failed,
  });
}

if (require.main === module) {
  apply_and_update()
    .catch((error: unknown) => {
      log("error", "apply_and_update.unhandled_error", {
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : { message: String(error) },
      });
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
