import { DatasetChartPanel } from "../../components/dataset-chart-panel";
import { RangeTabs } from "../../components/range-tabs";
import { RecentTable } from "../../components/recent-table";
import { fetchListeningHistory, fetchRecent } from "../../lib/api";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ListeningPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const range = typeof params.range === "string" ? params.range : "30d";
  const bucket = typeof params.bucket === "string" ? params.bucket : "day";

  const [series, recent] = await Promise.all([
    fetchListeningHistory(range, bucket),
    fetchRecent("listening_history", 10),
  ]);

  return (
    <>
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
            Listening History
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-ink">
            Understand the soundtrack behind your work
          </h2>
        </div>
        <RangeTabs
          basePath="/listening"
          active={range}
          extraQuery={`bucket=${bucket}`}
        />
      </section>
      <DatasetChartPanel
        title="Listening totals"
        totals={series.totals.map((point) => ({
          ...point,
          value: point.value / 60000,
        }))}
        totalsUnit="minutes"
        breakdownTitle="Top artists"
        breakdown={series.topArtists.map((item) => ({
          ...item,
          points: item.points.map((point) => ({
            ...point,
            value: point.value / 60000,
          })),
        }))}
        valueDisplay="minutes"
      />
      <RecentTable title="Recent listening entries" recent={recent} />
    </>
  );
}
