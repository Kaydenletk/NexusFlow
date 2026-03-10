import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import {
  codingActivityManualSchema,
  healthMetricManualSchema,
  importResultSchema,
  listeningHistoryManualSchema,
} from "@quantified-self/contracts";

import { AppError } from "../lib/errors.js";
import {
  importCodingActivityCsv,
  importCodingActivityManual,
  importHealthMetricManual,
  importHealthMetricsCsv,
  importListeningHistoryCsv,
  importListeningHistoryManual,
} from "../services/import-service.js";

async function readMultipartFile(request: FastifyRequest) {
  const file = await request.file();

  if (!file) {
    throw new AppError(400, "FILE_REQUIRED", "A CSV file is required");
  }

  const buffer = await file.toBuffer();
  return {
    buffer,
    filename: file.filename,
  };
}

export const importsRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/imports/coding-activity/manual", async (request, reply) => {
    const payload = codingActivityManualSchema.parse(request.body);
    const result = await importCodingActivityManual(payload);

    return reply.send(importResultSchema.parse(result));
  });

  app.post("/api/imports/listening-history/manual", async (request, reply) => {
    const payload = listeningHistoryManualSchema.parse(request.body);
    const result = await importListeningHistoryManual(payload);

    return reply.send(importResultSchema.parse(result));
  });

  app.post("/api/imports/health-metrics/manual", async (request, reply) => {
    const payload = healthMetricManualSchema.parse(request.body);
    const result = await importHealthMetricManual(payload);

    return reply.send(importResultSchema.parse(result));
  });

  app.post("/api/imports/coding-activity/csv", async (request, reply) => {
    const { buffer, filename } = await readMultipartFile(request);
    const result = await importCodingActivityCsv(buffer, filename);

    return reply.send(importResultSchema.parse(result));
  });

  app.post("/api/imports/listening-history/csv", async (request, reply) => {
    const { buffer, filename } = await readMultipartFile(request);
    const result = await importListeningHistoryCsv(buffer, filename);

    return reply.send(importResultSchema.parse(result));
  });

  app.post("/api/imports/health-metrics/csv", async (request, reply) => {
    const { buffer, filename } = await readMultipartFile(request);
    const result = await importHealthMetricsCsv(buffer, filename);

    return reply.send(importResultSchema.parse(result));
  });
};
