"use client";

import React, { useMemo, useState, type FormEvent } from "react";
import { Card } from "@tremor/react";

type ManualField = {
  name: string;
  label: string;
  type: "text" | "number";
  step?: string;
};

type ImportPanelProps = {
  datasetPath: "coding-activity" | "listening-history" | "health-metrics";
  title: string;
  description: string;
  manualFields: ManualField[];
};

type ImportResultState =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
}

function defaultDateTimeLocal() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function ImportPanel({
  datasetPath,
  title,
  description,
  manualFields,
}: ImportPanelProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ImportResultState>({ kind: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const initialManualState = useMemo(() => {
    const values = Object.fromEntries(
      manualFields.map((field) => [field.name, ""]),
    ) as Record<string, string>;

    return {
      time: defaultDateTimeLocal(),
      ...values,
    };
  }, [manualFields]);
  const [manualState, setManualState] =
    useState<Record<string, string>>(initialManualState);

  async function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus({ kind: "idle" });

    try {
      const payload = Object.fromEntries(
        Object.entries(manualState).map(([key, value]) => {
          if (key === "time") {
            return [key, new Date(value).toISOString()];
          }

          const field = manualFields.find((item) => item.name === key);
          return [key, field?.type === "number" ? Number(value) : value];
        }),
      );
      const response = await fetch(
        `${getApiBaseUrl()}/api/imports/${datasetPath}/manual`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message ?? "Manual import failed");
      }

      setStatus({
        kind: "success",
        message: `Inserted ${data.batch.rowsInserted} row(s), skipped ${data.batch.rowsSkipped}.`,
      });
      setManualState(initialManualState);
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Manual import failed",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCsvSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!csvFile) {
      setStatus({ kind: "error", message: "Choose a CSV file first." });
      return;
    }

    setSubmitting(true);
    setStatus({ kind: "idle" });

    try {
      const formData = new FormData();
      formData.append("file", csvFile);
      const response = await fetch(
        `${getApiBaseUrl()}/api/imports/${datasetPath}/csv`,
        {
          method: "POST",
          body: formData,
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message ?? "CSV import failed");
      }

      setStatus({
        kind: "success",
        message: `Imported ${data.batch.rowsInserted} of ${data.batch.rowsReceived} row(s).`,
      });
      setCsvFile(null);
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "CSV import failed",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-none shadow-panel">
      <div className="flex flex-col gap-2">
        <p className="text-lg font-semibold text-ink">{title}</p>
        <p className="text-sm text-slate-500">{description}</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <form className="space-y-4" onSubmit={handleManualSubmit}>
          <div>
          <label
            htmlFor={`${datasetPath}-time`}
            className="mb-2 block text-sm font-semibold text-slate-600"
          >
            Time
          </label>
          <input
            id={`${datasetPath}-time`}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none ring-0 transition focus:border-aurora"
            type="datetime-local"
              value={manualState.time ?? ""}
              onChange={(event) =>
                setManualState((current) => ({
                  ...current,
                  time: event.target.value,
                }))
              }
            />
          </div>
          {manualFields.map((field) => (
            <div key={field.name}>
              <label
                htmlFor={`${datasetPath}-${field.name}`}
                className="mb-2 block text-sm font-semibold text-slate-600"
              >
                {field.label}
              </label>
              <input
                id={`${datasetPath}-${field.name}`}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none ring-0 transition focus:border-aurora"
                type={field.type}
                step={field.step}
                value={manualState[field.name] ?? ""}
                onChange={(event) =>
                  setManualState((current) => ({
                    ...current,
                    [field.name]: event.target.value,
                  }))
                }
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-aurora disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Add manual entry"}
          </button>
        </form>

        <form className="space-y-4" onSubmit={handleCsvSubmit}>
          <label
            htmlFor={`${datasetPath}-csv`}
            className="block text-sm font-semibold text-slate-600"
          >
            CSV file
          </label>
          <input
            id={`${datasetPath}-csv`}
            className="w-full rounded-2xl border border-dashed border-slate-300 bg-cloud px-4 py-8 text-sm text-slate-600"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full border border-aurora/25 bg-aurora px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink disabled:opacity-60"
          >
            {submitting ? "Uploading..." : "Upload CSV"}
          </button>
        </form>
      </div>

      {status.kind !== "idle" && (
        <div
          className={`mt-6 rounded-2xl px-4 py-3 text-sm ${
            status.kind === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {status.message}
        </div>
      )}
    </Card>
  );
}
