import { useEffect, useState } from "react";
import {
  formatLocalDate,
  getBurnoutAssessment,
  getDailyFocusMetric,
  getDailyFocusMetrics,
  type BurnoutAssessment,
  type DailyFocusMetrics,
} from "@quantified-self/focus-core";

import {
  exportFocusSnapshot,
  getSettings,
  saveSettings,
  type FocusSettings,
} from "../lib/focus-db.js";
import { downloadSnapshot } from "../lib/snapshot.js";

type PopupState = {
  settings: FocusSettings;
  today: DailyFocusMetrics;
  burnout: BurnoutAssessment;
  sessionCount: number;
};

function getEmptyMetric(date: string): DailyFocusMetrics {
  return {
    date,
    activeMinutes: 0,
    productiveMinutes: 0,
    deepWorkMinutes: 0,
    shallowWorkMinutes: 0,
    fragmentationScore: 0,
    categorySwitches: 0,
  };
}

function formatMinutes(value: number) {
  return `${(value / 60).toFixed(1)}h`;
}

function levelTone(level: BurnoutAssessment["level"]) {
  if (level === "critical") {
    return "bg-coral/15 text-coral";
  }

  if (level === "warning") {
    return "bg-saffron/20 text-saffron";
  }

  if (level === "warming_up") {
    return "bg-slate-200 text-slate-600";
  }

  return "bg-emerald-100 text-emerald-700";
}

export function PopupApp() {
  const [state, setState] = useState<PopupState | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void loadState();
  }, []);

  async function loadState() {
    const [snapshot, settings] = await Promise.all([
      exportFocusSnapshot(),
      getSettings(),
    ]);
    const today = formatLocalDate(new Date());
    const metrics = getDailyFocusMetrics(snapshot.sessions);

    setState({
      settings,
      today:
        metrics.find((metric) => metric.date === today) ?? getEmptyMetric(today),
      burnout: getBurnoutAssessment(metrics),
      sessionCount: snapshot.sessions.length,
    });
  }

  async function handleToggleNotifications() {
    if (!state) {
      return;
    }

    const nextSettings = await saveSettings({
      ...state.settings,
      notificationsEnabled: !state.settings.notificationsEnabled,
    });

    setState({
      ...state,
      settings: nextSettings,
    });
  }

  async function handleExport() {
    setStatus(null);

    try {
      const snapshot = await exportFocusSnapshot();
      downloadSnapshot(
        snapshot,
        `nexusflow-focus-${formatLocalDate(new Date())}.json`,
      );
      setStatus("Snapshot exported.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Failed to export snapshot.",
      );
    }
  }

  if (!state) {
    return (
      <main className="p-5">
        <div className="rounded-[1.5rem] border border-white/70 bg-white/80 p-6 shadow-panel">
          <p className="text-sm font-semibold text-slate-500">Loading focus signal...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="p-5">
      <div className="space-y-4 rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">
              NexusFlow Focus
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-ink">
              Deep work, not just screen time
            </h1>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${levelTone(
              state.burnout.level,
            )}`}
          >
            {state.burnout.level.replaceAll("_", " ")}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Today active" value={formatMinutes(state.today.activeMinutes)} />
          <MetricCard
            label="Deep work"
            value={formatMinutes(state.today.deepWorkMinutes)}
          />
          <MetricCard
            label="Fragmentation"
            value={state.today.fragmentationScore.toFixed(2)}
          />
          <MetricCard label="Tracked sessions" value={String(state.sessionCount)} />
        </div>

        <div className="rounded-[1.5rem] bg-cloud p-4">
          <p className="text-sm font-semibold text-ink">Burnout heuristic</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{state.burnout.message}</p>
        </div>

        <label className="flex items-center justify-between rounded-[1.5rem] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-ink">
          <span>Burnout notifications</span>
          <button
            type="button"
            role="switch"
            aria-checked={state.settings.notificationsEnabled}
            onClick={handleToggleNotifications}
            className={`flex h-7 w-14 items-center rounded-full p-1 transition ${
              state.settings.notificationsEnabled ? "bg-aurora" : "bg-slate-300"
            }`}
          >
            <span
              className={`h-5 w-5 rounded-full bg-white transition ${
                state.settings.notificationsEnabled
                  ? "translate-x-7"
                  : "translate-x-0"
              }`}
            />
          </button>
        </label>

        <button
          type="button"
          onClick={handleExport}
          className="w-full rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-aurora"
        >
          Export snapshot
        </button>

        {status ? <p className="text-sm text-slate-600">{status}</p> : null}
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-white/80 bg-white/90 p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}
