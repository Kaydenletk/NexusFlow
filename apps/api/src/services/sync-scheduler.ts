import cron from "node-cron";
import { eq } from "drizzle-orm";
import { getDb, integrationConfigs } from "@quantified-self/db";

import { runWakaTimeSync } from "./wakatime-service.js";

let task: cron.ScheduledTask | undefined;

async function syncEnabledIntegrations() {
  const db = getDb();
  const configs = await db
    .select()
    .from(integrationConfigs)
    .where(eq(integrationConfigs.enabled, true));

  for (const config of configs) {
    if (config.provider !== "wakatime") {
      continue;
    }

    try {
      await runWakaTimeSync(config);
    } catch (error) {
      console.error(`Scheduled sync failed for ${config.provider}`, error);
    }
  }
}

export function startSyncScheduler() {
  if (task) {
    return task;
  }

  task = cron.schedule("0 */4 * * *", () => {
    void syncEnabledIntegrations();
  });

  return task;
}

export async function stopSyncScheduler() {
  if (!task) {
    return;
  }

  task.stop();
  await task.destroy();
  task = undefined;
}
