import { randomUUID } from "node:crypto";

import type {
  Goal,
  GoalMetric,
  GoalPeriod,
  GoalProgress,
  GoalsProgressResponse,
  GoalsResponse,
} from "@quantified-self/contracts";
import { goalMetricCatalog } from "@quantified-self/contracts";
import { getDb, getPool, goals } from "@quantified-self/db";
import { eq } from "drizzle-orm";

import { env } from "../env.js";
import { AppError } from "../lib/errors.js";

function ensureMetricMatchesDataset(dataset: Goal["dataset"], metric: GoalMetric) {
  const allowed = goalMetricCatalog[dataset] as readonly string[];

  if (!allowed.includes(metric)) {
    throw new AppError(
      400,
      "INVALID_GOAL_METRIC",
      `Metric ${metric} is not valid for dataset ${dataset}`,
    );
  }
}

function toGoal(row: {
  id: string;
  dataset: Goal["dataset"];
  metric: GoalMetric;
  targetValue: number;
  period: GoalPeriod;
  createdAt: Date;
  updatedAt: Date;
}): Goal {
  return {
    id: row.id,
    dataset: row.dataset,
    metric: row.metric,
    targetValue: row.targetValue,
    period: row.period,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getPeriodWindow(period: GoalPeriod) {
  const pool = getPool();
  const truncated = period === "day" ? "day" : "week";
  const interval = period === "day" ? "1 day" : "1 week";
  const { rows } = await pool.query<{ start_at: Date; end_at: Date }>(
    `
      SELECT
        (date_trunc('${truncated}', timezone($1, now())) AT TIME ZONE $1) AS start_at,
        ((date_trunc('${truncated}', timezone($1, now())) + INTERVAL '${interval}') AT TIME ZONE $1) AS end_at
    `,
    [env.APP_TIMEZONE],
  );

  return {
    start: rows[0]?.start_at ?? new Date(),
    end: rows[0]?.end_at ?? new Date(),
  };
}

async function getGoalActualValue(goal: Goal) {
  const pool = getPool();
  const { start, end } = await getPeriodWindow(goal.period);

  switch (goal.metric) {
    case "coding_hours": {
      const { rows } = await pool.query<{ value: number }>(
        "SELECT COALESCE(SUM(duration_seconds), 0)::float8 / 3600 AS value FROM coding_activity WHERE time >= $1 AND time < $2",
        [start, end],
      );
      return Number(rows[0]?.value ?? 0);
    }
    case "coding_sessions": {
      const { rows } = await pool.query<{ value: number }>(
        "SELECT COUNT(*)::float8 AS value FROM coding_activity WHERE time >= $1 AND time < $2",
        [start, end],
      );
      return Number(rows[0]?.value ?? 0);
    }
    case "listening_hours": {
      const { rows } = await pool.query<{ value: number }>(
        "SELECT COALESCE(SUM(duration_ms), 0)::float8 / 3600000 AS value FROM listening_history WHERE time >= $1 AND time < $2",
        [start, end],
      );
      return Number(rows[0]?.value ?? 0);
    }
    case "track_count": {
      const { rows } = await pool.query<{ value: number }>(
        "SELECT COUNT(*)::float8 AS value FROM listening_history WHERE time >= $1 AND time < $2",
        [start, end],
      );
      return Number(rows[0]?.value ?? 0);
    }
    case "steps_total": {
      const { rows } = await pool.query<{ value: number }>(
        "SELECT COALESCE(SUM(value), 0)::float8 AS value FROM health_metrics WHERE metric_type = 'steps' AND time >= $1 AND time < $2",
        [start, end],
      );
      return Number(rows[0]?.value ?? 0);
    }
    case "health_entry_count": {
      const { rows } = await pool.query<{ value: number }>(
        "SELECT COUNT(*)::float8 AS value FROM health_metrics WHERE time >= $1 AND time < $2",
        [start, end],
      );
      return Number(rows[0]?.value ?? 0);
    }
    case "heart_rate_avg": {
      const { rows } = await pool.query<{ value: number }>(
        "SELECT COALESCE(AVG(value), 0)::float8 AS value FROM health_metrics WHERE metric_type = 'heart_rate' AND time >= $1 AND time < $2",
        [start, end],
      );
      return Number(rows[0]?.value ?? 0);
    }
  }
}

function toGoalProgress(goal: Goal, actualValue: number): GoalProgress {
  const percentComplete = Math.min(
    Number(((actualValue / goal.targetValue) * 100).toFixed(2)),
    100,
  );
  const remainingValue = Math.max(
    Number((goal.targetValue - actualValue).toFixed(2)),
    0,
  );

  return {
    goal,
    actualValue: Number(actualValue.toFixed(2)),
    remainingValue,
    percentComplete: Number.isFinite(percentComplete) ? percentComplete : 0,
    isComplete: actualValue >= goal.targetValue,
  };
}

export async function getGoals(): Promise<GoalsResponse> {
  const db = getDb();
  const rows = await db.select().from(goals);

  return {
    items: rows.map((row) => toGoal(row as never)),
  };
}

export async function createGoal(input: Omit<Goal, "id" | "createdAt" | "updatedAt">) {
  ensureMetricMatchesDataset(input.dataset, input.metric);
  const db = getDb();
  const now = new Date();
  const [row] = await db
    .insert(goals)
    .values({
      id: randomUUID(),
      dataset: input.dataset,
      metric: input.metric,
      targetValue: input.targetValue,
      period: input.period,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return toGoal(row as never);
}

export async function updateGoal(
  id: string,
  input: Omit<Goal, "id" | "createdAt" | "updatedAt">,
) {
  ensureMetricMatchesDataset(input.dataset, input.metric);
  const db = getDb();
  const [row] = await db
    .update(goals)
    .set({
      dataset: input.dataset,
      metric: input.metric,
      targetValue: input.targetValue,
      period: input.period,
      updatedAt: new Date(),
    })
    .where(eq(goals.id, id))
    .returning();

  if (!row) {
    throw new AppError(404, "GOAL_NOT_FOUND", "Goal not found");
  }

  return toGoal(row as never);
}

export async function deleteGoal(id: string) {
  const db = getDb();

  await db.delete(goals).where(eq(goals.id, id));
}

export async function getGoalProgress(
  dataset?: Goal["dataset"],
): Promise<GoalsProgressResponse> {
  const allGoals = await getGoals();
  const filteredGoals = dataset
    ? allGoals.items.filter((goal) => goal.dataset === dataset)
    : allGoals.items;

  const items = await Promise.all(
    filteredGoals.map(async (goal) =>
      toGoalProgress(goal, await getGoalActualValue(goal)),
    ),
  );

  return { items };
}
