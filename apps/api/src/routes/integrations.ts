import type { FastifyPluginAsync } from "fastify";
import {
  integrationConfigUpsertSchema,
  integrationProviderSchema,
  integrationsResponseSchema,
  manualSyncResultSchema,
  syncRunsQuerySchema,
  syncRunsResponseSchema,
} from "@quantified-self/contracts";

import {
  deleteIntegrationConfig,
  getIntegrationConfigs,
  getSyncRuns,
  triggerSync,
  upsertIntegrationConfig,
} from "../services/integration-service.js";

export const integrationsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/integrations", async (_request, reply) => {
    const result = await getIntegrationConfigs();

    return reply.send(integrationsResponseSchema.parse(result));
  });

  app.put("/api/integrations/:provider", async (request, reply) => {
    const params = integrationProviderSchema.parse((request.params as { provider?: string }).provider);
    const payload = integrationConfigUpsertSchema.parse(request.body);
    const result = await upsertIntegrationConfig(params, payload);

    return reply.send(result);
  });

  app.delete("/api/integrations/:provider", async (request, reply) => {
    const provider = integrationProviderSchema.parse((request.params as { provider?: string }).provider);
    await deleteIntegrationConfig(provider);

    return reply.status(204).send();
  });

  app.post("/api/integrations/:provider/sync", async (request, reply) => {
    const provider = integrationProviderSchema.parse((request.params as { provider?: string }).provider);
    const result = await triggerSync(provider);

    return reply.send(manualSyncResultSchema.parse(result));
  });

  app.get("/api/sync-runs", async (request, reply) => {
    const query = syncRunsQuerySchema.parse(request.query);
    const result = await getSyncRuns(query.provider, query.limit);

    return reply.send(syncRunsResponseSchema.parse(result));
  });
};
