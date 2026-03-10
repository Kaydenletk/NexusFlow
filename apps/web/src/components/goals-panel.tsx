"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import type { Goal, GoalsProgressResponse } from "@quantified-self/contracts";
import { datasetValues, goalMetricCatalog } from "@quantified-self/contracts";

import { getClientApiBaseUrl } from "../lib/api";
import { GoalProgressCard } from "./goal-progress";

type Props = {
  progress: GoalsProgressResponse;
};

const goalMetricOptions = goalMetricCatalog;

type FormState = {
  id: string | null;
  dataset: Goal["dataset"];
  metric: string;
  targetValue: string;
  period: Goal["period"];
};

function getInitialFormState(): FormState {
  return {
    id: null,
    dataset: "coding_activity",
    metric: goalMetricOptions.coding_activity[0],
    targetValue: "",
    period: "week",
  };
}

export function GoalsPanel({ progress }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(getInitialFormState());
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const metricOptions = useMemo(
    () => goalMetricOptions[form.dataset],
    [form.dataset],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);

    try {
      const body = {
        dataset: form.dataset,
        metric: form.metric,
        targetValue: Number(form.targetValue),
        period: form.period,
      };
      const method = form.id ? "PUT" : "POST";
      const path = form.id
        ? `/api/goals/${form.id}`
        : "/api/goals";
      const response = await fetch(`${getClientApiBaseUrl()}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = response.status === 204 ? null : await response.json();

      if (!response.ok) {
        throw new Error(data?.error?.message ?? "Failed to save goal");
      }

      setForm(getInitialFormState());
      setStatus(form.id ? "Goal updated." : "Goal created.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save goal");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setStatus(null);

    try {
      const response = await fetch(`${getClientApiBaseUrl()}/api/goals/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error?.message ?? "Failed to delete goal");
      }

      setStatus("Goal deleted.");
      if (form.id === id) {
        setForm(getInitialFormState());
      }
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }

  function handleEdit(goal: Goal) {
    setForm({
      id: goal.id,
      dataset: goal.dataset,
      metric: goal.metric,
      targetValue: String(goal.targetValue),
      period: goal.period,
    });
  }

  return (
    <div className="space-y-6">
      <form
        className="grid gap-4 rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-panel lg:grid-cols-4"
        onSubmit={handleSubmit}
      >
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-600">
            Domain
          </label>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
            value={form.dataset}
            onChange={(event) => {
              const dataset = event.target.value as Goal["dataset"];
              setForm((current) => ({
                ...current,
                dataset,
                metric: goalMetricOptions[dataset][0],
              }));
            }}
          >
            {datasetValues.map((dataset) => (
              <option key={dataset} value={dataset}>
                {dataset.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-600">
            Metric
          </label>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
            value={form.metric}
            onChange={(event) =>
              setForm((current) => ({ ...current, metric: event.target.value }))
            }
          >
            {metricOptions.map((metric) => (
              <option key={metric} value={metric}>
                {metric}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-600">
            Target value
          </label>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
            type="number"
            min="0"
            step="0.01"
            value={form.targetValue}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                targetValue: event.target.value,
              }))
            }
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-600">
            Period
          </label>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
            value={form.period}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                period: event.target.value as Goal["period"],
              }))
            }
          >
            <option value="day">day</option>
            <option value="week">week</option>
          </select>
        </div>
        <div className="lg:col-span-4 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-aurora disabled:opacity-60"
          >
            {submitting
              ? form.id
                ? "Updating..."
                : "Creating..."
              : form.id
                ? "Update goal"
                : "Create goal"}
          </button>
          {form.id ? (
            <button
              type="button"
              onClick={() => setForm(getInitialFormState())}
              className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600"
            >
              Cancel edit
            </button>
          ) : null}
        </div>
        {status ? (
          <div className="lg:col-span-4 rounded-2xl bg-cloud px-4 py-3 text-sm text-slate-700">
            {status}
          </div>
        ) : null}
      </form>

      <div className="grid gap-4">
        {progress.items.map((item) => (
          <GoalProgressCard
            key={item.goal.id}
            item={item}
            onEdit={() => handleEdit(item.goal)}
            onDelete={handleDelete}
            deletingId={deletingId}
          />
        ))}
      </div>
    </div>
  );
}
