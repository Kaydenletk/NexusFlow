import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";

import { env } from "./env.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { chromeRoutes } from "./routes/chrome.js";
import { goalsRoutes } from "./routes/goals.js";
import { integrationsRoutes } from "./routes/integrations.js";
import { importsRoutes } from "./routes/imports.js";
import { errorHandlerPlugin } from "./plugins/error-handler.js";
import { visualizationsRoutes } from "./routes/visualizations.js";

export async function createApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
  });

  await app.register(cors, {
    origin: true,
  });
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1,
    },
  });
  await app.register(errorHandlerPlugin);
  await app.register(importsRoutes);
  await app.register(analyticsRoutes);
  await app.register(chromeRoutes);
  await app.register(integrationsRoutes);
  await app.register(goalsRoutes);
  await app.register(visualizationsRoutes);

  return app;
}
