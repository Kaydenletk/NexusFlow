import { Card } from "@tremor/react";

import type { CodingStreaksResponse } from "@quantified-self/contracts";

type Props = {
  streaks: CodingStreaksResponse;
};

export function StreakCounter({ streaks }: Props) {
  return (
    <Card className="border-none shadow-panel">
      <p className="text-lg font-semibold text-ink">Current rhythm</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
            Current streak
          </p>
          <p className="mt-2 text-3xl font-semibold text-ink">
            {streaks.currentStreak} days
          </p>
        </div>
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
            Longest streak
          </p>
          <p className="mt-2 text-3xl font-semibold text-ink">
            {streaks.longestStreak} days
          </p>
        </div>
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
            Last active
          </p>
          <p className="mt-2 text-lg font-semibold text-ink">
            {streaks.lastActiveDate ?? "No coding yet"}
          </p>
        </div>
      </div>
    </Card>
  );
}
