import { ImportPanel } from "../../components/import-panels";
import { ImportsTable } from "../../components/imports-table";
import { fetchImports } from "../../lib/api";

export default async function ImportsPage() {
  const imports = await fetchImports(20);

  return (
    <>
      <section>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
          Data Ingestion
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-ink">
          Add individual events or replay CSV histories
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          Manual inserts help with quick edits, while CSV uploads handle bulk
          backfills. Every run leaves an import batch trail for debugging.
        </p>
      </section>

      <div className="grid gap-6">
        <ImportPanel
          datasetPath="coding-activity"
          title="Coding activity"
          description="Log projects, languages, and duration in seconds."
          manualFields={[
            { name: "project", label: "Project", type: "text" },
            { name: "language", label: "Language", type: "text" },
            {
              name: "durationSeconds",
              label: "Duration (seconds)",
              type: "number",
              step: "1",
            },
          ]}
        />
        <ImportPanel
          datasetPath="listening-history"
          title="Listening history"
          description="Capture track, artist, and duration in milliseconds."
          manualFields={[
            { name: "trackName", label: "Track name", type: "text" },
            { name: "artist", label: "Artist", type: "text" },
            {
              name: "durationMs",
              label: "Duration (ms)",
              type: "number",
              step: "1",
            },
          ]}
        />
        <ImportPanel
          datasetPath="health-metrics"
          title="Health metrics"
          description="Track values such as heart rate or steps."
          manualFields={[
            { name: "metricType", label: "Metric type", type: "text" },
            { name: "value", label: "Value", type: "number", step: "0.01" },
          ]}
        />
      </div>

      <ImportsTable data={imports} />
    </>
  );
}
