import { useEffect, useState } from "react";
import {
  calculateContextSwitchTax,
  formatLocalDate,
  getDailyFocusMetric,
  getEarlyBurnoutWarning,
  type BurnoutAssessment,
  type DailyFocusMetrics,
} from "@nexusflow/focus-core";

import {
  exportFocusSnapshot,
  getSettings,
  listUnsyncedSessions,
  listRecentSessions,
  listSessionsForDate,
  markSessionsSynced,
  saveSettings,
  type FocusSettings,
} from "../lib/focus-db.js";
import {
  probeChromeApi,
  syncChromeSessions,
  type ChromeConnectionState,
} from "../lib/chrome-sync.js";
import { downloadSnapshot } from "../lib/snapshot.js";

type PopupState = {
  settings: FocusSettings;
  today: DailyFocusMetrics;
  burnout: BurnoutAssessment;
  todaySessionCount: number;
  todaySwitchTax: number;
  unsyncedSessionCount: number;
  connectionState: ChromeConnectionState;
  connectionMessage: string;
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

function getLookbackStart(now: Date) {
  const start = new Date(now);
  start.setDate(start.getDate() - 14);
  start.setHours(0, 0, 0, 0);

  return start.toISOString();
}

function formatClock(value: number) {
  const totalMinutes = Math.max(0, Math.round(value));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getBurnoutColor(assessment: BurnoutAssessment, activeMinutes: number) {
  if (activeMinutes < 10 || assessment.warmingUp) {
    return { bg: "bg-slate-100", text: "text-slate-600", label: "Warming up" };
  }

  if (assessment.level === "Critical") {
    return { bg: "bg-red-100", text: "text-red-700", label: "Critical" };
  }

  if (assessment.level === "Warning") {
    return { bg: "bg-amber-100", text: "text-amber-700", label: "Warning" };
  }

  return { bg: "bg-emerald-100", text: "text-emerald-700", label: "Safe" };
}

function getConnectionBadge(state: ChromeConnectionState) {
  switch (state) {
    case "reachable":
      return { label: "Connected", cls: "bg-emerald-100 text-emerald-700" };
    case "unhealthy":
      return { label: "Unhealthy", cls: "bg-amber-100 text-amber-700" };
    case "unreachable":
      return { label: "Offline", cls: "bg-red-100 text-red-700" };
  }
}

export function PopupApp() {
  const [state, setState] = useState<PopupState | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [showSync, setShowSync] = useState(false);

  useEffect(() => {
    void loadState();
  }, []);

  async function loadState() {
    const todayDate = new Date();
    const today = formatLocalDate(todayDate);
    const [todaySessions, recentSessions, settings] = await Promise.all([
      listSessionsForDate(todayDate),
      listRecentSessions(getLookbackStart(todayDate)),
      getSettings(),
    ]);
    const unsyncedSessions = await listUnsyncedSessions();
    const connection = await probeChromeApi(settings.apiBaseUrl).catch(() => ({
      state: "unreachable" as const,
      baseUrl: settings.apiBaseUrl,
      health: null,
      message: "Cannot reach local API.",
    }));

    setState({
      settings,
      today:
        todaySessions.length > 0
          ? getDailyFocusMetric(todaySessions, today)
          : getEmptyMetric(today),
      burnout: getEarlyBurnoutWarning(recentSessions),
      todaySessionCount: todaySessions.length,
      todaySwitchTax: calculateContextSwitchTax(todaySessions),
      unsyncedSessionCount: unsyncedSessions.length,
      connectionState: connection.state,
      connectionMessage: connection.message,
    });
  }

  async function handleToggleNotifications() {
    if (!state) return;

    const nextSettings = await saveSettings({
      ...state.settings,
      notificationsEnabled: !state.settings.notificationsEnabled,
    });

    setState({ ...state, settings: nextSettings });
  }

  async function handleExport() {
    setStatus(null);

    try {
      const snapshot = await exportFocusSnapshot();
      downloadSnapshot(
        snapshot,
        `nexusflow-export-${formatLocalDate(new Date())}.json`,
      );
      setStatus("Snapshot exported.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Failed to export.",
      );
    }
  }

  function handleApiBaseUrlChange(value: string) {
    if (!state) return;

    setState({
      ...state,
      settings: { ...state.settings, apiBaseUrl: value },
    });
  }

  async function handleSaveChromeSyncConfig() {
    if (!state) return;

    setStatus(null);

    const connection = await probeChromeApi(state.settings.apiBaseUrl).catch(() => ({
      state: "unreachable" as const,
      baseUrl: state.settings.apiBaseUrl,
      health: null,
      message: "Cannot reach local API.",
    }));

    if (connection.state !== "reachable") {
      setState({
        ...state,
        connectionState: connection.state,
        connectionMessage: connection.message,
      });
      setStatus(connection.message);
      return;
    }

    const nextSettings = await saveSettings({
      ...state.settings,
      apiBaseUrl: connection.baseUrl,
      lastChromeSyncError: null,
    });

    setState({
      ...state,
      settings: nextSettings,
      connectionState: connection.state,
      connectionMessage: connection.message,
    });
    setStatus(`Connected to ${connection.baseUrl}`);
  }

  async function handleSyncNow() {
    if (!state) return;

    setStatus(null);

    try {
      const result = await syncChromeSessions({
        getSettings,
        saveSettings,
        listUnsyncedSessions,
        markSessionsSynced,
      });

      await loadState();
      setStatus(
        result.receivedCount === 0
          ? "No unsynced sessions."
          : `Synced ${result.insertedCount} of ${result.receivedCount} sessions.`,
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Sync failed.",
      );
    }
  }

  if (!state) {
    return (
      <main className="p-5">
        <p className="text-sm text-slate-400">Loading...</p>
      </main>
    );
  }

  const burnout = getBurnoutColor(state.burnout, state.today.activeMinutes);
  const badge = getConnectionBadge(state.connectionState);
  const fragScore = state.today.fragmentationScore.toFixed(2);
  const focusPercent =
    state.today.activeMinutes > 0
      ? Math.round((state.today.productiveMinutes / state.today.activeMinutes) * 100)
      : 0;

  return (
    <main className="space-y-3 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src="/icons/icon-128.png"
            alt="NexusFlow"
            className="h-8 w-8 rounded-lg"
          />
          <span className="text-base font-semibold text-slate-900">NexusFlow</span>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${burnout.bg} ${burnout.text}`}>
          {burnout.label}
        </span>
      </div>

      {/* Burnout hero */}
      <div className={`rounded-2xl p-4 ${burnout.bg}`}>
        <p className="text-xs font-medium uppercase tracking-wider opacity-60">
          Burnout Level
        </p>
        <p className={`mt-1 text-4xl font-bold tracking-tight ${burnout.text}`}>
          {burnout.label}
        </p>
        <p className="mt-2 text-sm opacity-70">{state.burnout.message}</p>
      </div>

      {/* Key metrics - 3 column */}
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Time Today" value={formatClock(state.today.activeMinutes)} />
        <Metric label="Deep Work" value={`${Math.round(state.today.deepWorkMinutes)}m`} />
        <Metric label="Focus" value={`${focusPercent}%`} />
      </div>

      {/* Switch metrics - 2 column */}
      <div className="grid grid-cols-2 gap-2">
        <Metric
          label="Switch Tax"
          value={state.todaySwitchTax.toFixed(1)}
          detail={`${state.today.categorySwitches} switches`}
        />
        <Metric
          label="Fragmentation"
          value={fragScore}
          detail={`${state.todaySessionCount} sessions`}
        />
      </div>

      {/* Focus bar visualization */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-500">Focus Ratio</span>
          <span className="font-semibold text-slate-900">{focusPercent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${Math.min(100, focusPercent)}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-slate-400">
          <span>{Math.round(state.today.productiveMinutes)}m productive</span>
          <span>{Math.round(state.today.activeMinutes - state.today.productiveMinutes)}m other</span>
        </div>
      </div>

      {/* Notifications toggle */}
      <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
        <span className="text-sm font-medium text-slate-700">Burnout alerts</span>
        <button
          type="button"
          role="switch"
          aria-checked={state.settings.notificationsEnabled}
          aria-label="Burnout notifications"
          onClick={handleToggleNotifications}
          className={`flex h-6 w-11 items-center rounded-full p-0.5 transition ${
            state.settings.notificationsEnabled
              ? "bg-emerald-500"
              : "bg-slate-300"
          }`}
        >
          <span
            className={`h-5 w-5 rounded-full bg-white shadow-sm transition ${
              state.settings.notificationsEnabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Export */}
      <button
        type="button"
        onClick={handleExport}
        className="flex w-full items-center justify-between rounded-xl bg-slate-900 px-4 py-3.5 text-left transition hover:bg-slate-800"
      >
        <div>
          <p className="text-sm font-semibold text-white">Export Snapshot</p>
          <p className="text-xs text-slate-400">Download JSON for dashboard import</p>
        </div>
        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          JSON
        </span>
      </button>

      {/* Sync section - collapsible */}
      <div className="rounded-xl border border-slate-100">
        <button
          type="button"
          onClick={() => setShowSync(!showSync)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Sync</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
              {badge.label}
            </span>
            {state.unsyncedSessionCount > 0 ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                {state.unsyncedSessionCount} queued
              </span>
            ) : null}
          </div>
          <svg
            className={`h-4 w-4 text-slate-400 transition ${showSync ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showSync ? (
          <div className="space-y-3 border-t border-slate-100 px-4 py-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-500">API URL</span>
              <input
                type="url"
                value={state.settings.apiBaseUrl}
                onChange={(e) => handleApiBaseUrlChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                placeholder="http://localhost:3001"
              />
            </label>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 py-2">
                <p className="text-lg font-semibold text-slate-900">{state.unsyncedSessionCount}</p>
                <p className="text-[10px] text-slate-500">Queued</p>
              </div>
              <div className="rounded-lg bg-slate-50 py-2">
                <p className="text-lg font-semibold text-slate-900">
                  {state.settings.lastChromeSyncAt ? "Yes" : "Never"}
                </p>
                <p className="text-[10px] text-slate-500">Synced</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveChromeSyncConfig}
                className="flex-1 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Test Connection
              </button>
              <button
                type="button"
                onClick={handleSyncNow}
                className="flex-1 rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Sync Now
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Status message */}
      {status ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-600">
          {status}
        </p>
      ) : null}
    </main>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
      {detail ? <p className="mt-0.5 text-[10px] text-slate-400">{detail}</p> : null}
    </div>
  );
}
