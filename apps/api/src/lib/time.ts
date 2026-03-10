import type { Bucket, Range } from "@quantified-self/contracts";

const dayMs = 86_400_000;

export function getRangeDays(range: Range) {
  switch (range) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
  }
}

export function getRangeWindow(range: Range) {
  const end = new Date();
  const days = getRangeDays(range);
  const start = new Date(end.getTime() - days * dayMs);
  const previousStart = new Date(start.getTime() - days * dayMs);

  return { start, end, previousStart };
}

export function getBucketSqlExpression(bucket: Bucket, column = "bucket") {
  if (bucket === "day") {
    return column;
  }

  return `date_trunc('week', ${column})`;
}

export function expandRefreshEnd(maxTime: Date) {
  return new Date(maxTime.getTime() + dayMs);
}

export function toIso(value: Date | string) {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

export function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * dayMs);
}

export function startOfUtcDay(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

export function formatDateKey(value: Date | string, timeZone = "UTC") {
  const date = value instanceof Date ? value : new Date(value);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}
