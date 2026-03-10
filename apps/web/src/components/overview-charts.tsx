"use client";

import {
  AreaChart,
  BarList,
  Card,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
} from "@tremor/react";

import type {
  CodingActivitySeriesResponse,
  HealthMetricSeriesResponse,
  ListeningHistorySeriesResponse,
  SummaryResponse,
} from "@quantified-self/contracts";

import { formatShortDate } from "../lib/format";

type Props = {
  summary: SummaryResponse;
  codingSeries: CodingActivitySeriesResponse;
  listeningSeries: ListeningHistorySeriesResponse;
  healthSeries: HealthMetricSeriesResponse;
};

export function OverviewCharts({
  summary,
  codingSeries,
  listeningSeries,
  healthSeries,
}: Props) {
  const codingData = codingSeries.totals.map((point) => ({
    bucket: formatShortDate(point.bucket),
    value: Number((point.value / 3600).toFixed(2)),
  }));
  const listeningData = listeningSeries.totals.map((point) => ({
    bucket: formatShortDate(point.bucket),
    value: Number((point.value / 3_600_000).toFixed(2)),
  }));
  const healthData = healthSeries.points.map((point) => ({
    bucket: formatShortDate(point.bucket),
    value: Number(point.value.toFixed(2)),
  }));

  return (
    <TabGroup>
      <TabList className="rounded-full border border-white/70 bg-white/80 p-1">
        <Tab>Coding</Tab>
        <Tab>Listening</Tab>
        <Tab>Health</Tab>
      </TabList>
      <TabPanels className="mt-6">
        <TabPanel>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card className="border-none shadow-panel">
              <p className="text-lg font-semibold text-ink">Coding hours over time</p>
              <AreaChart
                className="mt-6 h-72"
                data={codingData}
                index="bucket"
                categories={["value"]}
                colors={["teal"]}
                valueFormatter={(value: number) => `${value.toFixed(1)}h`}
                showAnimation
              />
            </Card>
            <Card className="border-none shadow-panel">
              <p className="text-lg font-semibold text-ink">Top languages</p>
              <BarList
                className="mt-6"
                data={summary.coding.topLanguages.map((item) => ({
                  name: item.name,
                  value: Number((item.value / 3600).toFixed(2)),
                }))}
                valueFormatter={(value: number) => `${value.toFixed(1)}h`}
              />
            </Card>
          </div>
        </TabPanel>
        <TabPanel>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card className="border-none shadow-panel">
              <p className="text-lg font-semibold text-ink">Listening hours over time</p>
              <AreaChart
                className="mt-6 h-72"
                data={listeningData}
                index="bucket"
                categories={["value"]}
                colors={["amber"]}
                valueFormatter={(value: number) => `${value.toFixed(1)}h`}
                showAnimation
              />
            </Card>
            <Card className="border-none shadow-panel">
              <p className="text-lg font-semibold text-ink">Top artists</p>
              <BarList
                className="mt-6"
                data={summary.listening.topArtists.map((item) => ({
                  name: item.name,
                  value: Number((item.value / 3_600_000).toFixed(2)),
                }))}
                valueFormatter={(value: number) => `${value.toFixed(1)}h`}
              />
            </Card>
          </div>
        </TabPanel>
        <TabPanel>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card className="border-none shadow-panel">
              <p className="text-lg font-semibold text-ink">
                {healthSeries.metricType} trend
              </p>
              <AreaChart
                className="mt-6 h-72"
                data={healthData}
                index="bucket"
                categories={["value"]}
                colors={["rose"]}
                valueFormatter={(value: number) => value.toFixed(1)}
                showAnimation
              />
            </Card>
            <Card className="border-none shadow-panel">
              <p className="text-lg font-semibold text-ink">Latest health signals</p>
              <BarList
                className="mt-6"
                data={summary.health.latestByMetric.map((item) => ({
                  name: item.metricType,
                  value: item.value,
                }))}
                valueFormatter={(value: number) => value.toFixed(1)}
              />
            </Card>
          </div>
        </TabPanel>
      </TabPanels>
    </TabGroup>
  );
}
