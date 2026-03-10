import type {
  Bucket,
  CodingActivitySeriesResponse,
  Dataset,
  HealthMetricSeriesResponse,
  ImportsResponse,
  ListeningHistorySeriesResponse,
  Range,
  RecentResponse,
  SummaryResponse,
} from "@quantified-self/contracts";
import { getPool } from "@quantified-self/db";

import { getBucketSqlExpression, getRangeWindow } from "../lib/time.js";

function getChangePct(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }

  return Number((((current - previous) / previous) * 100).toFixed(2));
}

type NumericRow = Record<string, number>;

async function singleNumber(query: string, values: unknown[]) {
  const pool = getPool();
  const { rows } = await pool.query<NumericRow>(query, values);
  return Number(rows[0]?.value ?? 0);
}

export async function getSummary(range: Range): Promise<SummaryResponse> {
  const pool = getPool();
  const { start, end, previousStart } = getRangeWindow(range);

  const codingCurrent = await singleNumber(
    "SELECT COALESCE(SUM(duration_seconds), 0) AS value FROM coding_activity WHERE time >= $1 AND time < $2",
    [start, end],
  );
  const codingPrevious = await singleNumber(
    "SELECT COALESCE(SUM(duration_seconds), 0) AS value FROM coding_activity WHERE time >= $1 AND time < $2",
    [previousStart, start],
  );
  const listeningCurrent = await singleNumber(
    "SELECT COALESCE(SUM(duration_ms), 0) AS value FROM listening_history WHERE time >= $1 AND time < $2",
    [start, end],
  );
  const listeningPrevious = await singleNumber(
    "SELECT COALESCE(SUM(duration_ms), 0) AS value FROM listening_history WHERE time >= $1 AND time < $2",
    [previousStart, start],
  );
  const healthCurrent = await singleNumber(
    "SELECT COUNT(*)::float8 AS value FROM health_metrics WHERE time >= $1 AND time < $2",
    [start, end],
  );
  const healthPrevious = await singleNumber(
    "SELECT COUNT(*)::float8 AS value FROM health_metrics WHERE time >= $1 AND time < $2",
    [previousStart, start],
  );

  const codingSessions = await singleNumber(
    "SELECT COUNT(*)::float8 AS value FROM coding_activity WHERE time >= $1 AND time < $2",
    [start, end],
  );
  const listeningTracks = await singleNumber(
    "SELECT COUNT(*)::float8 AS value FROM listening_history WHERE time >= $1 AND time < $2",
    [start, end],
  );

  const [topProjects, topLanguages, topArtists, metricTypes, latestByMetric] =
    await Promise.all([
      pool.query<{ name: string; value: number }>(
        `
          SELECT project AS name, COALESCE(SUM(duration_seconds), 0)::float8 AS value
          FROM coding_activity
          WHERE time >= $1 AND time < $2
          GROUP BY project
          ORDER BY value DESC
          LIMIT 5
        `,
        [start, end],
      ),
      pool.query<{ name: string; value: number }>(
        `
          SELECT language AS name, COALESCE(SUM(duration_seconds), 0)::float8 AS value
          FROM coding_activity
          WHERE time >= $1 AND time < $2
          GROUP BY language
          ORDER BY value DESC
          LIMIT 5
        `,
        [start, end],
      ),
      pool.query<{ name: string; value: number }>(
        `
          SELECT artist AS name, COALESCE(SUM(duration_ms), 0)::float8 AS value
          FROM listening_history
          WHERE time >= $1 AND time < $2
          GROUP BY artist
          ORDER BY value DESC
          LIMIT 5
        `,
        [start, end],
      ),
      pool.query<{ name: string; value: number }>(
        `
          SELECT metric_type AS name, COUNT(*)::float8 AS value
          FROM health_metrics
          WHERE time >= $1 AND time < $2
          GROUP BY metric_type
          ORDER BY value DESC
          LIMIT 5
        `,
        [start, end],
      ),
      pool.query<{ metric_type: string; value: number; time: Date }>(
        `
          SELECT DISTINCT ON (metric_type)
            metric_type,
            value,
            time
          FROM health_metrics
          WHERE time >= $1 AND time < $2
          ORDER BY metric_type, time DESC
        `,
        [start, end],
      ),
    ]);

  return {
    range,
    cards: {
      codingDurationHours: {
        label: "Coding time",
        value: Number((codingCurrent / 3600).toFixed(2)),
        unit: "hours",
        changePct: getChangePct(codingCurrent, codingPrevious),
      },
      listeningHours: {
        label: "Listening time",
        value: Number((listeningCurrent / 3_600_000).toFixed(2)),
        unit: "hours",
        changePct: getChangePct(listeningCurrent, listeningPrevious),
      },
      healthEntries: {
        label: "Health entries",
        value: healthCurrent,
        unit: "entries",
        changePct: getChangePct(healthCurrent, healthPrevious),
      },
    },
    coding: {
      sessionCount: codingSessions,
      topProjects: topProjects.rows.map((row) => ({
        name: row.name,
        value: row.value,
      })),
      topLanguages: topLanguages.rows.map((row) => ({
        name: row.name,
        value: row.value,
      })),
    },
    listening: {
      trackCount: listeningTracks,
      topArtists: topArtists.rows.map((row) => ({
        name: row.name,
        value: row.value,
      })),
    },
    health: {
      metricTypes: metricTypes.rows.map((row) => ({
        name: row.name,
        value: row.value,
      })),
      latestByMetric: latestByMetric.rows.map((row) => ({
        metricType: row.metric_type,
        value: row.value,
        time: row.time.toISOString(),
      })),
    },
  };
}

export async function getCodingActivitySeries(
  range: Range,
  bucket: Bucket,
): Promise<CodingActivitySeriesResponse> {
  const pool = getPool();
  const { start, end } = getRangeWindow(range);
  const bucketExpression = getBucketSqlExpression(bucket);

  const totals = await pool.query<{ bucket: Date; value: number }>(
    `
      SELECT ${bucketExpression} AS bucket, SUM(total_duration_seconds)::float8 AS value
      FROM coding_activity_daily
      WHERE bucket >= $1 AND bucket < $2
      GROUP BY 1
      ORDER BY 1
    `,
    [start, end],
  );

  const topLanguages = await pool.query<{
    name: string;
    bucket: Date;
    value: number;
  }>(
    `
      WITH ranked_languages AS (
        SELECT language AS name, SUM(total_duration_seconds) AS total
        FROM coding_activity_daily
        WHERE bucket >= $1 AND bucket < $2
        GROUP BY language
        ORDER BY total DESC
        LIMIT 3
      )
      SELECT d.language AS name, ${bucketExpression} AS bucket, SUM(d.total_duration_seconds)::float8 AS value
      FROM coding_activity_daily d
      INNER JOIN ranked_languages r ON r.name = d.language
      WHERE d.bucket >= $1 AND d.bucket < $2
      GROUP BY d.language, 2
      ORDER BY d.language, 2
    `,
    [start, end],
  );

  const topProjects = await pool.query<{
    name: string;
    bucket: Date;
    value: number;
  }>(
    `
      WITH ranked_projects AS (
        SELECT project AS name, SUM(total_duration_seconds) AS total
        FROM coding_activity_daily
        WHERE bucket >= $1 AND bucket < $2
        GROUP BY project
        ORDER BY total DESC
        LIMIT 3
      )
      SELECT d.project AS name, ${bucketExpression} AS bucket, SUM(d.total_duration_seconds)::float8 AS value
      FROM coding_activity_daily d
      INNER JOIN ranked_projects r ON r.name = d.project
      WHERE d.bucket >= $1 AND d.bucket < $2
      GROUP BY d.project, 2
      ORDER BY d.project, 2
    `,
    [start, end],
  );

  return {
    range,
    bucket,
    totals: totals.rows.map((row) => ({
      bucket: row.bucket.toISOString(),
      value: row.value,
    })),
    topLanguages: groupSeriesByName(topLanguages.rows),
    topProjects: groupSeriesByName(topProjects.rows),
  };
}

export async function getListeningHistorySeries(
  range: Range,
  bucket: Bucket,
): Promise<ListeningHistorySeriesResponse> {
  const pool = getPool();
  const { start, end } = getRangeWindow(range);
  const bucketExpression = getBucketSqlExpression(bucket);

  const totals = await pool.query<{ bucket: Date; value: number }>(
    `
      SELECT ${bucketExpression} AS bucket, SUM(total_duration_ms)::float8 AS value
      FROM listening_history_daily
      WHERE bucket >= $1 AND bucket < $2
      GROUP BY 1
      ORDER BY 1
    `,
    [start, end],
  );

  const topArtists = await pool.query<{
    name: string;
    bucket: Date;
    value: number;
  }>(
    `
      WITH ranked_artists AS (
        SELECT artist AS name, SUM(total_duration_ms) AS total
        FROM listening_history_daily
        WHERE bucket >= $1 AND bucket < $2
        GROUP BY artist
        ORDER BY total DESC
        LIMIT 3
      )
      SELECT d.artist AS name, ${bucketExpression} AS bucket, SUM(d.total_duration_ms)::float8 AS value
      FROM listening_history_daily d
      INNER JOIN ranked_artists r ON r.name = d.artist
      WHERE d.bucket >= $1 AND d.bucket < $2
      GROUP BY d.artist, 2
      ORDER BY d.artist, 2
    `,
    [start, end],
  );

  return {
    range,
    bucket,
    totals: totals.rows.map((row) => ({
      bucket: row.bucket.toISOString(),
      value: row.value,
    })),
    topArtists: groupSeriesByName(topArtists.rows),
  };
}

export async function getHealthMetricSeries(
  range: Range,
  bucket: Bucket,
  metricType: string,
): Promise<HealthMetricSeriesResponse> {
  const pool = getPool();
  const { start, end } = getRangeWindow(range);
  const bucketExpression = getBucketSqlExpression(bucket);

  const [points, latest] = await Promise.all([
    pool.query<{ bucket: Date; value: number }>(
      `
        SELECT ${bucketExpression} AS bucket, AVG(average_value)::float8 AS value
        FROM health_metrics_daily
        WHERE bucket >= $1 AND bucket < $2 AND metric_type = $3
        GROUP BY 1
        ORDER BY 1
      `,
      [start, end, metricType],
    ),
    pool.query<{ metric_type: string; value: number; time: Date }>(
      `
        SELECT metric_type, value, time
        FROM health_metrics
        WHERE time >= $1 AND time < $2 AND metric_type = $3
        ORDER BY time DESC
        LIMIT 1
      `,
      [start, end, metricType],
    ),
  ]);

  return {
    range,
    bucket,
    metricType,
    points: points.rows.map((row) => ({
      bucket: row.bucket.toISOString(),
      value: row.value,
    })),
    latest: latest.rows[0]
      ? {
          metricType: latest.rows[0].metric_type,
          value: latest.rows[0].value,
          time: latest.rows[0].time.toISOString(),
        }
      : null,
  };
}

type SeriesRow = {
  name: string;
  bucket: Date;
  value: number;
};

function groupSeriesByName(rows: SeriesRow[]) {
  const grouped = new Map<string, Array<{ bucket: string; value: number }>>();

  for (const row of rows) {
    const points = grouped.get(row.name) ?? [];
    points.push({
      bucket: row.bucket.toISOString(),
      value: row.value,
    });
    grouped.set(row.name, points);
  }

  return Array.from(grouped.entries()).map(([name, points]) => ({
    name,
    points,
  }));
}

export async function getRecentItems(
  dataset: Dataset,
  limit: number,
): Promise<RecentResponse> {
  const pool = getPool();

  const queries = {
    coding_activity: `
      SELECT id::int AS id, time, project, language, duration_seconds AS "durationSeconds",
             source, import_batch_id AS "importBatchId", created_at AS "createdAt"
      FROM coding_activity
      ORDER BY time DESC
      LIMIT $1
    `,
    listening_history: `
      SELECT id::int AS id, time, track_name AS "trackName", artist, duration_ms AS "durationMs",
             source, import_batch_id AS "importBatchId", created_at AS "createdAt"
      FROM listening_history
      ORDER BY time DESC
      LIMIT $1
    `,
    health_metrics: `
      SELECT id::int AS id, time, metric_type AS "metricType", value,
             source, import_batch_id AS "importBatchId", created_at AS "createdAt"
      FROM health_metrics
      ORDER BY time DESC
      LIMIT $1
    `,
  } as const;

  const { rows } = await pool.query<Record<string, unknown>>(queries[dataset], [
    limit,
  ]);

  return {
    dataset,
    items: rows.map((row) => ({
      ...row,
      time: (row.time as Date).toISOString(),
      createdAt: (row.createdAt as Date).toISOString(),
    })) as RecentResponse["items"],
  };
}

export async function getImportBatches(limit: number): Promise<ImportsResponse> {
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    dataset: Dataset;
    source: "manual" | "csv";
    filename: string | null;
    status: "completed" | "failed";
    rowsReceived: number;
    rowsInserted: number;
    rowsSkipped: number;
    errorSummary: string | null;
    createdAt: Date;
  }>(
    `
      SELECT
        id,
        dataset,
        source,
        filename,
        status,
        rows_received AS "rowsReceived",
        rows_inserted AS "rowsInserted",
        rows_skipped AS "rowsSkipped",
        error_summary AS "errorSummary",
        created_at AS "createdAt"
      FROM import_batches
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return {
    items: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
