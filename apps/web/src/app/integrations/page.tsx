import { IntegrationCard } from "../../components/integration-card";
import { SyncRunsTable } from "../../components/sync-runs-table";
import { fetchIntegrations, fetchSyncRuns } from "../../lib/api";

export default async function IntegrationsPage() {
  const [integrations, syncRuns] = await Promise.all([
    fetchIntegrations(),
    fetchSyncRuns(20),
  ]);
  const wakatime = integrations.items[0] ?? {
    provider: "wakatime" as const,
    enabled: false,
    credentials: {
      apiKeyPreview: "",
      hasApiKey: false,
    },
    syncCursor: null,
    lastSyncedAt: null,
    lastError: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };

  return (
    <>
      <section>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
          Integrations
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-ink">
          Connect the first validated signal behind your daily rhythm
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          Phase 1 starts with WakaTime because it provides the cleanest, lowest-friction
          stream of structured activity data. Save your key, enable scheduled sync,
          and let NexusFlow turn coding activity into progress and rhythm views.
        </p>
      </section>

      <IntegrationCard integration={wakatime} />
      <SyncRunsTable data={syncRuns} />
    </>
  );
}
