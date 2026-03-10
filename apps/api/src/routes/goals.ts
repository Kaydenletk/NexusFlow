import type { FastifyPluginAsync } from "fastify";
import {
  goalCreateSchema,
  goalUpdateSchema,
  goalsProgressQuerySchema,
  goalsProgressResponseSchema,
  goalsResponseSchema,
} from "@quantified-self/contracts";

import {
  createGoal,
  deleteGoal,
  getGoalProgress,
  getGoals,
  updateGoal,
} from "../services/goal-service.js";

export const goalsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/goals", async (_request, reply) => {
    const result = await getGoals();

    return reply.send(goalsResponseSchema.parse(result));
  });

  app.post("/api/goals", async (request, reply) => {
    const payload = goalCreateSchema.parse(request.body);
    const result = await createGoal(payload);

    return reply.status(201).send(result);
  });

  app.put("/api/goals/:id", async (request, reply) => {
    const payload = goalUpdateSchema.parse(request.body);
    const id = (request.params as { id?: string }).id ?? "";
    const result = await updateGoal(id, payload);

    return reply.send(result);
  });

  app.delete("/api/goals/:id", async (request, reply) => {
    const id = (request.params as { id?: string }).id ?? "";
    await deleteGoal(id);

    return reply.status(204).send();
  });

  app.get("/api/goals/progress", async (request, reply) => {
    const query = goalsProgressQuerySchema.parse(request.query);
    const result = await getGoalProgress(query.dataset);

    return reply.send(goalsProgressResponseSchema.parse(result));
  });
};
