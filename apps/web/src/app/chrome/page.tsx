import Link from "next/link";

import { ChromeDashboard } from "../../components/chrome-dashboard";
import {
  fetchChromeCanvasReport,
  fetchChromeCategories,
  fetchChromeContextSwitching,
  fetchChromeHealth,
  fetchChromeHosts,
  fetchChromeOverview,
  fetchChromeSessions,
  fetchChromeSyncStatus,
  fetchChromeTimeline,
} from "../../lib/api";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const allowedRanges = new Set(["1d", "7d", "30d"]);

function formatDateLabel(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00`);

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function ChromePage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const range =
    typeof params.range === "string" && allowedRanges.has(params.range)
      ? (params.range as "1d" | "7d" | "30d")
      : "7d";
  try {
    const overview = await fetchChromeOverview(range);
    const latestDate =
      typeof params.date === "string"
        ? params.date
        : overview.daily.at(-1)?.date ?? new Date().toISOString().slice(0, 10);

    const [health, hosts, categories, context, timeline, sessions, canvasReport, syncStatus] =
      await Promise.all([
        fetchChromeHealth(),
        fetchChromeHosts(range),
        fetchChromeCategories(range),
        fetchChromeContextSwitching(range),
        fetchChromeTimeline(latestDate),
        fetchChromeSessions(range, 100),
        fetchChromeCanvasReport(range),
        fetchChromeSyncStatus(),
      ]);

    return (
      <>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold text-slate-900">Chrome Activity</h2>
          <div className="flex gap-1.5">
            {(["1d", "7d", "30d"] as const).map((item) => (
              <Link
                key={item}
                href={`/chrome?range=${item}&date=${latestDate}`}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  range === item
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {item}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {overview.daily.slice(-7).map((item) => (
            <Link
              key={item.date}
              href={`/chrome?range=${range}&date=${item.date}`}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                latestDate === item.date
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {formatDateLabel(item.date)}
            </Link>
          ))}
        </div>

        <ChromeDashboard
          health={health}
          overview={overview}
          hosts={hosts}
          categories={categories}
          context={context}
          timeline={timeline}
          sessions={sessions}
          canvasReport={canvasReport}
          syncStatus={syncStatus}
        />
      </>
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Chrome dashboard could not reach the local API.";

    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Chrome Activity
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">
          Waiting for local API
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Start Docker, confirm the API is on{" "}
          <span className="font-medium text-slate-900">localhost:3001</span>,
          then reload.
        </p>
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      </div>
    );
  }
}
