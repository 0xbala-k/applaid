import { createHash } from "crypto";

// ── Types ──────────────────────────────────────────────────────────────

export type SearchPreferences = {
  title?: string;
  salary_min?: number;
  location?: string;
  remote_ok?: boolean;
  include_keywords?: string[];
  exclude_keywords?: string[];
};

export type TavilySearchResult = {
  title: string;
  url: string;
  content: string;
  score?: number;
};

export type QueryBatchResult = {
  query: string;
  results: TavilySearchResult[];
};

export type RankedResult = {
  title: string;
  url: string;
  content: string;
  score: number;
  sources: string[];
  dedupeHash: string;
};

// ── Constants ──────────────────────────────────────────────────────────

const MIN_QUERIES = 3;
const MAX_QUERIES = 6;
const MULTI_QUERY_BONUS = 0.05;

// ── Query Builder ──────────────────────────────────────────────────────

/**
 * Generates 3–6 diverse Tavily search queries ordered broad → narrow.
 *
 * Layers:
 *  1. Discovery   – title only (maximum recall)
 *  2. Geographic   – title + location / remote
 *  3. Skill-targeted – title + include_keywords
 *  4. Combined     – title + location + keywords
 *  5. Compensation – title + salary + location
 *  6. Precision    – all constraints, with exclusions (minimum recall)
 */
export function buildQueries(prefs: SearchPreferences): string[] {
  const title = prefs.title?.trim();
  if (!title) return [];

  const location = prefs.location?.trim() || null;
  const remote = prefs.remote_ok ?? false;
  const salary = prefs.salary_min ?? null;
  const include = (prefs.include_keywords ?? [])
    .map((k) => k.trim())
    .filter(Boolean);
  const exclude = (prefs.exclude_keywords ?? [])
    .map((k) => k.trim())
    .filter(Boolean);

  const queries: string[] = [];

  // Layer 1 — Discovery (broadest)
  queries.push(`${title} job openings hiring now`);

  // Layer 2 — Location / remote scoped
  if (location && remote) {
    queries.push(`${title} jobs in ${location} OR remote`);
  } else if (location) {
    queries.push(`${title} jobs in ${location}`);
  } else if (remote) {
    queries.push(`${title} remote jobs`);
  }

  // Layer 3 — Skill-targeted
  if (include.length > 0) {
    queries.push(`${title} ${include.slice(0, 4).join(" ")} job postings`);
  }

  // Layer 4 — Location + skills combined
  if ((location || remote) && include.length > 0) {
    const loc = remote
      ? location
        ? `${location} remote`
        : "remote"
      : location!;
    queries.push(`${title} ${include.slice(0, 3).join(" ")} jobs ${loc}`);
  }

  // Layer 5 — Compensation-focused
  if (salary !== null) {
    let q = `${title} jobs salary above $${salary}`;
    if (location) q += ` ${location}`;
    if (remote) q += " remote";
    queries.push(q);
  }

  // Layer 6 — Precision (narrowest, includes exclusions)
  const parts = [title];
  if (include.length > 0) parts.push(include.slice(0, 3).join(" "));
  if (location) parts.push(location);
  if (remote) parts.push("remote");
  if (salary !== null) parts.push(`$${salary}+`);
  if (exclude.length > 0) parts.push(exclude.map((k) => `-${k}`).join(" "));
  queries.push(`${parts.join(" ")} job listing`);

  // Pad to minimum with alternative phrasings
  if (queries.length < MIN_QUERIES) {
    queries.push(`${title} careers opportunities apply`);
  }
  if (queries.length < MIN_QUERIES) {
    queries.push(`hiring ${title} open positions`);
  }

  // Deduplicate and cap at MAX_QUERIES
  return [...new Set(queries)].slice(0, MAX_QUERIES);
}

// ── URL Canonicalization ───────────────────────────────────────────────

function canonicalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.hash = "";

    const toDelete: string[] = [];
    url.searchParams.forEach((_, key) => {
      const lower = key.toLowerCase();
      if (lower.startsWith("utm_") || lower === "ref" || lower === "source") {
        toDelete.push(key);
      }
    });
    for (const key of toDelete) url.searchParams.delete(key);

    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    return url.toString();
  } catch {
    return rawUrl.trim();
  }
}

function computeDedupeHash(canonicalUrl: string): string {
  return createHash("sha256").update(canonicalUrl).digest("hex");
}

// ── Score Helpers ──────────────────────────────────────────────────────

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// ── Merge & Rank ───────────────────────────────────────────────────────

/**
 * Merges results from multiple Tavily query batches into a single
 * deduplicated, ranked list.
 *
 * - Scores are clamped to [0, 1].
 * - Duplicate URLs (after canonicalization) are collapsed; the highest
 *   score across batches is kept.
 * - A small bonus (+0.05 per additional query) rewards results that
 *   appear in multiple queries, capped at 1.0.
 * - Output is sorted descending by score (title as tiebreaker).
 */
export function mergeResults(batches: QueryBatchResult[]): RankedResult[] {
  const map = new Map<
    string,
    {
      title: string;
      url: string;
      content: string;
      bestScore: number;
      sources: string[];
      dedupeHash: string;
    }
  >();

  for (const batch of batches) {
    for (const result of batch.results) {
      if (!result.url) continue;

      const url = canonicalizeUrl(result.url);
      const hash = computeDedupeHash(url);
      const score = clampScore(result.score ?? 0);

      const existing = map.get(hash);
      if (existing) {
        if (score > existing.bestScore) {
          existing.bestScore = score;
          existing.title = result.title || existing.title;
          existing.content = result.content || existing.content;
        }
        if (!existing.sources.includes(batch.query)) {
          existing.sources.push(batch.query);
        }
      } else {
        map.set(hash, {
          title: result.title || "Untitled",
          url,
          content: result.content || "",
          bestScore: score,
          sources: [batch.query],
          dedupeHash: hash,
        });
      }
    }
  }

  const ranked: RankedResult[] = [];
  for (const entry of map.values()) {
    const bonus = MULTI_QUERY_BONUS * (entry.sources.length - 1);
    const finalScore = clampScore(entry.bestScore + bonus);

    ranked.push({
      title: entry.title,
      url: entry.url,
      content: entry.content,
      score: Math.round(finalScore * 1000) / 1000,
      sources: entry.sources,
      dedupeHash: entry.dedupeHash,
    });
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.title.localeCompare(b.title);
  });

  return ranked;
}
