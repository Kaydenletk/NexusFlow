import type { FastifyPluginAsync } from "fastify";
import {
  codingStreaksResponseSchema,
  heatmapQuerySchema,
  heatmapResponseSchema,
} from "@quantified-self/contracts";

import {
  getCodingHeatmap,
  getCodingStreaks,
} from "../services/visualization-service.js";

export const visualizationsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/visualizations/heatmap", async (request, reply) => {
    heatmapQuerySchema.parse(request.query);
    const result = await getCodingHeatmap();

    return reply.send(heatmapResponseSchema.parse(result));
  });

  app.get("/api/visualizations/streaks", async (_request, reply) => {
    const result = await getCodingStreaks();

    return reply.send(codingStreaksResponseSchema.parse(result));
  });
};
