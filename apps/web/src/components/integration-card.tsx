"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Card } from "@tremor/react";

import type { IntegrationConfig } from "@quantified-self/contracts";

import { getClientApiBaseUrl } from "../lib/api";

type Props = {
  integration: IntegrationConfig;
};

export function IntegrationCard({ integration }: Props) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(integration.enabled);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"save" | "sync" | null>(null);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting("save");
    setStatus(null);

    try {
      const response = await fetch(
        `${getClientApiBaseUrl()}/api/integrations/${integration.provider}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            enabled,
            credentials: {
              apiKey,
            },
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message ?? "Failed to save integration");
      }

      setApiKey("");
      setStatus("Integration saved.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleSync() {
    setSubmitting("sync");
    setStatus(null);

    try {
      const response = await fetch(
        `${getClientApiBaseUrl()}/api/integrations/${integration.provider}/sync`,
        {
          method: "POST",
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message ?? "Failed to sync integration");
      }

      setStatus(
        `Sync completed. Inserted ${data.batch.rowsInserted} of ${data.batch.rowsReceived} row(s).`,
      );
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to sync");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <Card className="border-none shadow-panel">
      <div className="flex flex-col gap-2">
        <p className="text-lg font-semibold text-ink">WakaTime</p>
        <p className="text-sm text-slate-500">
          Connect the first validated rhythm signal for NexusFlow: your coding activity.
        </p>
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSave}>
        <div>
          <label
            htmlFor="wakatime-api-key"
            className="mb-2 block text-sm font-semibold text-slate-600"
          >
            API key
          </label>
          <input
            id="wakatime-api-key"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-aurora"
            type="password"
            placeholder={
              integration.credentials.hasApiKey
                ? `Stored key: ${integration.credentials.apiKeyPreview}`
                : "Paste your WakaTime API key"
            }
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
          />
        </div>
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-cloud px-4 py-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          Enable scheduled sync every 4 hours
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting !== null}
            className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-aurora disabled:opacity-60"
          >
            {submitting === "save" ? "Saving..." : "Save settings"}
          </button>
          <button
            type="button"
            disabled={submitting !== null}
            onClick={() => void handleSync()}
            className="rounded-full border border-aurora/30 bg-white px-5 py-3 text-sm font-semibold text-aurora transition hover:border-aurora disabled:opacity-60"
          >
            {submitting === "sync" ? "Syncing..." : "Sync now"}
          </button>
        </div>
      </form>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Enabled
          </p>
          <p className="mt-2 text-lg font-semibold text-ink">
            {integration.enabled ? "Yes" : "No"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Last synced
          </p>
          <p className="mt-2 text-lg font-semibold text-ink">
            {integration.lastSyncedAt ?? "Not yet"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Last error
          </p>
          <p className="mt-2 text-sm font-medium text-rose-600">
            {integration.lastError ?? "None"}
          </p>
        </div>
      </div>

      {status ? (
        <div className="mt-6 rounded-2xl bg-cloud px-4 py-3 text-sm text-slate-700">
          {status}
        </div>
      ) : null}
    </Card>
  );
}
