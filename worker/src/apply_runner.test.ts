import { describe, it, expect, vi, beforeEach } from "vitest";
import { DomainThrottle } from "./domain_throttle";
import { classifyError, computeBackoffMs, withRetry } from "./retry";
import { ApplyRunner, type LogFn } from "./apply_runner";
import type { YutoriAdapter } from "./yutori_adapter";
import {
  StubYutoriAdapter,
  YutoriBrowsingAdapter,
} from "./yutori_adapter";
import type { ApplyRunnerInput, ApplyRunnerOutput } from "./types";

// ── Helpers ─────────────────────────────────────────────────────────────

/** DomainThrottle subclass that never actually sleeps. */
class InstantThrottle extends DomainThrottle {
  protected override sleep(_ms: number): Promise<void> {
    return Promise.resolve();
  }
}

function makeInput(url = "https://boards.greenhouse.io/acme/jobs/123"): ApplyRunnerInput {
  return {
    jobUrl: url,
    userProfile: { name: "Ada", email: "ada@test.com", phone: "555-0100" },
    resumeText: "Experienced engineer...",
    preferences: { title: "Engineer", keywords: ["TypeScript"] },
  };
}

// ── DomainThrottle ──────────────────────────────────────────────────────

describe("DomainThrottle", () => {
  describe("extractDomain", () => {
    const t = new DomainThrottle(5000);

    it("normalises boards.greenhouse.io → greenhouse.io", () => {
      expect(t.extractDomain("https://boards.greenhouse.io/acme/jobs/1")).toBe(
        "greenhouse.io",
      );
    });

    it("normalises jobs.lever.co → lever.co", () => {
      expect(t.extractDomain("https://jobs.lever.co/acme/abc")).toBe(
        "lever.co",
      );
    });

    it("normalises bare greenhouse.io → greenhouse.io", () => {
      expect(t.extractDomain("https://greenhouse.io/path")).toBe(
        "greenhouse.io",
      );
    });

    it("keeps non-ATS hostnames as-is", () => {
      expect(t.extractDomain("https://careers.google.com/jobs/1")).toBe(
        "careers.google.com",
      );
    });

    it('returns "unknown" for invalid URLs', () => {
      expect(t.extractDomain("not a url")).toBe("unknown");
    });
  });

  describe("getWaitMs / recordRequest", () => {
    it("returns 0 when no prior request exists", () => {
      const t = new DomainThrottle(5000);
      expect(t.getWaitMs("greenhouse.io", 1000)).toBe(0);
    });

    it("returns remaining ms when interval has not elapsed", () => {
      const t = new DomainThrottle(5000);
      t.recordRequest("greenhouse.io", 1000);
      expect(t.getWaitMs("greenhouse.io", 3000)).toBe(3000);
    });

    it("returns 0 when interval has fully elapsed", () => {
      const t = new DomainThrottle(5000);
      t.recordRequest("greenhouse.io", 1000);
      expect(t.getWaitMs("greenhouse.io", 7000)).toBe(0);
    });

    it("tracks domains independently", () => {
      const t = new DomainThrottle(5000);
      t.recordRequest("greenhouse.io", 1000);
      expect(t.getWaitMs("lever.co", 1000)).toBe(0);
    });
  });

  describe("throttle", () => {
    it("does not wait on first request to a domain", async () => {
      const t = new InstantThrottle(5000);
      const { domain, waitedMs } = await t.throttle(
        "https://boards.greenhouse.io/x",
      );
      expect(domain).toBe("greenhouse.io");
      expect(waitedMs).toBe(0);
    });

    it("reports positive waitedMs on second call to same domain", async () => {
      const t = new InstantThrottle(5000);
      await t.throttle("https://boards.greenhouse.io/a");
      const { waitedMs } = await t.throttle(
        "https://boards.greenhouse.io/b",
      );
      expect(waitedMs).toBeGreaterThan(0);
    });
  });

  describe("extractDomain — remaining ATS roots", () => {
    const t = new DomainThrottle(5000);

    it("normalises app.smartrecruiters.com → smartrecruiters.com", () => {
      expect(
        t.extractDomain("https://app.smartrecruiters.com/job/1"),
      ).toBe("smartrecruiters.com");
    });

    it("normalises app.ashbyhq.com → ashbyhq.com", () => {
      expect(t.extractDomain("https://app.ashbyhq.com/posting/1")).toBe(
        "ashbyhq.com",
      );
    });

    it("normalises careers.icims.com → icims.com", () => {
      expect(t.extractDomain("https://careers.icims.com/jobs/1")).toBe(
        "icims.com",
      );
    });

    it("normalises company.myworkdayjobs.com → myworkdayjobs.com", () => {
      expect(
        t.extractDomain("https://acme.myworkdayjobs.com/en-US/careers/1"),
      ).toBe("myworkdayjobs.com");
    });

    it("normalises hire.jobvite.com → jobvite.com", () => {
      expect(t.extractDomain("https://hire.jobvite.com/j/abc")).toBe(
        "jobvite.com",
      );
    });

    it("normalises acme.breezy.hr → breezy.hr", () => {
      expect(t.extractDomain("https://acme.breezy.hr/p/abc")).toBe(
        "breezy.hr",
      );
    });
  });

  describe("extractDomain — edge cases", () => {
    const t = new DomainThrottle(5000);

    it("lowercases hostnames", () => {
      expect(t.extractDomain("https://Boards.GREENHOUSE.IO/x")).toBe(
        "greenhouse.io",
      );
    });

    it("returns hostname for non-ATS domains", () => {
      expect(t.extractDomain("https://apply.workable.com/x")).toBe(
        "apply.workable.com",
      );
    });

    it("handles URLs with ports", () => {
      expect(t.extractDomain("https://greenhouse.io:443/path")).toBe(
        "greenhouse.io",
      );
    });

    it('returns "unknown" for empty string', () => {
      expect(t.extractDomain("")).toBe("unknown");
    });
  });

  describe("getWaitMs — boundary", () => {
    it("returns 0 when exactly at the interval boundary", () => {
      const t = new DomainThrottle(5000);
      t.recordRequest("a.com", 1000);
      expect(t.getWaitMs("a.com", 6000)).toBe(0);
    });
  });

  describe("recordRequest — overwrite", () => {
    it("overwrites the previous timestamp", () => {
      const t = new DomainThrottle(5000);
      t.recordRequest("a.com", 1000);
      t.recordRequest("a.com", 4000);
      expect(t.getWaitMs("a.com", 5000)).toBe(4000);
    });
  });
});

// ── classifyError ───────────────────────────────────────────────────────

describe("classifyError", () => {
  it('classifies ECONNRESET as "retryable"', () => {
    expect(classifyError(new Error("read ECONNRESET")).category).toBe(
      "retryable",
    );
  });

  it('classifies 429 as "retryable"', () => {
    expect(classifyError(new Error("429 Too Many Requests")).category).toBe(
      "retryable",
    );
  });

  it('classifies timeout as "retryable"', () => {
    expect(classifyError(new Error("request timeout")).category).toBe(
      "retryable",
    );
  });

  it('classifies 404 as "terminal"', () => {
    expect(classifyError(new Error("HTTP 404")).category).toBe("terminal");
  });

  it('classifies "captcha" as "terminal"', () => {
    expect(classifyError(new Error("captcha required")).category).toBe(
      "terminal",
    );
  });

  it('classifies "blocked" as "terminal"', () => {
    expect(classifyError(new Error("request blocked")).category).toBe(
      "terminal",
    );
  });

  it('classifies "forbidden" as "terminal"', () => {
    expect(classifyError(new Error("403 Forbidden")).category).toBe("terminal");
  });

  it('defaults unknown errors to "retryable"', () => {
    expect(classifyError(new Error("some weird thing")).category).toBe(
      "retryable",
    );
  });

  it("terminal wins when message matches both categories", () => {
    expect(
      classifyError(new Error("blocked after timeout")).category,
    ).toBe("terminal");
  });

  it("handles non-Error values", () => {
    const c = classifyError("plain string error");
    expect(c.message).toBe("plain string error");
    expect(c.category).toBe("retryable");
  });

  // ── Retryable pattern coverage ──────────────────────────────────────

  it.each([
    ["ECONNREFUSED", "connect ECONNREFUSED 127.0.0.1:3000"],
    ["ENOTFOUND", "getaddrinfo ENOTFOUND api.example.com"],
    ["ETIMEDOUT", "connect ETIMEDOUT 10.0.0.1:443"],
    ["fetch failed", "fetch failed"],
    ["socket hang up", "socket hang up"],
    ["rate limit", "rate limit exceeded"],
    ["rate-limit", "rate-limit: slow down"],
    ["too many requests", "too many requests"],
    ["502", "HTTP 502 Bad Gateway"],
    ["503", "HTTP 503 Service Unavailable"],
  ])('classifies "%s" as retryable (%s)', (_label, msg) => {
    expect(classifyError(new Error(msg)).category).toBe("retryable");
  });

  // ── Terminal pattern coverage ───────────────────────────────────────

  it.each([
    ["401", "HTTP 401 Unauthorized response"],
    ["unauthorized", "Request unauthorized"],
    ["not found", "Page not found"],
    ["application closed", "This application is closed"],
    ["position filled", "Sorry, position filled"],
  ])('classifies "%s" as terminal (%s)', (_label, msg) => {
    expect(classifyError(new Error(msg)).category).toBe("terminal");
  });

  // ── originalError preservation ──────────────────────────────────────

  it("preserves the original Error object", () => {
    const err = new Error("ECONNRESET");
    const c = classifyError(err);
    expect(c.originalError).toBe(err);
  });

  it("preserves non-Error original values", () => {
    const c = classifyError(42);
    expect(c.originalError).toBe(42);
    expect(c.message).toBe("42");
  });

  it("handles null error", () => {
    const c = classifyError(null);
    expect(c.message).toBe("null");
    expect(c.category).toBe("retryable");
  });

  it("handles undefined error", () => {
    const c = classifyError(undefined);
    expect(c.message).toBe("undefined");
    expect(c.category).toBe("retryable");
  });
});

// ── computeBackoffMs ────────────────────────────────────────────────────

describe("computeBackoffMs", () => {
  it("returns a value in [0, min(max, base*2^attempt)]", () => {
    for (let i = 0; i < 100; i++) {
      const ms = computeBackoffMs(2, 1000, 30_000);
      // base * 2^2 = 4000, capped at 30_000 → range [0, 4000)
      expect(ms).toBeGreaterThanOrEqual(0);
      expect(ms).toBeLessThan(4000);
    }
  });

  it("respects the maxDelay cap", () => {
    for (let i = 0; i < 100; i++) {
      const ms = computeBackoffMs(20, 1000, 500);
      expect(ms).toBeLessThan(500);
    }
  });

  it("returns 0 for attempt 0 with base 0", () => {
    expect(computeBackoffMs(0, 0, 30_000)).toBe(0);
  });

  it("attempt 0 range is [0, base)", () => {
    for (let i = 0; i < 100; i++) {
      const ms = computeBackoffMs(0, 1000, 30_000);
      expect(ms).toBeGreaterThanOrEqual(0);
      expect(ms).toBeLessThan(1000);
    }
  });

  it("grows exponentially with attempt number", () => {
    // At attempt 3, cap = min(30_000, 1000 * 2^3) = 8000
    for (let i = 0; i < 50; i++) {
      expect(computeBackoffMs(3, 1000, 30_000)).toBeLessThan(8000);
    }
  });

  it("returns integer values", () => {
    for (let i = 0; i < 50; i++) {
      const ms = computeBackoffMs(2, 1000, 30_000);
      expect(Number.isInteger(ms)).toBe(true);
    }
  });
});

// ── withRetry ───────────────────────────────────────────────────────────

describe("withRetry", () => {
  const noSleep = async () => {};

  it("returns on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 10,
      maxDelayMs: 100,
      sleep: noSleep,
    });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries retryable errors then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockRejectedValueOnce(new Error("ETIMEDOUT"))
      .mockResolvedValue("recovered");

    const onRetry = vi.fn();
    const result = await withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 10,
      maxDelayMs: 100,
      onRetry,
      sleep: noSleep,
    });

    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry.mock.calls[0][0]).toBe(0); // first retry attempt=0
    expect(onRetry.mock.calls[1][0]).toBe(1); // second retry attempt=1
  });

  it("throws immediately on terminal error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("HTTP 404 Not Found"));

    await expect(
      withRetry(fn, {
        maxRetries: 5,
        baseDelayMs: 10,
        maxDelayMs: 100,
        sleep: noSleep,
      }),
    ).rejects.toThrow("404");

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("ECONNRESET"));

    await expect(
      withRetry(fn, {
        maxRetries: 2,
        baseDelayMs: 10,
        maxDelayMs: 100,
        sleep: noSleep,
      }),
    ).rejects.toThrow("ECONNRESET");

    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("maxRetries=0 means single attempt, no retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("ECONNRESET"));

    await expect(
      withRetry(fn, {
        maxRetries: 0,
        baseDelayMs: 10,
        maxDelayMs: 100,
        sleep: noSleep,
      }),
    ).rejects.toThrow("ECONNRESET");

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not call onRetry when fn succeeds on first try", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const onRetry = vi.fn();

    await withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 10,
      maxDelayMs: 100,
      onRetry,
      sleep: noSleep,
    });

    expect(onRetry).not.toHaveBeenCalled();
  });

  it("throws immediately if terminal error occurs on second attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockRejectedValueOnce(new Error("HTTP 404 Not Found"));

    await expect(
      withRetry(fn, {
        maxRetries: 5,
        baseDelayMs: 10,
        maxDelayMs: 100,
        sleep: noSleep,
      }),
    ).rejects.toThrow("404");

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("re-throws the original error object, not a wrapper", async () => {
    const original = new Error("ECONNRESET");
    const fn = vi.fn().mockRejectedValue(original);

    try {
      await withRetry(fn, {
        maxRetries: 0,
        baseDelayMs: 10,
        maxDelayMs: 100,
        sleep: noSleep,
      });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBe(original);
    }
  });

  it("does not call onRetry on the final failed attempt", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    const onRetry = vi.fn();

    await expect(
      withRetry(fn, {
        maxRetries: 2,
        baseDelayMs: 10,
        maxDelayMs: 100,
        onRetry,
        sleep: noSleep,
      }),
    ).rejects.toThrow();

    // onRetry called for attempts 0 and 1, but NOT for the final attempt 2
    expect(onRetry).toHaveBeenCalledTimes(2);
  });
});

// ── StubYutoriAdapter ───────────────────────────────────────────────────

describe("StubYutoriAdapter", () => {
  const stub = new StubYutoriAdapter();

  it("returns PREFILLED when submit is false", async () => {
    const result = await stub.fillAndSubmit(makeInput(), false);
    expect(result.status).toBe("PREFILLED");
    expect(result.notes).toContain("prefill");
  });

  it("returns SUBMITTED when submit is true", async () => {
    const result = await stub.fillAndSubmit(makeInput(), true);
    expect(result.status).toBe("SUBMITTED");
    expect(result.notes).toContain("submit");
  });

  it("includes the job URL in notes", async () => {
    const result = await stub.fillAndSubmit(
      makeInput("https://example.com/job/42"),
      false,
    );
    expect(result.notes).toContain("https://example.com/job/42");
  });

  it("returns an empty screenshots array", async () => {
    const result = await stub.fillAndSubmit(makeInput(), true);
    expect(result.screenshots).toEqual([]);
  });
});

// ── ApplyRunner ─────────────────────────────────────────────────────────

describe("ApplyRunner", () => {
  let mockAdapter: YutoriAdapter;
  let logSpy: LogFn;

  beforeEach(() => {
    mockAdapter = {
      fillAndSubmit: vi.fn().mockResolvedValue({
        status: "SUBMITTED",
        notes: "OK",
        screenshots: [],
      } satisfies ApplyRunnerOutput),
    };
    logSpy = vi.fn();
  });

  it("returns adapter output on success", async () => {
    const runner = new ApplyRunner(mockAdapter, { domainThrottleMs: 0 }, logSpy);
    const result = await runner.run(makeInput());
    expect(result.status).toBe("SUBMITTED");
    expect(result.notes).toBe("OK");
  });

  it("passes submit=false in safe mode (default)", async () => {
    const runner = new ApplyRunner(
      mockAdapter,
      { safeMode: true, domainThrottleMs: 0 },
      logSpy,
    );
    await runner.run(makeInput());
    expect(mockAdapter.fillAndSubmit).toHaveBeenCalledWith(
      expect.any(Object),
      false,
    );
  });

  it("passes submit=true when safe mode is off", async () => {
    const runner = new ApplyRunner(
      mockAdapter,
      { safeMode: false, domainThrottleMs: 0 },
      logSpy,
    );
    await runner.run(makeInput());
    expect(mockAdapter.fillAndSubmit).toHaveBeenCalledWith(
      expect.any(Object),
      true,
    );
  });

  it("retries on retryable adapter error then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValue({
        status: "SUBMITTED",
        notes: "recovered",
        screenshots: [],
      } satisfies ApplyRunnerOutput);

    mockAdapter.fillAndSubmit = fn;
    const runner = new ApplyRunner(
      mockAdapter,
      { maxRetries: 2, baseDelayMs: 0, maxDelayMs: 0, domainThrottleMs: 0 },
      logSpy,
    );

    const result = await runner.run(makeInput());
    expect(result.status).toBe("SUBMITTED");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('returns FAILED on terminal adapter error', async () => {
    mockAdapter.fillAndSubmit = vi
      .fn()
      .mockRejectedValue(new Error("HTTP 404 Not Found"));

    const runner = new ApplyRunner(
      mockAdapter,
      { maxRetries: 3, baseDelayMs: 0, maxDelayMs: 0, domainThrottleMs: 0 },
      logSpy,
    );

    const result = await runner.run(makeInput());
    expect(result.status).toBe("FAILED");
    expect(result.notes).toContain("404");
    expect(mockAdapter.fillAndSubmit).toHaveBeenCalledTimes(1);
  });

  it('returns BLOCKED when adapter throws captcha error', async () => {
    mockAdapter.fillAndSubmit = vi
      .fn()
      .mockRejectedValue(new Error("captcha required"));

    const runner = new ApplyRunner(
      mockAdapter,
      { maxRetries: 3, baseDelayMs: 0, maxDelayMs: 0, domainThrottleMs: 0 },
      logSpy,
    );

    const result = await runner.run(makeInput());
    expect(result.status).toBe("BLOCKED");
    expect(result.notes).toContain("captcha");
  });

  it('returns BLOCKED when adapter throws "blocked" error', async () => {
    mockAdapter.fillAndSubmit = vi
      .fn()
      .mockRejectedValue(new Error("request blocked by WAF"));

    const runner = new ApplyRunner(
      mockAdapter,
      { maxRetries: 3, baseDelayMs: 0, maxDelayMs: 0, domainThrottleMs: 0 },
      logSpy,
    );

    const result = await runner.run(makeInput());
    expect(result.status).toBe("BLOCKED");
  });

  it("logs throttle, success, and retry events", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValue({
        status: "PREFILLED",
        notes: "ok",
        screenshots: [],
      } satisfies ApplyRunnerOutput);

    mockAdapter.fillAndSubmit = fn;
    const runner = new ApplyRunner(
      mockAdapter,
      { maxRetries: 2, baseDelayMs: 0, maxDelayMs: 0, domainThrottleMs: 0 },
      logSpy,
    );

    await runner.run(makeInput());

    const events = (logSpy as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[1],
    );
    expect(events).toContain("apply_runner.throttle");
    expect(events).toContain("apply_runner.retry");
    expect(events).toContain("apply_runner.success");
  });

  it("returns FAILED after exhausting retries", async () => {
    mockAdapter.fillAndSubmit = vi
      .fn()
      .mockRejectedValue(new Error("ECONNRESET"));

    const runner = new ApplyRunner(
      mockAdapter,
      { maxRetries: 1, baseDelayMs: 0, maxDelayMs: 0, domainThrottleMs: 0 },
      logSpy,
    );

    const result = await runner.run(makeInput());
    expect(result.status).toBe("FAILED");
    expect(result.notes).toContain("ECONNRESET");
    // initial + 1 retry = 2
    expect(mockAdapter.fillAndSubmit).toHaveBeenCalledTimes(2);
  });

  it("throttles consecutive requests to the same domain", async () => {
    // Use a real throttle with 100ms interval and track timing
    const runner = new ApplyRunner(
      mockAdapter,
      { domainThrottleMs: 100, safeMode: false },
      logSpy,
    );

    const t0 = Date.now();
    await runner.run(makeInput("https://boards.greenhouse.io/a/1"));
    await runner.run(makeInput("https://boards.greenhouse.io/b/2"));
    const elapsed = Date.now() - t0;

    // Second call should have waited ~100ms
    expect(elapsed).toBeGreaterThanOrEqual(80); // allow small timing variance
  });

  it("does not throttle across different domains", async () => {
    const runner = new ApplyRunner(
      mockAdapter,
      { domainThrottleMs: 200, safeMode: false },
      logSpy,
    );

    const t0 = Date.now();
    await runner.run(makeInput("https://boards.greenhouse.io/a/1"));
    await runner.run(makeInput("https://jobs.lever.co/b/2"));
    const elapsed = Date.now() - t0;

    // Different domains → no throttle wait
    expect(elapsed).toBeLessThan(100);
  });

  // ── Additional coverage ─────────────────────────────────────────────

  it("passes through NEEDS_OTP status from adapter", async () => {
    mockAdapter.fillAndSubmit = vi.fn().mockResolvedValue({
      status: "NEEDS_OTP",
      notes: "OTP screen detected",
      screenshots: ["otp.png"],
    } satisfies ApplyRunnerOutput);

    const runner = new ApplyRunner(mockAdapter, { domainThrottleMs: 0 }, logSpy);
    const result = await runner.run(makeInput());

    expect(result.status).toBe("NEEDS_OTP");
    expect(result.notes).toBe("OTP screen detected");
  });

  it("passes through screenshots from adapter", async () => {
    mockAdapter.fillAndSubmit = vi.fn().mockResolvedValue({
      status: "SUBMITTED",
      notes: "done",
      screenshots: ["before.png", "after.png"],
    } satisfies ApplyRunnerOutput);

    const runner = new ApplyRunner(mockAdapter, { domainThrottleMs: 0 }, logSpy);
    const result = await runner.run(makeInput());

    expect(result.screenshots).toEqual(["before.png", "after.png"]);
  });

  it("uses DEFAULT_CONFIG when no config is provided", async () => {
    // Should not throw — defaults are applied internally
    const runner = new ApplyRunner(mockAdapter);
    const result = await runner.run(makeInput());
    // Default safeMode is false → submit=true (fill and apply)
    expect(mockAdapter.fillAndSubmit).toHaveBeenCalledWith(
      expect.any(Object),
      true,
    );
    expect(result.status).toBe("SUBMITTED");
  });

  it("works without a log function (noop default)", async () => {
    const runner = new ApplyRunner(mockAdapter, { domainThrottleMs: 0 });
    // Should not throw
    const result = await runner.run(makeInput());
    expect(result.status).toBe("SUBMITTED");
  });

  it("includes error category and message in notes on failure", async () => {
    mockAdapter.fillAndSubmit = vi
      .fn()
      .mockRejectedValue(new Error("HTTP 404 Not Found"));

    const runner = new ApplyRunner(
      mockAdapter,
      { maxRetries: 0, domainThrottleMs: 0 },
      logSpy,
    );
    const result = await runner.run(makeInput());

    expect(result.notes).toBe("terminal: HTTP 404 Not Found");
  });

  it("includes retryable category in notes after exhausted retries", async () => {
    mockAdapter.fillAndSubmit = vi
      .fn()
      .mockRejectedValue(new Error("ECONNRESET"));

    const runner = new ApplyRunner(
      mockAdapter,
      { maxRetries: 0, domainThrottleMs: 0 },
      logSpy,
    );
    const result = await runner.run(makeInput());

    expect(result.notes).toBe("retryable: ECONNRESET");
  });

  it("logs error event with category on failure", async () => {
    mockAdapter.fillAndSubmit = vi
      .fn()
      .mockRejectedValue(new Error("HTTP 404 Not Found"));

    const runner = new ApplyRunner(
      mockAdapter,
      { maxRetries: 0, domainThrottleMs: 0 },
      logSpy,
    );
    await runner.run(makeInput());

    const failedCall = (logSpy as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => c[1] === "apply_runner.failed",
    );
    expect(failedCall).toBeDefined();
    expect((failedCall as unknown[])[2]).toEqual(
      expect.objectContaining({
        errorCategory: "terminal",
        error: "HTTP 404 Not Found",
      }),
    );
  });

  it("logs throttle event with domain and waitedMs", async () => {
    const runner = new ApplyRunner(
      mockAdapter,
      { domainThrottleMs: 0 },
      logSpy,
    );
    await runner.run(makeInput("https://jobs.lever.co/acme/1"));

    const throttleCall = (logSpy as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => c[1] === "apply_runner.throttle",
    );
    expect(throttleCall).toBeDefined();
    expect((throttleCall as unknown[])[2]).toEqual(
      expect.objectContaining({
        domain: "lever.co",
        waitedMs: 0,
        jobUrl: "https://jobs.lever.co/acme/1",
      }),
    );
  });

  it("logs success event with status and safeMode flag", async () => {
    const runner = new ApplyRunner(
      mockAdapter,
      { safeMode: false, domainThrottleMs: 0 },
      logSpy,
    );
    await runner.run(makeInput());

    const successCall = (logSpy as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => c[1] === "apply_runner.success",
    );
    expect(successCall).toBeDefined();
    expect((successCall as unknown[])[2]).toEqual(
      expect.objectContaining({
        status: "SUBMITTED",
        safeMode: false,
      }),
    );
  });

  it("returns empty screenshots array on failure", async () => {
    mockAdapter.fillAndSubmit = vi
      .fn()
      .mockRejectedValue(new Error("HTTP 404 Not Found"));

    const runner = new ApplyRunner(
      mockAdapter,
      { maxRetries: 0, domainThrottleMs: 0 },
      logSpy,
    );
    const result = await runner.run(makeInput());

    expect(result.screenshots).toEqual([]);
  });
});

// ── YutoriBrowsingAdapter ─────────────────────────────────────────────────

describe("YutoriBrowsingAdapter", () => {
  const baseUrl = "https://api.yutori.com/v1/browsing";

  function mockFetch(
    handlers: {
      create?: () => Promise<Response>;
      status?: (url: string) => Promise<Response>;
      trajectory?: (url: string) => Promise<Response>;
    } = {},
  ): typeof fetch {
    return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "POST" && url === `${baseUrl}/tasks` && handlers.create) {
        return handlers.create();
      }
      if (method === "GET" && handlers.status) {
        const match = url.match(new RegExp(`^${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/tasks/([^/]+)$`));
        if (match) return handlers.status(url);
      }
      if (method === "GET" && handlers.trajectory) {
        if (url.includes("/trajectory")) return handlers.trajectory(url);
      }
      return new Response(JSON.stringify({ error: "not mocked" }), {
        status: 404,
      });
    }) as unknown as typeof fetch;
  }

  it("happy path: succeeded + structured_result — status mapped, screenshots returned", async () => {
    const taskId = "task-abc";
    const fetchMock = mockFetch({
      create: async () =>
        new Response(JSON.stringify({ task_id: taskId }), { status: 200 }),
      status: async () =>
        new Response(
          JSON.stringify({
            task_id: taskId,
            status: "succeeded",
            structured_result: {
              status: "submitted",
              notes: "Application submitted successfully.",
            },
          }),
          { status: 200 },
        ),
      trajectory: async () =>
        new Response(
          JSON.stringify({
            task_id: taskId,
            steps: [
              { screenshot: "base64img1" },
              { screenshot: "base64img2" },
              { screenshot: "base64img3" },
            ],
          }),
          { status: 200 },
        ),
    });

    const adapter = new YutoriBrowsingAdapter("key", {}, fetchMock);
    const result = await adapter.fillAndSubmit(makeInput(), true);

    expect(result.status).toBe("SUBMITTED");
    expect(result.notes).toBe("Application submitted successfully.");
    expect(result.screenshots).toEqual(["base64img1", "base64img2", "base64img3"]);
    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/tasks`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-API-Key": "key" }),
      }),
    );
  });

  it("polling: queued → running → succeeded — polls multiple times", async () => {
    const taskId = "task-poll";
    let statusCalls = 0;
    const fetchMock = mockFetch({
      create: async () =>
        new Response(JSON.stringify({ task_id: taskId }), { status: 200 }),
      status: async () => {
        statusCalls += 1;
        const status =
          statusCalls < 3 ? (statusCalls === 1 ? "queued" : "running") : "succeeded";
        return new Response(
          JSON.stringify({
            task_id: taskId,
            status,
            structured_result:
              status === "succeeded"
                ? { status: "prefilled", notes: "Done" }
                : undefined,
          }),
          { status: 200 },
        );
      },
    });

    const adapter = new YutoriBrowsingAdapter("key", {
      pollIntervalMs: 10,
      pollTimeoutMs: 5000,
    }, fetchMock);
    const result = await adapter.fillAndSubmit(makeInput(), false);

    expect(result.status).toBe("PREFILLED");
    expect(statusCalls).toBeGreaterThanOrEqual(3);
  });

  it("failed task — returns FAILED status", async () => {
    const taskId = "task-fail";
    const fetchMock = mockFetch({
      create: async () =>
        new Response(JSON.stringify({ task_id: taskId }), { status: 200 }),
      status: async () =>
        new Response(
          JSON.stringify({
            task_id: taskId,
            status: "failed",
            result: "Form validation error",
          }),
          { status: 200 },
        ),
    });

    const adapter = new YutoriBrowsingAdapter("key", {}, fetchMock);
    const result = await adapter.fillAndSubmit(makeInput(), true);

    expect(result.status).toBe("FAILED");
    expect(result.notes).toContain("Form validation error");
  });

  it("timeout — status always running returns FAILED with timeout message", async () => {
    const taskId = "task-slow";
    const fetchMock = mockFetch({
      create: async () =>
        new Response(JSON.stringify({ task_id: taskId }), { status: 200 }),
      status: async () =>
        new Response(
          JSON.stringify({ task_id: taskId, status: "running" }),
          { status: 200 },
        ),
    });

    const adapter = new YutoriBrowsingAdapter("key", {
      pollIntervalMs: 10,
      pollTimeoutMs: 80,
    }, fetchMock);
    const result = await adapter.fillAndSubmit(makeInput(), true);

    expect(result.status).toBe("FAILED");
    expect(result.notes).toContain("Timed out waiting for Yutori task");
    expect(result.notes).toContain(taskId);
  });

  it("no structured_result, fallback to text — result 'I submitted' → SUBMITTED", async () => {
    const taskId = "task-text";
    const fetchMock = mockFetch({
      create: async () =>
        new Response(JSON.stringify({ task_id: taskId }), { status: 200 }),
      status: async () =>
        new Response(
          JSON.stringify({
            task_id: taskId,
            status: "succeeded",
            result: "I submitted the application successfully.",
          }),
          { status: 200 },
        ),
      trajectory: async () =>
        new Response(JSON.stringify({ task_id: taskId, steps: [] }), {
          status: 200,
        }),
    });

    const adapter = new YutoriBrowsingAdapter("key", {}, fetchMock);
    const result = await adapter.fillAndSubmit(makeInput(), true);

    expect(result.status).toBe("SUBMITTED");
    expect(result.notes).toContain("I submitted the application");
  });

  it("fallback: captcha detected in text → BLOCKED", async () => {
    const taskId = "task-captcha";
    const fetchMock = mockFetch({
      create: async () =>
        new Response(JSON.stringify({ task_id: taskId }), { status: 200 }),
      status: async () =>
        new Response(
          JSON.stringify({
            task_id: taskId,
            status: "failed",
            result: "Page showed a captcha and we could not proceed.",
          }),
          { status: 200 },
        ),
    });

    const adapter = new YutoriBrowsingAdapter("key", {}, fetchMock);
    const result = await adapter.fillAndSubmit(makeInput(), true);

    expect(result.status).toBe("BLOCKED");
  });

  it("HTTP 401 on create — throws (terminal)", async () => {
    const fetchMock = mockFetch({
      create: async () =>
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        }),
    });

    const adapter = new YutoriBrowsingAdapter("key", {}, fetchMock);
    await expect(adapter.fillAndSubmit(makeInput(), true)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalled();
  });

  it("trajectory fetch included in output — screenshots from last 3 steps", async () => {
    const taskId = "task-traj";
    const fetchMock = mockFetch({
      create: async () =>
        new Response(JSON.stringify({ task_id: taskId }), { status: 200 }),
      status: async () =>
        new Response(
          JSON.stringify({
            task_id: taskId,
            status: "succeeded",
            structured_result: { status: "submitted", notes: "OK" },
          }),
          { status: 200 },
        ),
      trajectory: async () =>
        new Response(
          JSON.stringify({
            task_id: taskId,
            steps: [
              { screenshot: "a" },
              { screenshot: "b" },
              { screenshot: "c" },
              { screenshot: "d" },
            ],
          }),
          { status: 200 },
        ),
    });

    const adapter = new YutoriBrowsingAdapter("key", {}, fetchMock);
    const result = await adapter.fillAndSubmit(makeInput(), true);

    expect(result.screenshots).toEqual(["b", "c", "d"]);
  });

  it("submit=false produces task prompt with DO NOT click Submit", async () => {
    const taskId = "task-nosubmit";
    const fetchMock = mockFetch({
      create: async () =>
        new Response(JSON.stringify({ task_id: taskId }), { status: 200 }),
      status: async () =>
        new Response(
          JSON.stringify({
            task_id: taskId,
            status: "succeeded",
            structured_result: { status: "prefilled", notes: "Stopped." },
          }),
          { status: 200 },
        ),
      trajectory: async () =>
        new Response(JSON.stringify({ task_id: taskId, steps: [] }), {
          status: 200,
        }),
    });

    const adapter = new YutoriBrowsingAdapter("key", {}, fetchMock);
    await adapter.fillAndSubmit(makeInput(), false);

    const createCall = (fetchMock as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as string) === `${baseUrl}/tasks`,
    );
    expect(createCall).toBeDefined();
    const init = createCall![1] as RequestInit;
    const parsed = JSON.parse((init.body as string) ?? "{}");
    expect(parsed.task).toContain("DO NOT click Submit");
  });
});
