export function formatDurationHours(seconds: number) {
  return `${(seconds / 3600).toFixed(1)}h`;
}

export function formatListeningHours(milliseconds: number) {
  return `${(milliseconds / 3_600_000).toFixed(1)}h`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
