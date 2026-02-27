// ── User Profile ────────────────────────────────────────────────────────

export type UserProfile = {
  name: string;
  email: string;
  phone?: string;
};

// ── ApplyRunner I/O ─────────────────────────────────────────────────────

export type ApplyRunnerInput = {
  jobUrl: string;
  userProfile: UserProfile;
  resumeText: string;
  preferences: {
    title?: string;
    location?: string;
    minSalary?: number;
    keywords?: string[];
  };
  /** When true, fill and submit; when false, prefill only. Overrides runner config when set. */
  submit?: boolean;
};

export type ApplyRunnerStatus =
  | "PREFILLED"
  | "SUBMITTED"
  | "NEEDS_OTP"
  | "BLOCKED"
  | "FAILED";

export type ApplyRunnerOutput = {
  status: ApplyRunnerStatus;
  notes: string;
  screenshots?: string[];
};

// ── Configuration ───────────────────────────────────────────────────────

export type ApplyRunnerConfig = {
  /** When true, stop at PREFILLED and never auto-submit. Default false = fill and submit. */
  safeMode: boolean;
  /** Max retry attempts for transient failures */
  maxRetries: number;
  /** Base delay in ms for exponential backoff */
  baseDelayMs: number;
  /** Maximum delay cap in ms */
  maxDelayMs: number;
  /** Minimum interval in ms between requests to the same domain */
  domainThrottleMs: number;
};

export const DEFAULT_CONFIG: ApplyRunnerConfig = {
  safeMode: false,
  maxRetries: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  domainThrottleMs: 5_000,
};

// ── Error Classification ────────────────────────────────────────────────

export type ErrorCategory = "retryable" | "terminal";

export type ClassifiedError = {
  category: ErrorCategory;
  message: string;
  originalError: unknown;
};
