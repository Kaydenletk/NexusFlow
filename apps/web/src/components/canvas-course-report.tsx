"use client";

import { AreaChart, BarList } from "@tremor/react";
import {
  getCanvasCourseReport,
  type FocusSnapshotV1,
  type CanvasCourseReportItem,
} from "@nexusflow/focus-core";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

import {
  loadStoredFocusSnapshot,
} from "../lib/focus-storage";
import { formatShortDate } from "../lib/format";

type LoadState = {
  snapshot: FocusSnapshotV1 | null;
  loading: boolean;
};

function round(value: number) {
  return Number(value.toFixed(2));
}

function formatHoursFromMinutes(minutes: number) {
  return `${round(minutes / 60)}h`;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function interruptionTone(intent: CanvasCourseReportItem["interruptions"][number]["intent"]) {
  if (intent === "distracting") {
    return "bg-red-100 text-red-700";
  }

  if (intent === "productive") {
    return "bg-emerald-100 text-emerald-700";
  }

  return "bg-slate-100 text-slate-700";
}

export function CanvasCourseReport() {
  const [state, setState] = useState<LoadState>({
    snapshot: null,
    loading: true,
  });
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const snapshot = await loadStoredFocusSnapshot();

      setState({
        snapshot,
        loading: false,
      });
    })();
  }, []);

  const report = useMemo(() => {
    if (!state.snapshot) {
      return null;
    }

    return getCanvasCourseReport(state.snapshot);
  }, [state.snapshot]);

  const selectedCourse =
    report?.courses.find((course) => course.courseId === selectedCourseId) ??
    report?.courses[0] ??
    null;

  useEffect(() => {
    if (!report?.courses.length) {
      return;
    }

    setSelectedCourseId((current) => {
      if (current && report.courses.some((course) => course.courseId === current)) {
        return current;
      }

      return report.courses[0]?.courseId ?? null;
    });
  }, [report]);

  if (state.loading) {
    return (
      <Card>
        <p className="text-sm text-slate-400">Loading...</p>
      </Card>
    );
  }

  if (!state.snapshot) {
    return (
      <Card>
        <Label>Canvas Report</Label>
        <p className="mt-2 text-2xl font-semibold text-slate-900">
          No snapshot loaded
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Import a snapshot in the Focus dashboard first.
        </p>
        <Link
          href="/focus"
          className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Go to Focus
        </Link>
      </Card>
    );
  }

  if (!report || report.totalCourseCount === 0) {
    return (
      <Card>
        <Label>Canvas Report</Label>
        <p className="mt-2 text-2xl font-semibold text-slate-900">
          No Canvas sessions found
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Import a snapshot that includes Canvas LMS browsing activity.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <Label>Canvas Time</Label>
          <BigValue>{formatHoursFromMinutes(report.totalCanvasMinutes)}</BigValue>
          <p className="mt-1 text-sm text-slate-500">
            {report.totalCourseCount} course{report.totalCourseCount === 1 ? "" : "s"}
          </p>
        </Card>
        <Card>
          <Label>Total Interruptions</Label>
          <BigValue>
            {String(report.courses.reduce((t, c) => t + c.switchOutCount, 0))}
          </BigValue>
          <p className="mt-1 text-sm text-slate-500">Leaves from any course</p>
        </Card>
        <Card>
          <Label>Distracting Switches</Label>
          <BigValue>
            {String(report.courses.reduce((t, c) => t + c.distractingSwitchCount, 0))}
          </BigValue>
          <p className="mt-1 text-sm text-slate-500">Into distracting sessions</p>
        </Card>
        <Card>
          <Label>Fast Switches</Label>
          <BigValue>
            {String(report.courses.reduce((t, c) => t + c.fastSwitchCount, 0))}
          </BigValue>
          <p className="mt-1 text-sm text-slate-500">
            Return within {report.fastSwitchThresholdSeconds}s
          </p>
        </Card>
      </div>

      {/* Course table + selected course */}
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardTitle>Courses</CardTitle>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="pb-3 pr-4 font-medium">Course</th>
                  <th className="pb-3 pr-4 font-medium">Time</th>
                  <th className="pb-3 pr-4 font-medium">Switches</th>
                  <th className="pb-3 pr-4 font-medium">Distracting</th>
                  <th className="pb-3 font-medium">Return</th>
                </tr>
              </thead>
              <tbody>
                {report.courses.map((course) => (
                  <tr
                    key={course.courseId}
                    className={selectedCourse?.courseId === course.courseId ? "bg-slate-50" : ""}
                  >
                    <td className="py-2.5 pr-4">
                      <button
                        type="button"
                        onClick={() => setSelectedCourseId(course.courseId)}
                        className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-900 transition hover:bg-slate-200"
                      >
                        {course.courseId}
                      </button>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-600">
                      {formatHoursFromMinutes(course.totalMinutes)}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-600">{course.switchOutCount}</td>
                    <td className="py-2.5 pr-4 text-slate-600">
                      {course.distractingSwitchCount}
                    </td>
                    <td className="py-2.5 text-slate-600">{formatPercent(course.returnRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {selectedCourse ? (
          <Card>
            <Label>Selected Course</Label>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {selectedCourse.courseId}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <MetricTile label="Study time" value={formatHoursFromMinutes(selectedCourse.totalMinutes)} />
              <MetricTile label="Interruptions" value={String(selectedCourse.switchOutCount)} />
              <MetricTile label="Distracting" value={String(selectedCourse.distractingSwitchCount)} />
              <MetricTile label="Return rate" value={formatPercent(selectedCourse.returnRate)} />
            </div>
          </Card>
        ) : null}
      </div>

      {/* Daily rhythm + distraction hosts */}
      {selectedCourse ? (
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardTitle>Daily Rhythm</CardTitle>
            <AreaChart
              className="mt-4 h-56"
              data={selectedCourse.daily.map((point) => ({
                date: formatShortDate(`${point.date}T00:00:00`),
                hours: round(point.durationMinutes / 60),
                interruptions: point.switchOutCount,
              }))}
              index="date"
              categories={["hours", "interruptions"]}
              colors={["teal", "orange"]}
            />
          </Card>

          <div className="space-y-4">
            <Card>
              <CardTitle>Top Distraction Hosts</CardTitle>
              {selectedCourse.topDistractionHosts.length > 0 ? (
                <BarList
                  className="mt-4"
                  data={selectedCourse.topDistractionHosts.map((item) => ({
                    name: item.hostname,
                    value: item.durationMinutes,
                  }))}
                  valueFormatter={(v: number) => `${Math.round(v)}m`}
                />
              ) : (
                <p className="mt-3 text-sm text-slate-400">None detected</p>
              )}
            </Card>

            <Card>
              <CardTitle>Recent Exits</CardTitle>
              {selectedCourse.interruptions.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {selectedCourse.interruptions
                    .slice(-5)
                    .reverse()
                    .map((interruption) => (
                      <div
                        key={`${interruption.at}-${interruption.hostname}`}
                        className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {interruption.hostname}
                          </p>
                          <p className="text-xs text-slate-500">
                            {Math.max(1, Math.round(interruption.durationSeconds))}s away
                            {interruption.returnedToCourse ? " · returned" : ""}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${interruptionTone(interruption.intent)}`}
                        >
                          {interruption.intent}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-400">No interruptions</p>
              )}
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
      {children}
    </p>
  );
}

function BigValue({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
      {children}
    </p>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-base font-semibold text-slate-900">{children}</p>
  );
}

function MetricTile(props: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
        {props.label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{props.value}</p>
    </div>
  );
}
