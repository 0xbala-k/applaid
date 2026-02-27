import "dotenv/config";
import {
  ApplyTaskStatus,
  Preference,
  PrismaClient,
  Resume,
} from "@prisma/client";
import {
  buildQueries,
  mergeResults,
  type SearchPreferences,
  type TavilySearchResult,
  type QueryBatchResult,
  type RankedResult,
} from "./query_builder";

const prisma = new PrismaClient();

type LogLevel = "debug" | "info" | "warn" | "error";

type LogPayload = Record<string, unknown>;

function log(level: LogLevel, event: string, payload: LogPayload = {}): void {
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

const TAVILY_API_URL = "https://api.tavily.com/search";
const SCORE_THRESHOLD = 0.8;
const MAX_LEADS = 15;

type TavilyResponse = {
  results: TavilySearchResult[];
};

// ── Preference mapping ─────────────────────────────────────────────────

function toSearchPreferences(
  pref: Preference & { resumes: Resume[] },
): SearchPreferences {
  const prefKeywords = (pref.keywords ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  const resumeKeywords = pref.resumes.flatMap((r) =>
    (r.keywords ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
  );

  const allKeywords = [...new Set([...prefKeywords, ...resumeKeywords])];

  return {
    title: pref.title ?? undefined,
    location: pref.location ?? undefined,
    salary_min: pref.minSalary ?? undefined,
    include_keywords: allKeywords.length > 0 ? allKeywords : undefined,
  };
}

// ── Tavily API ─────────────────────────────────────────────────────────

async function tavilySearch(query: string): Promise<TavilySearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not set.");
  }

  const body = {
    api_key: apiKey,
    query,
    search_depth: "advanced",
    max_results: 20,
    topic: "general",
    include_answer: false,
    include_raw_content: false,
  };

  const response = await fetch(TAVILY_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tavily request failed with ${response.status}: ${text}`);
  }

  const data = (await response.json()) as TavilyResponse;

  return data.results ?? [];
}

// ── Helpers ────────────────────────────────────────────────────────────

function extractCompanyFromTitle(title: string): string {
  const separators = [" at ", " @ ", " - ", " | "];

  for (const sep of separators) {
    if (title.includes(sep)) {
      const parts = title.split(sep);
      const last = parts[parts.length - 1]?.trim();
      if (last) {
        return last;
      }
    }
  }

  return "Unknown";
}

// ── Persist leads & tasks ──────────────────────────────────────────────

async function persistLeads(
  preferenceId: string,
  selected: RankedResult[],
): Promise<{ newLeadsCount: number; newTasksCount: number; skippedExistingTaskCount: number }> {
  const dedupeHashes = selected.map((r) => r.dedupeHash);

  const existingLeads = await prisma.jobLead.findMany({
    where: { dedupeHash: { in: dedupeHashes } },
    include: { applyTasks: true },
  });

  const leadsByHash = new Map<string, (typeof existingLeads)[number]>();

  for (const lead of existingLeads) {
    leadsByHash.set(lead.dedupeHash, lead);
  }

  let newLeadsCount = 0;
  let newTasksCount = 0;
  let skippedExistingTaskCount = 0;

  for (const result of selected) {
    let lead = leadsByHash.get(result.dedupeHash);

    if (!lead) {
      lead = await prisma.jobLead.create({
        data: {
          preferenceId,
          title: result.title,
          company: extractCompanyFromTitle(result.title),
          location: null,
          url: result.url,
          source: "tavily",
          score: result.score,
          dedupeHash: result.dedupeHash,
        },
        include: { applyTasks: true },
      });

      leadsByHash.set(result.dedupeHash, lead);
      newLeadsCount += 1;
    }

    if (lead.applyTasks.length > 0) {
      skippedExistingTaskCount += 1;
      log("debug", "discover_and_queue.skip_existing_task", {
        jobLeadId: lead.id,
        dedupeHash: lead.dedupeHash,
        applyTaskCount: lead.applyTasks.length,
      });
      continue;
    }

    await prisma.applyTask.create({
      data: {
        jobLeadId: lead.id,
        status: ApplyTaskStatus.QUEUED,
      },
    });

    newTasksCount += 1;
  }

  return { newLeadsCount, newTasksCount, skippedExistingTaskCount };
}

// ── Main orchestrator ──────────────────────────────────────────────────

export async function discover_and_queue(): Promise<void> {
  const startedAt = new Date();
  log("info", "discover_and_queue.start", {
    startedAt: startedAt.toISOString(),
  });

  const preferences = await prisma.preference.findMany({
    include: { resumes: true },
  });

  log("info", "discover_and_queue.preferences_loaded", {
    count: preferences.length,
  });

  let totalNewLeads = 0;
  let totalNewTasks = 0;
  let totalSkipped = 0;

  for (const pref of preferences) {
    const searchPrefs = toSearchPreferences(pref);
    const queries = buildQueries(searchPrefs);

    if (queries.length === 0) {
      log("debug", "discover_and_queue.skip_preference_no_queries", {
        preferenceId: pref.id,
        email: pref.email,
      });
      continue;
    }

    log("info", "discover_and_queue.queries_built", {
      preferenceId: pref.id,
      email: pref.email,
      queryCount: queries.length,
      queries,
    });

    const batches: QueryBatchResult[] = [];

    for (const query of queries) {
      try {
        const results = await tavilySearch(query);

        log("info", "discover_and_queue.tavily_results", {
          preferenceId: pref.id,
          query,
          resultCount: results.length,
        });

        batches.push({ query, results });
      } catch (error) {
        log("error", "discover_and_queue.tavily_error", {
          preferenceId: pref.id,
          query,
          error:
            error instanceof Error
              ? { message: error.message }
              : { message: String(error) },
        });
      }
    }

    if (batches.length === 0) {
      continue;
    }

    const ranked = mergeResults(batches);

    const selected = ranked
      .filter((r) => r.score >= SCORE_THRESHOLD)
      .slice(0, MAX_LEADS);

    log("info", "discover_and_queue.candidates_selected", {
      preferenceId: pref.id,
      email: pref.email,
      totalMerged: ranked.length,
      selectedCount: selected.length,
      scoreThreshold: SCORE_THRESHOLD,
    });

    // Log actual leads when DISCOVER_DEBUG_LEADS=true (see data from Tavily)
    if (process.env.DISCOVER_DEBUG_LEADS === "true" && selected.length > 0) {
      log("info", "discover_and_queue.leads_detail", {
        preferenceId: pref.id,
        leads: selected.map((r) => ({
          title: r.title,
          url: r.url,
          score: r.score,
        })),
      });
    }

    if (selected.length === 0) {
      continue;
    }

    const counts = await persistLeads(pref.id, selected);

    log("info", "discover_and_queue.preference_complete", {
      preferenceId: pref.id,
      email: pref.email,
      ...counts,
    });

    totalNewLeads += counts.newLeadsCount;
    totalNewTasks += counts.newTasksCount;
    totalSkipped += counts.skippedExistingTaskCount;
  }

  const finishedAt = new Date();

  log("info", "discover_and_queue.finish", {
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    totalNewLeads,
    totalNewTasks,
    totalSkipped,
  });
}

if (require.main === module) {
  discover_and_queue()
    .catch((error: unknown) => {
      log("error", "discover_and_queue.unhandled_error", {
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
