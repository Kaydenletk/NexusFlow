"use client";

import { AreaChart, Card, LineChart } from "@tremor/react";

import { formatShortDate } from "../lib/format";

type Point = {
  bucket: string;
  value: number;
};

type Series = {
  name: string;
  points: Point[];
};

type Props = {
  title: string;
  totals: Point[];
  totalsUnit: string;
  breakdownTitle: string;
  breakdown: Series[];
  valueDisplay: "hours" | "minutes" | "raw";
};

function normalizeSeries(series: Series[], valueDisplay: Props["valueDisplay"]) {
  const buckets = new Map<string, Record<string, string | number>>();

  for (const item of series) {
    for (const point of item.points) {
      const row = buckets.get(point.bucket) ?? {
        bucket: formatShortDate(point.bucket),
      };
      row[item.name] = transformValue(valueDisplay, point.value);
      buckets.set(point.bucket, row);
    }
  }

  return Array.from(buckets.values());
}

export function DatasetChartPanel({
  title,
  totals,
  totalsUnit,
  breakdownTitle,
  breakdown,
  valueDisplay,
}: Props) {
  const totalsData = totals.map((point) => ({
    bucket: formatShortDate(point.bucket),
    value:
      totalsUnit === "hours"
        ? Number((point.value / 3600).toFixed(2))
        : Number(point.value.toFixed(2)),
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <Card className="border-none shadow-panel">
        <p className="text-lg font-semibold text-ink">{title}</p>
        <AreaChart
          className="mt-6 h-72"
          data={totalsData}
          index="bucket"
          categories={["value"]}
          colors={["teal"]}
          valueFormatter={(value: number) => formatDisplay(valueDisplay, value)}
          showAnimation
        />
      </Card>
      <Card className="border-none shadow-panel">
        <p className="text-lg font-semibold text-ink">{breakdownTitle}</p>
        <LineChart
          className="mt-6 h-72"
          data={normalizeSeries(breakdown, valueDisplay)}
          index="bucket"
          categories={breakdown.map((item) => item.name)}
          colors={["teal", "amber", "rose"]}
          valueFormatter={(value: number) => formatDisplay(valueDisplay, value)}
          showAnimation
        />
      </Card>
    </div>
  );
}

function transformValue(mode: Props["valueDisplay"], value: number) {
  if (mode === "hours") {
    return Number((value / 3600).toFixed(2));
  }

  return Number(value.toFixed(2));
}

function formatDisplay(mode: Props["valueDisplay"], value: number) {
  if (mode === "hours") {
    return `${value.toFixed(1)}h`;
  }

  if (mode === "minutes") {
    return `${value.toFixed(1)}m`;
  }

  return value.toFixed(1);
}
