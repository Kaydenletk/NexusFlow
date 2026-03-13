import { FocusDashboard } from "../../components/focus-dashboard";

export default function FocusPage() {
  return (
    <>
      <section>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
          Focus
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-ink">
          Read browsing behavior as a focus signal, not just activity volume
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          Import a snapshot from the Chrome extension to see deep work blocks,
          fragmentation, and burnout risk without sending browsing history to the
          API or database.
        </p>
      </section>

      <FocusDashboard />
    </>
  );
}
