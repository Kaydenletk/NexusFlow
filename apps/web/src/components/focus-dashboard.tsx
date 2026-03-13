"use client";

import { BarChart, BarList, Card, LineChart } from "@tremor/react";
import { focusSnapshotSchema, type FocusSnapshotV1 } from "@quantified-self/focus-core";
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

export function FocusDashboard() {
  const [state, setState] = useState<LoadState>({
    snapshot: null,
    loading: true,
    status: null,
  });
  const [dragActive, setDragActive] = useState(false);

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
    await clearStoredFocusSnapshot();
    await loadSnapshot("Stored snapshot cleared.");
  }

  if (state.loading) {
    return (
      <Card className="border-none shadow-panel">
        <p className="text-sm font-semibold text-slate-500">Loading local focus data...</p>
      </Card>
    );
  }

  if (!state.snapshot) {
    return (
      <div className="space-y-6">
        <ImportSurface
          dragActive={dragActive}
          onDragActive={setDragActive}
          onDrop={handleDrop}
          onFileChange={onFileChange}
        />
        <Card className="border-none shadow-panel">
          <p className="text-lg font-semibold text-ink">No focus snapshot yet</p>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Export a JSON snapshot from the Chrome extension popup and drop it here.
            NexusFlow will persist the latest import in browser IndexedDB and keep
            this page independent from the backend API.
          </p>
          {state.status ? (
            <p className="mt-4 text-sm text-slate-600">{state.status}</p>
          ) : null}
        </Card>
      </div>
    );
  }

  const view = buildFocusDashboardView(state.snapshot);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        {view.summaryCards.map((card) => (
          <Card key={card.label} className="border-none shadow-panel">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
              {card.label}
            </p>
            <p className="mt-4 text-3xl font-semibold text-ink">{card.value}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="border-none shadow-panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-ink">Deep vs shallow work</p>
              <p className="mt-2 text-sm text-slate-500">
                Latest snapshot exported {view.exportedAtLabel} in {view.timezone}.
              </p>
            </div>
            <div className="text-right text-sm text-slate-500">
              <p>{view.sessionCount} finalized sessions</p>
              <p>{view.latestDateLabel} latest tracked day</p>
            </div>
          </div>
          <BarChart
            className="mt-6 h-72"
            data={view.deepWorkTrend}
            index="date"
            categories={["deepWork", "shallowWork"]}
            colors={["teal", "amber"]}
            stack
            showAnimation
            valueFormatter={(value: number) => `${value.toFixed(1)}h`}
          />
        </Card>
        <Card className="border-none shadow-panel">
          <p className="text-lg font-semibold text-ink">Burnout trend</p>
          <p className="mt-2 text-sm text-slate-500">{view.burnout.message}</p>
          <LineChart
            className="mt-6 h-72"
            data={view.burnoutTrend}
            index="date"
            categories={["risk"]}
            colors={["rose"]}
            showAnimation
            valueFormatter={(value: number) =>
              value === 3
                ? "critical"
                : value === 2
                  ? "warning"
                  : value === 1
                    ? "safe"
                    : "warming up"
            }
          />
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
        <Card className="border-none shadow-panel">
          <p className="text-lg font-semibold text-ink">Context-switching matrix</p>
          <p className="mt-2 text-sm text-slate-500">
            Latest-day transition counts between observed categories.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-slate-500">From / To</th>
                  {view.matrixCategories.map((category) => (
                    <th
                      key={category}
                      className="px-3 py-2 text-left text-slate-500"
                    >
                      {category.replaceAll("_", " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.matrixCategories.map((from) => (
                  <tr key={from} className="border-t border-slate-100">
                    <th className="px-3 py-3 text-left font-semibold text-ink">
                      {from.replaceAll("_", " ")}
                    </th>
                    {view.matrixCategories.map((to) => (
                      <td key={`${from}-${to}`} className="px-3 py-3 text-slate-600">
                        {view.getMatrixValue(from, to)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="border-none shadow-panel">
          <p className="text-lg font-semibold text-ink">Top domains</p>
          <BarList
            className="mt-6"
            data={view.topHosts}
            valueFormatter={(value: number) => `${value.toFixed(1)}h`}
          />
        </Card>
        <Card className="border-none shadow-panel">
          <p className="text-lg font-semibold text-ink">Top categories</p>
          <BarList
            className="mt-6"
            data={view.categoryBreakdown}
            valueFormatter={(value: number) => `${value.toFixed(1)}h`}
          />
        </Card>
      </section>

      <section className="space-y-4">
        <ImportSurface
          dragActive={dragActive}
          onDragActive={setDragActive}
          onDrop={handleDrop}
          onFileChange={onFileChange}
        />
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleClear}
            className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600"
          >
            Clear stored snapshot
          </button>
          {state.status ? (
            <p className="rounded-full bg-cloud px-4 py-3 text-sm text-slate-600">
              {state.status}
            </p>
          ) : null}
        </div>
      </section>
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
};

function ImportSurface({
  dragActive,
  onDragActive,
  onDrop,
  onFileChange,
}: ImportSurfaceProps) {
  return (
    <label
      className={`block cursor-pointer rounded-[2rem] border border-dashed p-8 transition ${
        dragActive
          ? "border-aurora bg-white shadow-panel"
          : "border-slate-300 bg-white/70"
      }`}
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
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
        Import a focus snapshot
      </p>
      <h3 className="mt-3 text-2xl font-semibold text-ink">
        Drag in the extension export or click to browse
      </h3>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
        The uploaded JSON stays in this browser. NexusFlow validates the snapshot
        locally, stores it in IndexedDB, and renders the focus analytics client-side.
      </p>
    </label>
  );
}
