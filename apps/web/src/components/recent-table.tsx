import { Card } from "@tremor/react";

import type { RecentResponse } from "@quantified-self/contracts";

import { formatDate, formatNumber } from "../lib/format";

type Props = {
  title: string;
  recent: RecentResponse;
};

export function RecentTable({ title, recent }: Props) {
  return (
    <Card className="border-none shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-ink">{title}</p>
          <p className="mt-1 text-sm text-slate-500">
            Latest entries from {recent.dataset.replaceAll("_", " ")}
          </p>
        </div>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-3 pr-4 font-medium">Time</th>
              <th className="pb-3 pr-4 font-medium">Details</th>
              <th className="pb-3 font-medium">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {recent.items.map((item, index) => (
              <tr key={`${item.id}-${index}`} className="text-slate-700">
                <td className="py-3 pr-4">{formatDate(item.time)}</td>
                <td className="py-3 pr-4">
                  {"project" in item && (
                    <span>
                      {item.project} · {item.language} ·{" "}
                      {formatNumber(item.durationSeconds / 3600)}h
                    </span>
                  )}
                  {"trackName" in item && (
                    <span>
                      {item.trackName} · {item.artist} ·{" "}
                      {formatNumber(item.durationMs / 60000)}m
                    </span>
                  )}
                  {"metricType" in item && (
                    <span>
                      {item.metricType} · {formatNumber(item.value)}
                    </span>
                  )}
                </td>
                <td className="py-3 capitalize">{item.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
