import type {
  ApplyRunnerConfig,
  ApplyRunnerInput,
  ApplyRunnerOutput,
} from "./types";
import { DEFAULT_CONFIG } from "./types";
import type { YutoriAdapter } from "./yutori_adapter";
import { DomainThrottle } from "./domain_throttle";
import { withRetry, classifyError } from "./retry";

export type LogFn = (
  level: string,
  event: string,
  payload?: Record<string, unknown>,
) => void;

export class ApplyRunner {
  private readonly adapter: YutoriAdapter;
  private readonly config: ApplyRunnerConfig;
  private readonly throttle: DomainThrottle;
  private readonly log: LogFn;

  constructor(
    adapter: YutoriAdapter,
    config: Partial<ApplyRunnerConfig> = {},
    log: LogFn = () => {},
  ) {
    this.adapter = adapter;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.throttle = new DomainThrottle(this.config.domainThrottleMs);
    this.log = log;
  }

  async run(input: ApplyRunnerInput): Promise<ApplyRunnerOutput> {
    // 1. Per-domain throttle
    const { domain, waitedMs } = await this.throttle.throttle(input.jobUrl);
    this.log("debug", "apply_runner.throttle", {
      jobUrl: input.jobUrl,
      domain,
      waitedMs,
    });

    // 2. Submit: use per-input override when set, otherwise config safeMode (submit = !safeMode)
    const shouldSubmit = input.submit ?? !this.config.safeMode;

    // 3. Execute with retry policy
    try {
      const result = await withRetry(
        () => this.adapter.fillAndSubmit(input, shouldSubmit),
        {
          maxRetries: this.config.maxRetries,
          baseDelayMs: this.config.baseDelayMs,
          maxDelayMs: this.config.maxDelayMs,
          onRetry: (attempt, delayMs, error) => {
            this.log("warn", "apply_runner.retry", {
              jobUrl: input.jobUrl,
              attempt,
              delayMs,
              error: error.message,
            });
          },
        },
      );

      this.log("info", "apply_runner.success", {
        jobUrl: input.jobUrl,
        status: result.status,
        safeMode: this.config.safeMode,
      });

      return result;
    } catch (error: unknown) {
      const classified = classifyError(error);

      this.log("error", "apply_runner.failed", {
        jobUrl: input.jobUrl,
        errorCategory: classified.category,
        error: classified.message,
      });

      const status = /captcha|blocked/i.test(classified.message)
        ? "BLOCKED"
        : "FAILED";

      return {
        status,
        notes: `${classified.category}: ${classified.message}`,
        screenshots: [],
      };
    }
  }
}
