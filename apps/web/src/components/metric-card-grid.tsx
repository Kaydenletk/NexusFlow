import { Card } from "@tremor/react";

import type { SummaryResponse } from "@quantified-self/contracts";

import { formatNumber } from "../lib/format";

type Props = {
  cards: SummaryResponse["cards"];
};

export function MetricCardGrid({ cards }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Object.values(cards).map((card) => (
        <Card key={card.label} className="border-none shadow-panel">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
            {card.label}
          </p>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-4xl font-semibold text-ink">
                {formatNumber(card.value)}
              </p>
              <p className="mt-1 text-sm text-slate-500">{card.unit}</p>
            </div>
            <div className="rounded-full bg-cloud px-3 py-1 text-sm font-semibold text-aurora">
              {card.changePct === null ? "new" : `${card.changePct}%`}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
