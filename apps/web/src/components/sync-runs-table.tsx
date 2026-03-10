import { Badge, Card } from "@tremor/react";

import type { SyncRunsResponse } from "@quantified-self/contracts";

import { formatDate } from "../lib/format";

type Props = {
  data: SyncRunsResponse;
};

export function SyncRunsTable({ data }: Props) {
  return (
    <Card className="border-none shadow-panel">
      <div>
        <p className="text-lg font-semibold text-ink">Sync history</p>
        <p className="mt-1 text-sm text-slate-500">
          Each scheduled or manual sync leaves a run log for auditability.
        </p>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-3 pr-4 font-medium">Provider</th>
              <th className="pb-3 pr-4 font-medium">Status</th>
              <th className="pb-3 pr-4 font-medium">Rows</th>
              <th className="pb-3 pr-4 font-medium">Started</th>
              <th className="pb-3 font-medium">Finished</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.items.map((item) => (
              <tr key={item.id} className="text-slate-700">
                <td className="py-3 pr-4 capitalize">{item.provider}</td>
                <td className="py-3 pr-4">
                  <Badge
                    color={
                      item.status === "completed"
                        ? "emerald"
                        : item.status === "failed"
                          ? "rose"
                          : "amber"
                    }
                  >
                    {item.status}
                  </Badge>
                </td>
                <td className="py-3 pr-4">
                  {item.rowsInserted}/{item.rowsFetched}
                </td>
                <td className="py-3 pr-4">{formatDate(item.startedAt)}</td>
                <td className="py-3">
                  {item.finishedAt ? formatDate(item.finishedAt) : "Running"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
