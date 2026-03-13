"use client";

import React, { useRef } from "react";
import { BarChart, BarList, LineChart } from "@tremor/react";
import type {
  ChromeCanvasCourseReport,
  ChromeCategoriesResponse,
  ChromeContextSwitchingResponse,
  ChromeHealthResponse,
  ChromeHostsResponse,
  ChromeOverviewResponse,
  ChromeSessionsResponse,
  ChromeSyncStatusResponse,
  ChromeTimelineResponse,
} from "@quantified-self/contracts";

type Props = {
  health: ChromeHealthResponse;
  overview: ChromeOverviewResponse;
  hosts: ChromeHostsResponse;
  categories: ChromeCategoriesResponse;
  context: ChromeContextSwitchingResponse;
  timeline: ChromeTimelineResponse;
  sessions: ChromeSessionsResponse;
  canvasReport: ChromeCanvasCourseReport;
  syncStatus: ChromeSyncStatusResponse;
};

type TabAggregate = {
  label: string;
  minutes: number;
  sessions: number;
};

type SectionId = "focus" | "switching" | "tabs" | "mix" | "timeline" | "sync";

const sidebarSections: Array<{ id: SectionId; label: string }> = [
  { id: "focus", label: "Focus Flow" },
  { id: "switching", label: "Switch Load" },
  { id: "tabs", label: "Time per Tab" },
  { id: "mix", label: "Mix" },
  { id: "timeline", label: "Timeline" },
  { id: "sync", label: "Sync State" },
];

function round(value: number) {
  return Number(value.toFixed(2));
}

function formatHours(value: number) {
  return `${round(value)}h`;
}

function formatMinutes(value: number) {
  return `${Math.round(value)}m`;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Waiting";
}

function buildTabLabel(item: ChromeSessionsResponse["items"][number]) {
  if (item.documentTitle && !item.isPathMasked) {
    return item.documentTitle;
  }

  if (!item.isPathMasked && item.path !== "/__masked__") {
    return `${item.hostname}${item.path}`;
  }

  return item.hostname;
}

function getTopTabs(items: ChromeSessionsResponse["items"]) {
  const buckets = new Map<string, TabAggregate>();

  for (const item of items) {
    const label = buildTabLabel(item);
    const existing = buckets.get(label);

    if (existing) {
      existing.minutes += item.durationSeconds / 60;
      existing.sessions += 1;
      continue;
    }

    buckets.set(label, {
      label,
      minutes: item.durationSeconds / 60,
      sessions: 1,
    });
  }

  return [...buckets.values()]
    .sort((left, right) => right.minutes - left.minutes)
    .slice(0, 8);
}

function getSignalTone(level: string) {
  if (level === "Critical") {
    return "text-rose-600";
  }

  if (level === "Warning") {
    return "text-amber-600";
  }

  return "text-emerald-600";
}

export function ChromeDashboard({
  health,
  overview,
  hosts,
  categories,
  context,
  timeline,
  sessions,
  canvasReport,
  syncStatus,
}: Props) {
  const sectionRefs = useRef<Record<SectionId, HTMLElement | null>>({
    focus: null,
    switching: null,
    tabs: null,
    mix: null,
    timeline: null,
    sync: null,
  });

  const topCourse = canvasReport.courses[0] ?? null;
  const topTabs = getTopTabs(sessions.items);
  const topTab = topTabs[0] ?? null;
  const productiveHours = overview.metrics.trackedHours * overview.metrics.productiveRatio;
  const distractingHours = overview.metrics.trackedHours * overview.metrics.distractingRatio;
  const latestContext = context.items.at(-1) ?? null;
  const switchDensity =
    overview.metrics.trackedHours > 0
      ? round(overview.metrics.switchCount / overview.metrics.trackedHours)
      : 0;

  function scrollToSection(id: SectionId) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="grid xl:grid-cols-[240px_minmax(0,1fr)]">
        {/* Sidebar */}
        <aside className="border-b border-slate-100 bg-slate-50/80 p-5 xl:border-b-0 xl:border-r">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Chrome Console
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
              Dashboard
            </h3>
          </div>

          <nav className="mt-6 space-y-1">
            {sidebarSections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition hover:bg-white hover:text-slate-900 hover:shadow-sm"
              >
                {section.label}
              </button>
            ))}
          </nav>

          <div className="mt-8 rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Live Signal
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{health.totalSessions}</p>
            <p className="text-sm text-slate-500">stored sessions</p>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">API</span>
                <span className="font-medium text-slate-900">{health.status.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">DB</span>
                <span className="font-medium text-slate-900">{health.database.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Last sync</span>
                <span className="font-medium text-slate-900">
                  {health.lastSyncAt ? "Live" : "Idle"}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="space-y-5 p-5">
          {/* Spec cards */}
          <div className="grid gap-4 xl:grid-cols-3">
            <SpecCard
              label="Focus Specs"
              rows={[
                ["Tracked", formatHours(overview.metrics.trackedHours)],
                ["Focused", formatHours(productiveHours)],
                ["Distracting", formatHours(distractingHours)],
                ["Active days", String(overview.metrics.activeDays)],
              ]}
            />
            <SpecCard
              label="Switch Health"
              rows={[
                ["Switches", String(overview.metrics.switchCount)],
                ["Switch tax", String(overview.metrics.switchTax)],
                ["Per hour", String(switchDensity)],
                ["State", overview.metrics.burnoutLevel],
              ]}
            />
            <SpecCard
              label="Sync Rail"
              rows={[
                ["API", health.status.toUpperCase()],
                ["Database", health.database.toUpperCase()],
                ["Last sync", formatDateTime(health.lastSyncAt)],
                ["Rows", String(health.totalSessions)],
              ]}
            />
          </div>

          {/* Focus flow */}
          <section ref={(el) => { sectionRefs.current.focus = el; }}>
            <SurfaceCard label="Focus Flow">
              <div className="grid gap-3 lg:grid-cols-3">
                <MiniBadge label="Focused" value={formatHours(productiveHours)} />
                <MiniBadge label="Distracting" value={formatHours(distractingHours)} />
                <MiniBadge label="Switch tax" value={String(overview.metrics.switchTax)} />
              </div>
              <LineChart
                className="mt-4 h-64"
                data={overview.daily.map((item) => ({
                  date: item.date,
                  tracked: item.trackedMinutes,
                  focused: item.productiveMinutes,
                  distracting: item.distractingMinutes,
                }))}
                index="date"
                categories={["tracked", "focused", "distracting"]}
                colors={["blue", "emerald", "amber"]}
              />
            </SurfaceCard>
          </section>

          {/* Behavior signal */}
          <section ref={(el) => { sectionRefs.current.switching = el; }}>
            <SurfaceCard label="Switch Load">
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricTile
                  label="Burnout state"
                  value={overview.metrics.burnoutLevel}
                  valueClass={getSignalTone(overview.metrics.burnoutLevel)}
                />
                <MetricTile
                  label="Focus ratio"
                  value={formatPercent(overview.metrics.productiveRatio)}
                />
              </div>
              <LineChart
                className="mt-4 h-64"
                data={context.items.map((item) => ({
                  date: item.date,
                  switches: item.switchCount,
                  switchTax: item.switchTax,
                  fragmentation: round(item.fragmentationScore),
                }))}
                index="date"
                categories={["switches", "switchTax", "fragmentation"]}
                colors={["rose", "amber", "slate"]}
              />
              {latestContext ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <MiniBadge label="Switches" value={String(latestContext.switchCount)} />
                  <MiniBadge label="Tax" value={String(latestContext.switchTax)} />
                  <MiniBadge label="Fragmentation" value={String(round(latestContext.fragmentationScore))} />
                </div>
              ) : null}
            </SurfaceCard>
          </section>

          {/* Time per tab */}
          <section ref={(el) => { sectionRefs.current.tabs = el; }} className="grid gap-4 xl:grid-cols-2">
            <SurfaceCard label="Time per Tab">
              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Top tab
                  </p>
                  <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                    {topTab ? topTab.label : "No data"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {topTab
                      ? `${formatMinutes(topTab.minutes)} across ${topTab.sessions} session${topTab.sessions === 1 ? "" : "s"}`
                      : "Sync more rows to populate."}
                  </p>
                </div>
                <BarList
                  data={topTabs.map((item) => ({
                    name: item.label,
                    value: Math.round(item.minutes),
                  }))}
                  valueFormatter={(v: number) => `${v}m`}
                />
              </div>
            </SurfaceCard>

            <section ref={(el) => { sectionRefs.current.mix = el; }}>
              <SurfaceCard label="Mix">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                      Top Hosts
                    </p>
                    <BarList
                      className="mt-3"
                      data={hosts.items.slice(0, 6).map((item) => ({
                        name: item.isMostlyMasked ? `${item.hostname} (masked)` : item.hostname,
                        value: Math.round(item.durationMinutes),
                      }))}
                      valueFormatter={(v: number) => `${v}m`}
                    />
                  </div>

                  <BarChart
                    className="h-44"
                    data={categories.items.map((item) => ({
                      category: item.category,
                      minutes: item.durationMinutes,
                    }))}
                    index="category"
                    categories={["minutes"]}
                    colors={["violet"]}
                  />

                  {topCourse ? (
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                        Canvas Rhythm
                      </p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">
                        Course {topCourse.courseId}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatMinutes(topCourse.totalMinutes)} · {topCourse.switchOutCount} exits
                      </p>
                    </div>
                  ) : null}
                </div>
              </SurfaceCard>
            </section>
          </section>

          {/* Timeline */}
          <section ref={(el) => { sectionRefs.current.timeline = el; }} className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <SurfaceCard label={`Timeline — ${timeline.date}`}>
              <div className="grid gap-3 sm:grid-cols-4">
                <MiniBadge label="Switches" value={String(timeline.switchCount)} />
                <MiniBadge label="Tax" value={String(timeline.switchTax)} />
                <MiniBadge label="Focus blocks" value={String(timeline.focusBlocks.length)} />
                <MiniBadge label="Rows" value={String(timeline.items.length)} />
              </div>

              <div className="mt-4 max-h-96 overflow-auto rounded-xl border border-slate-100">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Time</th>
                      <th className="px-4 py-2.5 font-medium">Page</th>
                      <th className="px-4 py-2.5 font-medium">Category</th>
                      <th className="px-4 py-2.5 font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeline.items.map((item) => (
                      <tr key={item.id} className="border-t border-slate-50 align-top">
                        <td className="px-4 py-2.5 text-slate-500">
                          {new Date(item.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-2.5 font-medium text-slate-900">
                          {buildTabLabel(item)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">{item.category}</td>
                        <td className="px-4 py-2.5 text-slate-500">
                          {Math.round(item.durationSeconds / 60)}m
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SurfaceCard>

            <section ref={(el) => { sectionRefs.current.sync = el; }} className="space-y-4">
              <SurfaceCard label="Sync Diagnostics">
                <div className="space-y-3">
                  {syncStatus.items.slice(0, 4).map((run) => (
                    <div key={run.id} className="rounded-xl bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-900">{run.status}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(run.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {run.rowsReceived} received · {run.rowsInserted} inserted
                      </p>
                      {run.errorMessage ? (
                        <p className="mt-1 text-xs text-rose-500">{run.errorMessage}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </SurfaceCard>

              <SurfaceCard label="Stored Rows">
                <div className="max-h-80 overflow-auto rounded-xl border border-slate-100">
                  <table className="min-w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Page</th>
                        <th className="px-4 py-2.5 font-medium">Intent</th>
                        <th className="px-4 py-2.5 font-medium">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.items.slice(0, 12).map((item) => (
                        <tr key={item.id} className="border-t border-slate-50 align-top">
                          <td className="max-w-[180px] truncate px-4 py-2.5">
                            <p className="font-medium text-slate-900">{buildTabLabel(item)}</p>
                          </td>
                          <td className="px-4 py-2.5 text-slate-500">{item.intent}</td>
                          <td className="px-4 py-2.5 text-slate-500">
                            {Math.round(item.durationSeconds / 60)}m
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SurfaceCard>
            </section>
          </section>
        </div>
      </div>
    </section>
  );
}

function SpecCard(props: {
  label: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div className="rounded-xl bg-slate-50/80 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
        {props.label}
      </p>
      <div className="mt-3 space-y-2">
        {props.rows.map(([label, value]) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-slate-500">{label}</span>
            <span className="font-medium text-slate-900">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SurfaceCard(props: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_24px_rgba(148,163,184,0.1)]">
      <p className="text-base font-semibold text-slate-900">{props.label}</p>
      <div className="mt-4">{props.children}</div>
    </div>
  );
}

function MetricTile(props: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
        {props.label}
      </p>
      <p className={`mt-2 text-2xl font-semibold text-slate-900 ${props.valueClass ?? ""}`}>
        {props.value}
      </p>
    </div>
  );
}

function MiniBadge(props: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
        {props.label}
      </p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{props.value}</p>
    </div>
  );
}
