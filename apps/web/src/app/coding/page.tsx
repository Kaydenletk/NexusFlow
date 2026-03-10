import { DatasetChartPanel } from "../../components/dataset-chart-panel";
import { RangeTabs } from "../../components/range-tabs";
import { RecentTable } from "../../components/recent-table";
import { fetchCodingActivity, fetchRecent } from "../../lib/api";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CodingPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const range = typeof params.range === "string" ? params.range : "30d";
  const bucket = typeof params.bucket === "string" ? params.bucket : "day";

  const [series, recent] = await Promise.all([
    fetchCodingActivity(range, bucket),
    fetchRecent("coding_activity", 10),
  ]);

  return (
    <>
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
            Coding Activity
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-ink">
            Track where engineering time actually goes
          </h2>
        </div>
        <RangeTabs basePath="/coding" active={range} extraQuery={`bucket=${bucket}`} />
      </section>
      <DatasetChartPanel
        title="Coding totals"
        totals={series.totals}
        totalsUnit="hours"
        breakdownTitle="Top languages"
        breakdown={series.topLanguages}
        valueDisplay="hours"
      />
      <RecentTable title="Recent coding entries" recent={recent} />
    </>
  );
}
