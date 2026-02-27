import type { ApplyRunnerInput, ApplyRunnerOutput } from "./types";

const YUTORI_BASE = "https://api.yutori.com/v1/browsing";

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["prefilled", "submitted", "needs_otp", "blocked", "failed"],
    },
    notes: {
      type: "string",
      description: "Brief description of what happened",
    },
  },
  required: ["status", "notes"],
} as const;

type YutoriStructuredStatus =
  (typeof OUTPUT_SCHEMA.properties.status.enum)[number];

// ── Interface ───────────────────────────────────────────────────────────

/**
 * Abstraction over Yutori MCP browser automation.
 *
 * The real implementation will issue MCP tool calls to navigate, fill
 * forms, and submit applications.  This interface lets us develop and
 * test the runner without the real Yutori service.
 */
export interface YutoriAdapter {
  /**
   * Navigate to the job URL, fill the application form, and optionally
   * submit it.
   *
   * @param input   Job URL + user data to fill
   * @param submit  If false, fill the form but do NOT click submit
   */
  fillAndSubmit(
    input: ApplyRunnerInput,
    submit: boolean,
  ): Promise<ApplyRunnerOutput>;
}

// ── Stub Implementation ─────────────────────────────────────────────────

/**
 * Stub that always succeeds.  Replace with real MCP calls later.
 */
export class StubYutoriAdapter implements YutoriAdapter {
  async fillAndSubmit(
    input: ApplyRunnerInput,
    submit: boolean,
  ): Promise<ApplyRunnerOutput> {
    return {
      status: submit ? "SUBMITTED" : "PREFILLED",
      notes: `Stub: would ${submit ? "submit" : "prefill"} application at ${input.jobUrl}`,
      screenshots: [],
    };
  }
}

// ── Yutori Browsing API Adapter ──────────────────────────────────────────

type YutoriCreateBody = {
  task: string;
  start_url: string;
  max_steps: number;
  output_schema: object;
  require_auth?: boolean;
};

type YutoriStatusResponse = {
  task_id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  result?: string;
  structured_result?: { status: YutoriStructuredStatus; notes?: string };
  view_url?: string;
  paused?: boolean;
};

type YutoriTrajectoryStep = { screenshot?: string };
type YutoriTrajectoryResponse = {
  task_id: string;
  steps?: YutoriTrajectoryStep[];
};

export type YutoriBrowsingAdapterOptions = {
  maxSteps?: number;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
};

function mapStructuredStatus(
  s: YutoriStructuredStatus,
): ApplyRunnerOutput["status"] {
  switch (s) {
    case "submitted":
      return "SUBMITTED";
    case "prefilled":
      return "PREFILLED";
    case "needs_otp":
      return "NEEDS_OTP";
    case "blocked":
      return "BLOCKED";
    case "failed":
    default:
      return "FAILED";
  }
}

function fallbackStatusFromText(text: string): ApplyRunnerOutput["status"] {
  const lower = text.toLowerCase();
  if (/submitted/.test(lower)) return "SUBMITTED";
  if (/captcha|blocked/.test(lower)) return "BLOCKED";
  if (/otp|verification/.test(lower)) return "NEEDS_OTP";
  return "FAILED";
}

function buildTaskPrompt(input: ApplyRunnerInput, submit: boolean): string {
  const { userProfile, resumeText } = input;
  const resumeSnippet =
    resumeText.length > 500
      ? `${resumeText.slice(0, 500)}...`
      : resumeText;
  const lines = [
    "Fill out the job application form on this page.",
    "Use the following information:",
    `- Full Name: ${userProfile.name}`,
    `- Email: ${userProfile.email}`,
  ];
  if (userProfile.phone) {
    lines.push(`- Phone: ${userProfile.phone}`);
  }
  lines.push(
    `- Resume/Cover Letter: paste this text where applicable: "${resumeSnippet}"`,
  );
  lines.push(
    submit
      ? "After filling all fields, click Submit/Apply."
      : "Fill all fields but DO NOT click Submit. Stop before submission.",
  );
  lines.push(
    "If you encounter a CAPTCHA or are blocked, stop and report it.",
  );
  lines.push(
    "If an OTP or verification code is requested, stop and report it.",
  );
  return lines.join("\n");
}

async function checkResponse(res: Response, context: string): Promise<void> {
  if (res.ok) return;
  const body = await res.text();
  const msg = `${context}: HTTP ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ""}`;
  if (res.status === 401 || res.status === 403) {
    throw new Error(msg);
  }
  if (res.status === 429) {
    throw new Error(msg);
  }
  if (res.status >= 500) {
    throw new Error(msg);
  }
  throw new Error(msg);
}

/**
 * Real implementation that calls the Yutori Browsing API to run a
 * cloud browser task, poll until completion, and map the result to
 * ApplyRunnerOutput.
 */
export class YutoriBrowsingAdapter implements YutoriAdapter {
  private readonly apiKey: string;
  private readonly maxSteps: number;
  private readonly pollIntervalMs: number;
  private readonly pollTimeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(
    apiKey: string,
    options: YutoriBrowsingAdapterOptions = {},
    fetchFn: typeof fetch = fetch,
  ) {
    this.apiKey = apiKey;
    this.maxSteps = options.maxSteps ?? 50;
    this.pollIntervalMs = options.pollIntervalMs ?? 3_000;
    this.pollTimeoutMs = options.pollTimeoutMs ?? 300_000;
    this.fetchFn = fetchFn;
  }

  async fillAndSubmit(
    input: ApplyRunnerInput,
    submit: boolean,
  ): Promise<ApplyRunnerOutput> {
    const task = buildTaskPrompt(input, submit);
    const body: YutoriCreateBody = {
      task,
      start_url: input.jobUrl,
      max_steps: this.maxSteps,
      output_schema: OUTPUT_SCHEMA,
    };

    const createRes = await this.fetchFn(`${YUTORI_BASE}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
      },
      body: JSON.stringify(body),
    }).catch((err: unknown) => {
      const message =
        err instanceof Error ? err.message : String(err);
      throw new Error(message);
    });

    await checkResponse(createRes, "Yutori create task");

    const createJson = (await createRes.json()) as { task_id: string };
    const taskId = createJson.task_id;
    if (!taskId) {
      throw new Error("Yutori create task did not return task_id");
    }

    const deadline = Date.now() + this.pollTimeoutMs;
    let statusRes: Response;
    let statusJson: YutoriStatusResponse;

    for (;;) {
      if (Date.now() >= deadline) {
        return {
          status: "FAILED",
          notes: `Timed out waiting for Yutori task ${taskId}`,
          screenshots: [],
        };
      }

      statusRes = await this.fetchFn(
        `${YUTORI_BASE}/tasks/${taskId}`,
        {
          method: "GET",
          headers: { "X-API-Key": this.apiKey },
        },
      ).catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : String(err);
        throw new Error(message);
      });

      await checkResponse(statusRes, "Yutori get status");
      statusJson = (await statusRes.json()) as YutoriStatusResponse;

      if (statusJson.status === "succeeded" || statusJson.status === "failed") {
        break;
      }

      await new Promise((r) => setTimeout(r, this.pollIntervalMs));
    }

    if (statusJson.status === "failed") {
      const resultText = statusJson.result ?? "";
      const status = fallbackStatusFromText(resultText);
      return {
        status,
        notes: resultText || "Yutori task failed",
        screenshots: [],
      };
    }

    // succeeded
    let status: ApplyRunnerOutput["status"];
    let notes: string;

    if (
      statusJson.structured_result &&
      typeof statusJson.structured_result.status === "string"
    ) {
      status = mapStructuredStatus(
        statusJson.structured_result.status as YutoriStructuredStatus,
      );
      notes =
        statusJson.structured_result.notes ??
        statusJson.result ??
        "Application task completed.";
    } else {
      const resultText = statusJson.result ?? "";
      status = fallbackStatusFromText(resultText);
      notes = resultText || "Application task completed.";
    }

    let screenshots: string[] = [];
    try {
      const trajRes = await this.fetchFn(
        `${YUTORI_BASE}/tasks/${taskId}/trajectory`,
        { method: "GET", headers: { "X-API-Key": this.apiKey } },
      );
      await checkResponse(trajRes, "Yutori get trajectory");
      const traj = (await trajRes.json()) as YutoriTrajectoryResponse;
      const steps = traj.steps ?? [];
      const withScreenshots = steps.filter(
        (s): s is YutoriTrajectoryStep & { screenshot: string } =>
          typeof s.screenshot === "string" && s.screenshot.length > 0,
      );
      screenshots = withScreenshots
        .slice(-3)
        .map((s) => s.screenshot);
    } catch {
      // trajectory is best-effort; keep notes and status
    }

    return { status, notes, screenshots };
  }
}
