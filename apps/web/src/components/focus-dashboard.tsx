"use client";

import {
  AreaChart,
  BarChart,
  BarList,
  LineChart,
} from "@tremor/react";
import clsx from "clsx";
import {
  focusSnapshotSchema,
  type FocusSnapshotV1,
} from "@nexusflow/focus-core";
import React, {
  useEffect,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import {
  clearStoredFocusSnapshot,
  loadStoredFocusSnapshot,
  saveStoredFocusSnapshot,
} from "../lib/focus-storage";
import { buildFocusDashboardView } from "../lib/focus-view";

type LoadState = {
  snapshot: FocusSnapshotV1 | null;
  loading: boolean;
  status: string | null;
};

type BurnoutTone = ReturnType<typeof buildFocusDashboardView>["burnoutTone"];

export function FocusDashboard() {
  const [state, setState] = useState<LoadState>({
    snapshot: null,
    loading: true,
    status: null,
  });
  const [dragActive, setDragActive] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    void loadSnapshot();
  }, []);

  async function loadSnapshot(status: string | null = null) {
    const snapshot = await loadStoredFocusSnapshot();

    setState({
      snapshot,
      loading: false,
      status,
    });
  }

  async function handleFiles(files: FileList | File[] | null) {
    const file = files?.[0];

    if (!file) {
      return;
    }

    try {
      const rawText = await readFileContents(file);
      const parsed = focusSnapshotSchema.parse(JSON.parse(rawText));
      await saveStoredFocusSnapshot(parsed);
      await loadSnapshot("Snapshot imported.");
    } catch (error) {
      setState((current) => ({
        ...current,
        status:
          error instanceof Error
            ? error.message
            : "Failed to import focus snapshot.",
      }));
    }
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    await handleFiles(event.target.files);
    event.target.value = "";
  }

  async function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragActive(false);
    await handleFiles(event.dataTransfer.files);
  }

  async function handleClear() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }

    setConfirmClear(false);
    await clearStoredFocusSnapshot();
    await loadSnapshot("Snapshot cleared.");
  }

  if (state.loading) {
    return (
      <Card>
        <p className="text-sm text-slate-400">Loading...</p>
      </Card>
    );
  }

  if (!state.snapshot) {
    return (
      <div className="space-y-4">
        <ImportSurface
          dragActive={dragActive}
          onDragActive={setDragActive}
          onDrop={handleDrop}
          onFileChange={onFileChange}
        />
        {state.status ? <StatusChip message={state.status} /> : null}
      </div>
    );
  }

  const view = buildFocusDashboardView(state.snapshot);

  return (
    <div className="space-y-4">
      {/* Top row: Burnout + Import */}
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label>Burnout State</Label>
              <BigValue>{view.burnoutStateLabel}</BigValue>
            </div>
            <BurnoutBadge tone={view.burnoutTone} label={view.burnoutStateLabel} />
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {view.sessionCount} sessions across {view.trackedDayCount} day{view.trackedDayCount === 1 ? "" : "s"}
          </p>
        </Card>

        <ImportSurface
          dragActive={dragActive}
          onDragActive={setDragActive}
          onDrop={handleDrop}
          onFileChange={onFileChange}
          compact
        />
      </div>

      {/* Summary metrics row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {view.summaryCards.map((card) => (
          <Card key={card.label}>
            <Label>{card.label}</Label>
            <BigValue>{card.value}</BigValue>
            <p className="mt-1 text-sm text-slate-500">{card.helper}</p>
          </Card>
        ))}
      </div>

      {/* Latest day highlights */}
      <div className="grid gap-4 sm:grid-cols-3">
        {view.latestDayHighlights.map((item) => (
          <Card key={item.label}>
            <Label>{item.label}</Label>
            <BigValue>{item.value}</BigValue>
          </Card>
        ))}
      </div>

      {/* Burnout trajectory chart */}
      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Burnout Trajectory</CardTitle>
            <BurnoutBadge tone={view.burnoutTone} label={view.burnoutStateLabel} />
          </div>
          {view.burnoutTrend.length > 0 ? (
            <LineChart
              className="mt-4 h-64"
              data={view.burnoutTrend}
              index="date"
              categories={["risk"]}
              colors={["rose"]}
              showAnimation
              valueFormatter={formatBurnoutRisk}
            />
          ) : (
            <EmptyChart />
          )}
        </Card>

        <Card>
          <CardTitle>Signal Breakdown</CardTitle>
          <div className="mt-4 space-y-3">
            {view.burnoutSignals.map((signal) => (
              <div
                key={signal.key}
                className={clsx(
                  "flex items-center justify-between gap-3 rounded-xl px-4 py-3",
                  signal.triggered
                    ? "bg-amber-50 text-amber-800"
                    : "bg-slate-50 text-slate-600",
                )}
              >
                <div>
                  <p className="text-sm font-medium">{signal.label}</p>
                  <p className="text-xs opacity-70">
                    {signal.previousLabel} → {signal.currentLabel}
                  </p>
                </div>
                <span className="text-xs font-semibold">
                  {signal.triggered ? signal.deltaLabel : "Stable"}
                </span>
              </div>
            ))}
          </div>

          {view.burnoutWindows.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {view.burnoutWindows.map((window) => (
                <div
                  key={window.label}
                  className="rounded-xl bg-slate-50 p-4"
                >
                  <p className="text-sm font-medium text-slate-900">{window.label}</p>
                  <p className="text-xs text-slate-500">{window.range}</p>
                  <dl className="mt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Active</dt>
                      <dd className="font-medium text-slate-900">{window.activeTime}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Deep work</dt>
                      <dd className="font-medium text-slate-900">{window.deepWork}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Fragmentation</dt>
                      <dd className="font-medium text-slate-900">{window.fragmentation}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </div>

      {/* Context switching */}
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Context Switching</CardTitle>
            <span className="text-2xl font-semibold text-slate-900">
              {view.summaryCards[1]?.value ?? "0.0"}
            </span>
          </div>
          {view.contextSwitchTrend.length > 0 ? (
            <AreaChart
              className="mt-4 h-64"
              data={view.contextSwitchTrend}
              index="date"
              categories={["switchTax", "fragmentation"]}
              colors={["amber", "rose"]}
              showAnimation
              valueFormatter={(value: number) => value.toFixed(1)}
            />
          ) : (
            <EmptyChart />
          )}
        </Card>

        <Card>
          <CardTitle>Transition Heatmap</CardTitle>
          <div className="mt-4">
            <TransitionMatrix view={view} />
          </div>
          {view.transitionHighlights.length > 0 ? (
            <div className="mt-4 space-y-2">
              {view.transitionHighlights.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5"
                >
                  <span className="text-sm text-slate-600">{item.label}</span>
                  <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </div>

      {/* Hourly rhythm + domains + categories */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle>Hourly Switches</CardTitle>
          <p className="mt-1 text-xs text-slate-400">{view.latestDateLabel}</p>
          {view.latestHourlySwitches.some((item) => item.switches > 0) ? (
            <BarChart
              className="mt-4 h-52"
              data={view.latestHourlySwitches}
              index="hour"
              categories={["switches"]}
              colors={["amber"]}
              showAnimation
            />
          ) : (
            <EmptyChart />
          )}
        </Card>

        <Card>
          <CardTitle>Top Domains</CardTitle>
          {view.topHosts.length > 0 ? (
            <BarList
              className="mt-4"
              data={view.topHosts}
              valueFormatter={(value: number) => `${value.toFixed(1)}h`}
            />
          ) : (
            <EmptyChart />
          )}
        </Card>

        <Card>
          <CardTitle>Category Mix</CardTitle>
          {view.categoryBreakdown.length > 0 ? (
            <BarList
              className="mt-4"
              data={view.categoryBreakdown}
              valueFormatter={(value: number) => `${value.toFixed(1)}h`}
            />
          ) : (
            <EmptyChart />
          )}
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleClear}
          className={clsx(
            "rounded-full px-5 py-2.5 text-sm font-medium transition",
            confirmClear
              ? "bg-red-500 text-white hover:bg-red-600"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200",
          )}
        >
          {confirmClear ? "Confirm clear?" : "Clear snapshot"}
        </button>
        {confirmClear ? (
          <button
            type="button"
            onClick={() => setConfirmClear(false)}
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            Cancel
          </button>
        ) : null}
        {state.status ? <StatusChip message={state.status} /> : null}
      </div>
    </div>
  );
}

function readFileContents(file: File) {
  if (typeof file.text === "function") {
    return file.text();
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsText(file);
  });
}

type ImportSurfaceProps = {
  dragActive: boolean;
  onDragActive: (value: boolean) => void;
  onDrop: (event: DragEvent<HTMLLabelElement>) => Promise<void>;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  compact?: boolean;
};

function ImportSurface({
  dragActive,
  onDragActive,
  onDrop,
  onFileChange,
  compact,
}: ImportSurfaceProps) {
  return (
    <label
      className={clsx(
        "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition",
        compact ? "gap-2" : "gap-3",
        dragActive
          ? "border-teal-400 bg-teal-50/50"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50",
      )}
      onDragEnter={() => onDragActive(true)}
      onDragOver={(event) => {
        event.preventDefault();
        onDragActive(true);
      }}
      onDragLeave={() => onDragActive(false)}
      onDrop={onDrop}
    >
      <input
        className="sr-only"
        type="file"
        accept="application/json"
        aria-label="Upload snapshot"
        onChange={onFileChange}
      />
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
        <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-600">
        {compact ? "Replace snapshot" : "Drop snapshot JSON or click to browse"}
      </p>
      <p className="text-xs text-slate-400">
        Local only — nothing leaves your browser
      </p>
    </label>
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

function BurnoutBadge({
  tone,
  label,
}: {
  tone: BurnoutTone;
  label: string;
}) {
  return (
    <span
      className={clsx(
        "rounded-full px-3 py-1 text-xs font-semibold",
        getBurnoutToneClasses(tone),
      )}
    >
      {label}
    </span>
  );
}

function StatusChip({ message }: { message: string }) {
  return (
    <p className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
      {message}
    </p>
  );
}

function EmptyChart() {
  return (
    <div className="mt-4 flex h-32 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">
      No data yet
    </div>
  );
}

function TransitionMatrix({
  view,
}: {
  view: ReturnType<typeof buildFocusDashboardView>;
}) {
  if (view.matrixCategories.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">
        No transitions detected
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[480px] gap-1.5"
        style={{
          gridTemplateColumns: `minmax(100px,auto) repeat(${view.matrixCategories.length}, minmax(48px,1fr))`,
        }}
      >
        <div />
        {view.matrixCategories.map((category) => (
          <div
            key={`to-${category}`}
            className="px-1 text-center text-[10px] font-medium uppercase tracking-wider text-slate-400"
          >
            {category.replaceAll("_", " ")}
          </div>
        ))}

        {view.matrixCategories.map((from) => (
          <React.Fragment key={from}>
            <div className="flex items-center rounded-lg bg-slate-50 px-2 py-2 text-xs font-medium text-slate-700">
              {from.replaceAll("_", " ")}
            </div>
            {view.matrixCategories.map((to) => {
              const value = view.getMatrixValue(from, to);

              return (
                <div
                  key={`${from}-${to}`}
                  title={`${from} → ${to}: ${value}`}
                  className={clsx(
                    "flex min-h-[40px] items-center justify-center rounded-lg text-xs font-medium",
                    getMatrixCellClass(value, view.matrixMax),
                  )}
                >
                  {value}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function getBurnoutToneClasses(tone: BurnoutTone) {
  if (tone === "critical") {
    return "bg-red-100 text-red-700";
  }

  if (tone === "warning") {
    return "bg-amber-100 text-amber-700";
  }

  if (tone === "safe") {
    return "bg-emerald-100 text-emerald-700";
  }

  return "bg-slate-100 text-slate-600";
}

function getMatrixCellClass(value: number, maxValue: number) {
  if (value === 0 || maxValue === 0) {
    return "bg-slate-50 text-slate-300";
  }

  const ratio = value / maxValue;

  if (ratio >= 0.75) {
    return "bg-rose-100 text-rose-800";
  }

  if (ratio >= 0.5) {
    return "bg-orange-100 text-orange-800";
  }

  if (ratio >= 0.25) {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-amber-50 text-amber-700";
}

function formatBurnoutRisk(value: number) {
  if (value === 3) {
    return "Critical";
  }

  if (value === 2) {
    return "Warning";
  }

  if (value === 1) {
    return "Safe";
  }

  return "Warm-up";
}
