import { Badge, Card } from "@tremor/react";

import type { ImportsResponse } from "@quantified-self/contracts";

import { formatDate } from "../lib/format";

type Props = {
  data: ImportsResponse;
};

export function ImportsTable({ data }: Props) {
  return (
    <Card className="border-none shadow-panel">
      <div>
        <p className="text-lg font-semibold text-ink">Recent import batches</p>
        <p className="mt-1 text-sm text-slate-500">
          Successful and failed sync attempts stay visible for debugging.
        </p>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="pb-3 pr-4 font-medium">Dataset</th>
              <th className="pb-3 pr-4 font-medium">Status</th>
              <th className="pb-3 pr-4 font-medium">Rows</th>
              <th className="pb-3 pr-4 font-medium">File</th>
              <th className="pb-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.items.map((item) => (
              <tr key={item.id} className="text-slate-700">
                <td className="py-3 pr-4 capitalize">
                  {item.dataset.replaceAll("_", " ")}
                </td>
                <td className="py-3 pr-4">
                  <Badge color={item.status === "completed" ? "emerald" : "rose"}>
                    {item.status}
                  </Badge>
                </td>
                <td className="py-3 pr-4">
                  {item.rowsInserted}/{item.rowsReceived}
                </td>
                <td className="py-3 pr-4">{item.filename ?? "manual entry"}</td>
                <td className="py-3">{formatDate(item.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
