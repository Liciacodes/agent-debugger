export function formatDuration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

export function formatTokens(tokens: number | null): string {
  if (tokens === null) return "tokens unknown";
  return tokens < 1000
    ? `${tokens} tokens`
    : `${(tokens / 1000).toFixed(1)}k tokens`;
}

export function countLabel(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}
