import { describe, it, expect } from "vitest";
import {
  buildQueries,
  mergeResults,
  type SearchPreferences,
  type QueryBatchResult,
} from "./query_builder";

// ── buildQueries ───────────────────────────────────────────────────────

describe("buildQueries", () => {
  it("returns empty array when no title is provided", () => {
    expect(buildQueries({})).toEqual([]);
    expect(buildQueries({ title: "" })).toEqual([]);
    expect(buildQueries({ title: "   " })).toEqual([]);
  });

  it("returns 3–6 queries for title-only input", () => {
    const q = buildQueries({ title: "Software Engineer" });
    expect(q.length).toBeGreaterThanOrEqual(3);
    expect(q.length).toBeLessThanOrEqual(6);
  });

  it("puts broadest discovery query first", () => {
    const q = buildQueries({ title: "Data Scientist" });
    expect(q[0]).toBe("Data Scientist job openings hiring now");
  });

  it("generates location-scoped query", () => {
    const q = buildQueries({ title: "Designer", location: "New York" });
    expect(q.some((s) => s.includes("New York"))).toBe(true);
  });

  it("generates remote-scoped query", () => {
    const q = buildQueries({ title: "Engineer", remote_ok: true });
    expect(q.some((s) => s.includes("remote"))).toBe(true);
  });

  it("generates combined location+remote query", () => {
    const q = buildQueries({
      title: "Engineer",
      location: "Austin",
      remote_ok: true,
    });
    expect(q).toContain("Engineer jobs in Austin OR remote");
  });

  it("includes keywords in skill-targeted query", () => {
    const q = buildQueries({
      title: "Engineer",
      include_keywords: ["React", "TypeScript"],
    });
    expect(
      q.some((s) => s.includes("React") && s.includes("TypeScript")),
    ).toBe(true);
  });

  it("limits keywords to first 4 in skill-targeted query", () => {
    const q = buildQueries({
      title: "Dev",
      include_keywords: ["A", "B", "C", "D", "E"],
    });
    const skillQuery = q.find((s) => s.includes("job postings"))!;
    expect(skillQuery).toContain("A B C D");
    expect(skillQuery).not.toContain("E");
  });

  it("includes salary in compensation query", () => {
    const q = buildQueries({ title: "Engineer", salary_min: 120000 });
    expect(q.some((s) => s.includes("$120000"))).toBe(true);
  });

  it("includes exclusions in the narrowest query", () => {
    const q = buildQueries({
      title: "Engineer",
      location: "SF",
      include_keywords: ["Go"],
      exclude_keywords: ["Java", "PHP"],
    });
    const last = q[q.length - 1];
    expect(last).toContain("-Java");
    expect(last).toContain("-PHP");
  });

  it("returns at most 6 queries", () => {
    const q = buildQueries({
      title: "Full Stack Developer",
      location: "London",
      remote_ok: true,
      salary_min: 100000,
      include_keywords: ["React", "Node.js", "PostgreSQL", "Docker"],
      exclude_keywords: ["PHP", "WordPress"],
    });
    expect(q.length).toBeLessThanOrEqual(6);
  });

  it("never contains duplicates", () => {
    const q = buildQueries({
      title: "Engineer",
      location: "LA",
      include_keywords: ["Python"],
    });
    expect(new Set(q).size).toBe(q.length);
  });

  it("orders queries broad → narrow", () => {
    const q = buildQueries({
      title: "Backend Engineer",
      location: "Berlin",
      remote_ok: true,
      salary_min: 90000,
      include_keywords: ["Rust", "Go"],
      exclude_keywords: ["Java"],
    });
    expect(q[0]).toBe("Backend Engineer job openings hiring now");
    expect(q[q.length - 1]).toContain("-Java");
  });

  it("pads to minimum 3 queries for sparse input", () => {
    const q = buildQueries({ title: "Intern" });
    expect(q.length).toBeGreaterThanOrEqual(3);
    // Should include filler phrasings
    expect(q.some((s) => s.includes("careers") || s.includes("hiring"))).toBe(
      true,
    );
  });
});

// ── mergeResults ───────────────────────────────────────────────────────

describe("mergeResults", () => {
  it("returns empty array for empty input", () => {
    expect(mergeResults([])).toEqual([]);
  });

  it("returns empty array for batches with no results", () => {
    expect(mergeResults([{ query: "q1", results: [] }])).toEqual([]);
  });

  it("clamps scores to [0, 1]", () => {
    const results = mergeResults([
      {
        query: "q1",
        results: [
          {
            title: "Over",
            url: "https://a.com/over",
            content: "",
            score: 1.5,
          },
          {
            title: "Under",
            url: "https://a.com/under",
            content: "",
            score: -0.3,
          },
          {
            title: "Normal",
            url: "https://a.com/norm",
            content: "",
            score: 0.7,
          },
        ],
      },
    ]);

    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });

  it("deduplicates by canonical URL (strips UTM params)", () => {
    const results = mergeResults([
      {
        query: "q1",
        results: [
          {
            title: "Job",
            url: "https://example.com/job?utm_source=google",
            content: "a",
            score: 0.8,
          },
        ],
      },
      {
        query: "q2",
        results: [
          {
            title: "Job",
            url: "https://example.com/job?utm_campaign=test",
            content: "b",
            score: 0.6,
          },
        ],
      },
    ]);
    expect(results).toHaveLength(1);
  });

  it("keeps highest score when merging duplicates", () => {
    const results = mergeResults([
      {
        query: "q1",
        results: [
          {
            title: "Job",
            url: "https://a.com/j",
            content: "a",
            score: 0.6,
          },
        ],
      },
      {
        query: "q2",
        results: [
          {
            title: "Job",
            url: "https://a.com/j",
            content: "b",
            score: 0.85,
          },
        ],
      },
    ]);
    // bestScore = 0.85, bonus = 0.05 * 1 = 0.05, total = 0.9
    expect(results[0].score).toBe(0.9);
  });

  it("applies multi-query bonus (+0.05 per extra appearance)", () => {
    const results = mergeResults([
      {
        query: "q1",
        results: [
          { title: "J", url: "https://a.com/1", content: "", score: 0.7 },
        ],
      },
      {
        query: "q2",
        results: [
          { title: "J", url: "https://a.com/1", content: "", score: 0.7 },
        ],
      },
      {
        query: "q3",
        results: [
          { title: "J", url: "https://a.com/1", content: "", score: 0.7 },
        ],
      },
    ]);
    expect(results).toHaveLength(1);
    // 0.7 + 0.05 * 2 = 0.8
    expect(results[0].score).toBe(0.8);
    expect(results[0].sources).toHaveLength(3);
  });

  it("caps boosted score at 1.0", () => {
    const results = mergeResults([
      {
        query: "q1",
        results: [
          { title: "J", url: "https://x.com/1", content: "", score: 0.98 },
        ],
      },
      {
        query: "q2",
        results: [
          { title: "J", url: "https://x.com/1", content: "", score: 0.95 },
        ],
      },
      {
        query: "q3",
        results: [
          { title: "J", url: "https://x.com/1", content: "", score: 0.96 },
        ],
      },
    ]);
    expect(results[0].score).toBe(1);
  });

  it("sorts results descending by score", () => {
    const results = mergeResults([
      {
        query: "q1",
        results: [
          {
            title: "Low",
            url: "https://a.com/low",
            content: "",
            score: 0.3,
          },
          {
            title: "High",
            url: "https://a.com/high",
            content: "",
            score: 0.9,
          },
          {
            title: "Mid",
            url: "https://a.com/mid",
            content: "",
            score: 0.6,
          },
        ],
      },
    ]);
    expect(results.map((r) => r.title)).toEqual(["High", "Mid", "Low"]);
  });

  it("uses title as stable tiebreaker", () => {
    const results = mergeResults([
      {
        query: "q1",
        results: [
          {
            title: "Zebra Co",
            url: "https://z.com/1",
            content: "",
            score: 0.5,
          },
          {
            title: "Alpha Corp",
            url: "https://a.com/1",
            content: "",
            score: 0.5,
          },
        ],
      },
    ]);
    expect(results[0].title).toBe("Alpha Corp");
    expect(results[1].title).toBe("Zebra Co");
  });

  it("tracks which queries produced each result", () => {
    const results = mergeResults([
      {
        query: "broad",
        results: [
          { title: "J", url: "https://x.com/1", content: "", score: 0.8 },
        ],
      },
      {
        query: "narrow",
        results: [
          { title: "J", url: "https://x.com/1", content: "", score: 0.7 },
        ],
      },
    ]);
    expect(results[0].sources).toEqual(["broad", "narrow"]);
  });

  it("includes a 64-char SHA-256 dedupeHash", () => {
    const results = mergeResults([
      {
        query: "q1",
        results: [
          {
            title: "Job",
            url: "https://example.com/j",
            content: "",
            score: 0.5,
          },
        ],
      },
    ]);
    expect(results[0].dedupeHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("treats missing score as 0", () => {
    const results = mergeResults([
      {
        query: "q1",
        results: [
          { title: "No Score", url: "https://a.com/ns", content: "" },
          {
            title: "Has Score",
            url: "https://a.com/hs",
            content: "",
            score: 0.8,
          },
        ],
      },
    ]);
    const ns = results.find((r) => r.title === "No Score");
    expect(ns!.score).toBe(0);
  });

  it("skips results with empty URL", () => {
    const results = mergeResults([
      {
        query: "q1",
        results: [
          { title: "No URL", url: "", content: "", score: 0.9 },
          {
            title: "Has URL",
            url: "https://a.com/x",
            content: "",
            score: 0.5,
          },
        ],
      },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Has URL");
  });

  it("handles large merge across many batches", () => {
    const batches: QueryBatchResult[] = Array.from({ length: 6 }, (_, i) => ({
      query: `q${i}`,
      results: Array.from({ length: 20 }, (_, j) => ({
        title: `Job ${j}`,
        url: `https://jobs.com/${j}`,
        content: `Description ${j}`,
        score: 0.5 + j * 0.02,
      })),
    }));
    const results = mergeResults(batches);

    // All 20 unique URLs, each appearing in 6 batches
    expect(results).toHaveLength(20);
    // First result should have highest base score (0.88) + bonus (0.05 * 5 = 0.25) → capped at 1.0
    expect(results[0].score).toBe(1);
    expect(results[0].sources).toHaveLength(6);
  });
});
