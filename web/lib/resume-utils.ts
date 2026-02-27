const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "have", "your", "you",
  "are", "our", "will", "about", "into", "more", "such", "than", "also", "them",
  "they", "over", "were", "been", "their", "what", "when", "where", "while",
  "which", "would", "there",
]);

export function extractKeywords(text: string, limit = 32): string[] {
  const words = text.toLowerCase().match(/[a-z][a-z0-9]+/g) ?? [];
  const counts = new Map<string, number>();

  for (const word of words) {
    if (word.length < 4 || STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}
