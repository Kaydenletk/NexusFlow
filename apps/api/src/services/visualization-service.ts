import type {
  CodingStreaksResponse,
  HeatmapResponse,
} from "@quantified-self/contracts";
import { getPool } from "@quantified-self/db";

import { env } from "../env.js";
import { addDays, formatDateKey } from "../lib/time.js";

type DayTotalRow = {
  date_key: string;
  value_seconds: number;
};

function quartile(sortedValues: number[], percentile: number) {
  if (sortedValues.length === 0) {
    return 0;
  }

  const index = Math.max(
    0,
    Math.min(
      sortedValues.length - 1,
      Math.ceil(sortedValues.length * percentile) - 1,
    ),
  );

  return sortedValues[index] ?? 0;
}

function getIntensity(valueSeconds: number, thresholds: number[]) {
  if (valueSeconds <= 0) {
    return 0;
  }

  if (valueSeconds <= (thresholds[0] ?? 0)) {
    return 1;
  }

  if (valueSeconds <= (thresholds[1] ?? 0)) {
    return 2;
  }

  if (valueSeconds <= (thresholds[2] ?? 0)) {
    return 3;
  }

  return 4;
}

async function getCodingDailyTotals() {
  const pool = getPool();
  const { rows } = await pool.query<DayTotalRow>(
    `
      SELECT
        to_char(bucket::date, 'YYYY-MM-DD') AS date_key,
        COALESCE(SUM(total_duration_seconds), 0)::float8 AS value_seconds
      FROM coding_activity_daily
      WHERE bucket >= ((date_trunc('day', timezone($1, now())) - INTERVAL '364 days') AT TIME ZONE $1)
        AND bucket < ((date_trunc('day', timezone($1, now())) + INTERVAL '1 day') AT TIME ZONE $1)
      GROUP BY 1
      ORDER BY 1
    `,
    [env.APP_TIMEZONE],
  );

  return rows.map((row) => ({
    dateKey: row.date_key,
    valueSeconds: Number(row.value_seconds ?? 0),
  }));
}

export async function getCodingHeatmap(): Promise<HeatmapResponse> {
  const totals = await getCodingDailyTotals();
  const totalsByDate = new Map(totals.map((item) => [item.dateKey, item.valueSeconds]));
  const nonZeroValues = totals
    .map((item) => item.valueSeconds)
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  const thresholds = [
    quartile(nonZeroValues, 0.25),
    quartile(nonZeroValues, 0.5),
    quartile(nonZeroValues, 0.75),
  ];
  const today = new Date();
  const start = addDays(today, -364);

  return {
    range: "365d",
    items: Array.from({ length: 365 }, (_, index) => {
      const current = addDays(start, index);
      const date = formatDateKey(current, env.APP_TIMEZONE);
      const valueSeconds = totalsByDate.get(date) ?? 0;

      return {
        date,
        valueSeconds,
        intensity: getIntensity(valueSeconds, thresholds),
      };
    }),
  };
}

export async function getCodingStreaks(): Promise<CodingStreaksResponse> {
  const heatmap = await getCodingHeatmap();
  let currentStreak = 0;
  let longestStreak = 0;
  let running = 0;
  let lastActiveDate: string | null = null;

  for (const item of heatmap.items) {
    if (item.valueSeconds > 0) {
      running += 1;
      longestStreak = Math.max(longestStreak, running);
      lastActiveDate = item.date;
    } else {
      running = 0;
    }
  }

  for (let index = heatmap.items.length - 1; index >= 0; index -= 1) {
    const item = heatmap.items[index];
    if (!item) {
      continue;
    }

    if (item.valueSeconds > 0) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  return {
    currentStreak,
    longestStreak,
    lastActiveDate,
  };
}
