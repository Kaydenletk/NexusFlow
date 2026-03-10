import { Card } from "@tremor/react";

import { HeatmapCalendar } from "../components/heatmap-calendar";
import { MetricCardGrid } from "../components/metric-card-grid";
import { OverviewCharts } from "../components/overview-charts";
import { RangeTabs } from "../components/range-tabs";
import { StreakCounter } from "../components/streak-counter";
import {
  fetchCodingActivity,
  fetchHeatmap,
  fetchHealthMetrics,
  fetchStreaks,
  fetchSummary,
  fetchListeningHistory,
} from "../lib/api";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const range = typeof params.range === "string" ? params.range : "30d";

  const [summary, codingSeries, listeningSeries, healthSeries, heatmap, streaks] =
    await Promise.all([
      fetchSummary(range),
      fetchCodingActivity(range, "day"),
      fetchListeningHistory(range, "day"),
      fetchHealthMetrics(range, "day", "steps"),
      fetchHeatmap(),
      fetchStreaks(),
    ]);

  return (
    <>
      <section className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
              Overview
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-ink">
              The first readable layer of your student-life rhythm
            </h2>
          </div>
          <RangeTabs basePath="/" active={range} />
        </div>
        <MetricCardGrid cards={summary.cards} />
      </section>

      <OverviewCharts
        summary={summary}
        codingSeries={codingSeries}
        listeningSeries={listeningSeries}
        healthSeries={healthSeries}
      />

      <section className="space-y-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
            Activity Rhythm
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-ink">
            Daily consistency comes into focus once the signal is real
          </h3>
        </div>
        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <HeatmapCalendar heatmap={heatmap} />
          <StreakCounter streaks={streaks} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="border-none shadow-panel">
          <p className="text-lg font-semibold text-ink">Coding focus</p>
          <p className="mt-2 text-sm text-slate-500">
            {summary.coding.sessionCount} sessions logged in the selected window.
          </p>
        </Card>
        <Card className="border-none shadow-panel">
          <p className="text-lg font-semibold text-ink">Listening mood</p>
          <p className="mt-2 text-sm text-slate-500">
            {summary.listening.trackCount} tracks registered across your latest
            listening history.
          </p>
        </Card>
        <Card className="border-none shadow-panel">
          <p className="text-lg font-semibold text-ink">Health signal</p>
          <p className="mt-2 text-sm text-slate-500">
            {summary.health.latestByMetric.length} tracked metrics with recent
            updates are available for review.
          </p>
        </Card>
      </section>
    </>
  );
}
