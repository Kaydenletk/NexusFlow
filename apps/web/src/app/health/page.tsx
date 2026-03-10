import { Card } from "@tremor/react";

import { DatasetChartPanel } from "../../components/dataset-chart-panel";
import { RangeTabs } from "../../components/range-tabs";
import { RecentTable } from "../../components/recent-table";
import { fetchHealthMetrics, fetchRecent } from "../../lib/api";
import { formatDate } from "../../lib/format";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const metricTypes = ["steps", "heart_rate"] as const;

export default async function HealthPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const range = typeof params.range === "string" ? params.range : "30d";
  const bucket = typeof params.bucket === "string" ? params.bucket : "day";
  const metricType =
    typeof params.metricType === "string" ? params.metricType : "steps";

  const [series, recent] = await Promise.all([
    fetchHealthMetrics(range, bucket, metricType),
    fetchRecent("health_metrics", 10),
  ]);

  return (
    <>
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
            Health Metrics
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-ink">
            Bring daily signals into the same timeline
          </h2>
        </div>
        <RangeTabs
          basePath="/health"
          active={range}
          extraQuery={`bucket=${bucket}&metricType=${metricType}`}
        />
      </section>
      <div className="flex flex-wrap gap-3">
        {metricTypes.map((metric) => (
          <a
            key={metric}
            href={`/health?range=${range}&bucket=${bucket}&metricType=${metric}`}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              metric === metricType
                ? "border-ink bg-ink text-white"
                : "border-white/70 bg-white/80 text-slate-600 hover:text-aurora"
            }`}
          >
            {metric}
          </a>
        ))}
      </div>
      <DatasetChartPanel
        title={`${metricType} trend`}
        totals={series.points}
        totalsUnit="points"
        breakdownTitle="Same metric, same trend"
        breakdown={[
          {
            name: metricType,
            points: series.points,
          },
        ]}
        valueDisplay="raw"
      />
      {series.latest && (
        <Card className="border-none shadow-panel">
          <p className="text-lg font-semibold text-ink">Latest measurement</p>
          <p className="mt-2 text-sm text-slate-500">
            {series.latest.metricType} = {series.latest.value.toFixed(1)} at{" "}
            {formatDate(series.latest.time)}
          </p>
        </Card>
      )}
      <RecentTable title="Recent health entries" recent={recent} />
    </>
  );
}
