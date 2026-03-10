"use client";

import { Card } from "@tremor/react";

import type { GoalProgress } from "@quantified-self/contracts";

type Props = {
  item: GoalProgress;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  deletingId?: string | null;
};

export function GoalProgressCard({
  item,
  onEdit,
  onDelete,
  deletingId,
}: Props) {
  return (
    <Card className="border-none shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
            {item.goal.dataset.replaceAll("_", " ")}
          </p>
          <p className="mt-2 text-xl font-semibold text-ink">{item.goal.metric}</p>
          <p className="mt-1 text-sm text-slate-500">
            {item.goal.period} target: {item.goal.targetValue}
          </p>
        </div>
        <div className="flex gap-2">
          {onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(item.goal.id)}
              className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-aurora hover:text-aurora"
            >
              Edit
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(item.goal.id)}
              disabled={deletingId === item.goal.id}
              className="rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:border-rose-400 disabled:opacity-60"
            >
              {deletingId === item.goal.id ? "Removing..." : "Delete"}
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-6">
        <div className="h-3 overflow-hidden rounded-full bg-cloud">
          <div
            className="h-full rounded-full bg-aurora transition-all"
            style={{ width: `${Math.min(item.percentComplete, 100)}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
          <span>Actual: {item.actualValue}</span>
          <span>{item.percentComplete}% complete</span>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          {item.isComplete
            ? "Target reached for the current window."
            : `${item.remainingValue} remaining in this ${item.goal.period}.`}
        </p>
      </div>
    </Card>
  );
}
