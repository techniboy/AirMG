export function formatMinutes(mins: number | null): string {
  if (mins === null) return '--';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatScore(score: number | null, decimals = 0): string {
  if (score === null) return '--';
  return score.toFixed(decimals);
}

export function formatPercent(value: number | null): string {
  if (value === null) return '--';
  return `${Math.round(value * 100)}%`;
}
