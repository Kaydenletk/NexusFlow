import { Card } from "@tremor/react";
import clsx from "clsx";

import type { HeatmapResponse } from "@quantified-self/contracts";

type Props = {
  heatmap: HeatmapResponse;
};

const intensityClasses = [
  "bg-slate-100",
  "bg-sky-100",
  "bg-teal-200",
  "bg-emerald-300",
  "bg-cyan-500",
];

export function HeatmapCalendar({ heatmap }: Props) {
  return (
    <Card className="border-none shadow-panel">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-ink">Coding heatmap</p>
          <p className="mt-1 text-sm text-slate-500">
            A 365-day rhythm view of your strongest validated signal so far.
          </p>
        </div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          last 365 days
        </p>
      </div>
      <div className="mt-6 grid grid-cols-[repeat(13,minmax(0,1fr))] gap-2">
        {Array.from({ length: Math.ceil(heatmap.items.length / 7) }).map(
          (_, weekIndex) => (
            <div key={weekIndex} className="grid gap-2">
              {heatmap.items
                .slice(weekIndex * 7, weekIndex * 7 + 7)
                .map((cell) => (
                  <div
                    key={cell.date}
                    className={clsx(
                      "h-4 w-4 rounded-[0.35rem] border border-white/70 shadow-sm sm:h-5 sm:w-5",
                      intensityClasses[cell.intensity],
                    )}
                    title={`${cell.date}: ${(cell.valueSeconds / 3600).toFixed(1)}h`}
                  />
                ))}
            </div>
          ),
        )}
      </div>
      <div className="mt-6 flex items-center gap-3 text-xs text-slate-500">
        <span>less</span>
        {intensityClasses.map((intensityClass, index) => (
          <span
            key={index}
            className={clsx(
              "inline-block h-3 w-3 rounded-full border border-white/70",
              intensityClass,
            )}
          />
        ))}
        <span>more</span>
      </div>
    </Card>
  );
}
