import type { ClassifiedError } from "./types";

// ── Error Classification ────────────────────────────────────────────────

const TERMINAL_PATTERNS: Array<string | RegExp> = [
  /401/,
  /403/,
  /404/,
  /not found/i,
  /unauthorized/i,
  /forbidden/i,
  /captcha/i,
  /blocked/i,
  /application.*closed/i,
  /position.*filled/i,
];

const RETRYABLE_PATTERNS: Array<string | RegExp> = [
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "fetch failed",
  "socket hang up",
  /timeout/i,
  /rate.?limit/i,
  /too many requests/i,
  /503/,
  /502/,
  /429/,
];

/**
 * Classify an error as retryable or terminal.
 * Terminal patterns are checked first — if both match, terminal wins.
 * Unknown errors default to retryable (safer for transient glitches).
 */
export function classifyError(error: unknown): ClassifiedError {
  const message = error instanceof Error ? error.message : String(error);

  for (const p of TERMINAL_PATTERNS) {
    if (typeof p === "string" ? message.includes(p) : p.test(message)) {
      return { category: "terminal", message, originalError: error };
    }
  }

  for (const p of RETRYABLE_PATTERNS) {
    if (typeof p === "string" ? message.includes(p) : p.test(message)) {
      return { category: "retryable", message, originalError: error };
    }
  }

  return { category: "retryable", message, originalError: error };
}

// ── Backoff ─────────────────────────────────────────────────────────────

/**
 * Exponential backoff with full jitter.
 * Formula: random(0, min(maxDelayMs, baseDelayMs * 2^attempt))
 */
export function computeBackoffMs(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const exponential = baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(maxDelayMs, exponential);
  return Math.floor(Math.random() * capped);
}

// ── Retry Executor ──────────────────────────────────────────────────────

export type RetryOptions = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  onRetry?: (attempt: number, delayMs: number, error: ClassifiedError) => void;
  /** Injectable sleep — defaults to real setTimeout. */
  sleep?: (ms: number) => Promise<void>;
};

/**
 * Execute an async function with retry on retryable errors.
 * Terminal errors throw immediately.  After maxRetries the last error
 * is thrown.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const sleepFn =
    options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let lastError: ClassifiedError | undefined;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const classified = classifyError(error);

      if (classified.category === "terminal") {
        throw error;
      }

      lastError = classified;

      if (attempt < options.maxRetries) {
        const delayMs = computeBackoffMs(
          attempt,
          options.baseDelayMs,
          options.maxDelayMs,
        );
        options.onRetry?.(attempt, delayMs, classified);
        await sleepFn(delayMs);
      }
    }
  }

  throw lastError?.originalError ?? new Error("All retries exhausted");
}
