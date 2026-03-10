import { GoalsPanel } from "../../components/goals-panel";
import { StreakCounter } from "../../components/streak-counter";
import { fetchGoalProgress, fetchStreaks } from "../../lib/api";

export default async function GoalsPage() {
  const [progress, streaks] = await Promise.all([
    fetchGoalProgress(),
    fetchStreaks(),
  ]);

  return (
    <>
      <section>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
          Goals
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-ink">
          Turn raw activity into a target you can actually hold
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          Goals translate time-series data into momentum. Start with coding rhythm
          now, then expand the platform later as NexusFlow grows into a broader
          student-life intelligence layer.
        </p>
      </section>

      <StreakCounter streaks={streaks} />
      <GoalsPanel progress={progress} />
    </>
  );
}
