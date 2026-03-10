import { closePool } from "@quantified-self/db";

import { createApp } from "./app.js";
import { env } from "./env.js";
import { startSyncScheduler, stopSyncScheduler } from "./services/sync-scheduler.js";

const app = await createApp();

try {
  await app.listen({
    port: env.PORT,
    host: "0.0.0.0",
  });
  startSyncScheduler();
} catch (error) {
  app.log.error(error);
  await closePool();
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await stopSyncScheduler();
    await app.close();
    await closePool();
    process.exit(0);
  });
}
