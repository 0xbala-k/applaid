/**
 * In-memory per-domain rate limiter.
 *
 * Tracks the last request timestamp for each domain and enforces a
 * minimum interval between consecutive requests to the same domain.
 */
export class DomainThrottle {
  private readonly lastRequestByDomain = new Map<string, number>();
  private readonly minIntervalMs: number;

  constructor(minIntervalMs: number) {
    this.minIntervalMs = minIntervalMs;
  }

  /**
   * Known ATS root domains — subdomains are collapsed to these.
   * e.g. boards.greenhouse.io → greenhouse.io
   */
  private static readonly ATS_ROOTS = [
    "greenhouse.io",
    "lever.co",
    "myworkdayjobs.com",
    "smartrecruiters.com",
    "ashbyhq.com",
    "icims.com",
    "jobvite.com",
    "breezy.hr",
  ];

  /**
   * Extract the effective domain from a URL.
   * Known ATS subdomains are collapsed to their root.
   */
  extractDomain(url: string): string {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      for (const root of DomainThrottle.ATS_ROOTS) {
        if (hostname === root || hostname.endsWith(`.${root}`)) {
          return root;
        }
      }
      return hostname;
    } catch {
      return "unknown";
    }
  }

  /**
   * Returns milliseconds to wait before the next request to this
   * domain.  Returns 0 if no wait is needed.
   */
  getWaitMs(domain: string, now: number = Date.now()): number {
    const last = this.lastRequestByDomain.get(domain);
    if (last === undefined) return 0;
    return Math.max(0, this.minIntervalMs - (now - last));
  }

  /** Record that a request was just made to a domain. */
  recordRequest(domain: string, now: number = Date.now()): void {
    this.lastRequestByDomain.set(domain, now);
  }

  /**
   * Wait if necessary, then record the request.
   * Returns the domain and how long the caller waited.
   */
  async throttle(url: string): Promise<{ domain: string; waitedMs: number }> {
    const domain = this.extractDomain(url);
    const waitMs = this.getWaitMs(domain);
    if (waitMs > 0) {
      await this.sleep(waitMs);
    }
    this.recordRequest(domain);
    return { domain, waitedMs: waitMs };
  }

  /** Overridable for testing — avoids real timers in unit tests. */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
