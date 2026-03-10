import type { FastifyPluginAsync } from "fastify";
import {
  codingActivityQuerySchema,
  codingActivitySeriesResponseSchema,
  defaultHealthMetricType,
  healthMetricQuerySchema,
  healthMetricSeriesResponseSchema,
  importsQuerySchema,
  importsResponseSchema,
  listeningHistoryQuerySchema,
  listeningHistorySeriesResponseSchema,
  recentQuerySchema,
  recentResponseSchema,
  summaryQuerySchema,
  summaryResponseSchema,
} from "@quantified-self/contracts";

import {
  getCodingActivitySeries,
  getHealthMetricSeries,
  getImportBatches,
  getListeningHistorySeries,
  getRecentItems,
  getSummary,
} from "../services/analytics-service.js";

export const analyticsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

  app.get("/api/summary", async (request, reply) => {
    const query = summaryQuerySchema.parse(request.query);
    const result = await getSummary(query.range);

    return reply.send(summaryResponseSchema.parse(result));
  });

  app.get("/api/coding-activity", async (request, reply) => {
    const query = codingActivityQuerySchema.parse(request.query);
    const result = await getCodingActivitySeries(query.range, query.bucket);

    return reply.send(codingActivitySeriesResponseSchema.parse(result));
  });

  app.get("/api/listening-history", async (request, reply) => {
    const query = listeningHistoryQuerySchema.parse(request.query);
    const result = await getListeningHistorySeries(query.range, query.bucket);

    return reply.send(listeningHistorySeriesResponseSchema.parse(result));
  });

  app.get("/api/health-metrics", async (request, reply) => {
    const rawQuery =
      typeof request.query === "object" && request.query
        ? { ...request.query, metricType: (request.query as any).metricType ?? defaultHealthMetricType }
        : { metricType: defaultHealthMetricType };
    const query = healthMetricQuerySchema.parse(rawQuery);
    const result = await getHealthMetricSeries(
      query.range,
      query.bucket,
      query.metricType,
    );

    return reply.send(healthMetricSeriesResponseSchema.parse(result));
  });

  app.get("/api/recent", async (request, reply) => {
    const query = recentQuerySchema.parse(request.query);
    const result = await getRecentItems(query.dataset, query.limit);

    return reply.send(recentResponseSchema.parse(result));
  });

  app.get("/api/imports", async (request, reply) => {
    const query = importsQuerySchema.parse(request.query);
    const result = await getImportBatches(query.limit);

    return reply.send(importsResponseSchema.parse(result));
  });
};
