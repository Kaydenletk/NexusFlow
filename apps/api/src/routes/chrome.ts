import type { FastifyPluginAsync } from "fastify";
import {
  chromeBulkIngestResponseSchema,
  chromeBulkSessionsSchema,
  chromeCanvasCourseReportSchema,
  chromeCategoriesResponseSchema,
  chromeContextSwitchingResponseSchema,
  chromeHealthResponseSchema,
  chromeHostsResponseSchema,
  chromeOverviewQuerySchema,
  chromeOverviewResponseSchema,
  chromeSessionsQuerySchema,
  chromeSessionsResponseSchema,
  chromeSyncStatusResponseSchema,
  chromeTimelineQuerySchema,
  chromeTimelineResponseSchema,
} from "@quantified-self/contracts";

import {
  getChromeCanvasReport,
  getChromeCategories,
  getChromeContextSwitching,
  getChromeHealth,
  getChromeHosts,
  getChromeOverview,
  getChromeSessions,
  getChromeSyncStatus,
  getChromeTimeline,
  ingestChromeSessions,
} from "../services/chrome-service.js";

export const chromeRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/chrome/sessions/bulk", async (request, reply) => {
    const payload = chromeBulkSessionsSchema.parse(request.body);
    const result = await ingestChromeSessions(payload);

    return reply.status(202).send(chromeBulkIngestResponseSchema.parse(result));
  });

  app.get("/api/chrome/health", async (_request, reply) => {
    const result = await getChromeHealth();

    return reply.send(chromeHealthResponseSchema.parse(result));
  });

  app.get("/api/chrome/overview", async (request, reply) => {
    const query = chromeOverviewQuerySchema.parse(request.query);
    const result = await getChromeOverview(query.range);

    return reply.send(chromeOverviewResponseSchema.parse(result));
  });

  app.get("/api/chrome/sessions", async (request, reply) => {
    const query = chromeSessionsQuerySchema.parse(request.query);
    const result = await getChromeSessions(query.range, query.limit);

    return reply.send(chromeSessionsResponseSchema.parse(result));
  });

  app.get("/api/chrome/timeline", async (request, reply) => {
    const query = chromeTimelineQuerySchema.parse(request.query);
    const result = await getChromeTimeline(query.date);

    return reply.send(chromeTimelineResponseSchema.parse(result));
  });

  app.get("/api/chrome/hosts", async (request, reply) => {
    const query = chromeOverviewQuerySchema.parse(request.query);
    const result = await getChromeHosts(query.range);

    return reply.send(chromeHostsResponseSchema.parse(result));
  });

  app.get("/api/chrome/categories", async (request, reply) => {
    const query = chromeOverviewQuerySchema.parse(request.query);
    const result = await getChromeCategories(query.range);

    return reply.send(chromeCategoriesResponseSchema.parse(result));
  });

  app.get("/api/chrome/context-switching", async (request, reply) => {
    const query = chromeOverviewQuerySchema.parse(request.query);
    const result = await getChromeContextSwitching(query.range);

    return reply.send(chromeContextSwitchingResponseSchema.parse(result));
  });

  app.get("/api/chrome/canvas-report", async (request, reply) => {
    const query = chromeOverviewQuerySchema.parse(request.query);
    const result = await getChromeCanvasReport(query.range);

    return reply.send(chromeCanvasCourseReportSchema.parse(result));
  });

  app.get("/api/chrome/sync-runs", async (_request, reply) => {
    const result = await getChromeSyncStatus();

    return reply.send(chromeSyncStatusResponseSchema.parse(result));
  });
};
