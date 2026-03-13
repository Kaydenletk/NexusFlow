import type { z } from "zod";

import {
  burnoutAssessmentSchema,
  canvasCourseDailyPointSchema,
  canvasCourseInterruptionSchema,
  canvasCourseReportItemSchema,
  canvasCourseReportSchema,
  burnoutLevelSchema,
  burnoutSignalKeySchema,
  burnoutSignalSchema,
  focusEventReasonSchema,
  categorySummarySchema,
  categoryTransitionSchema,
  dailyFocusMetricsSchema,
  deepWorkBlockSchema,
  focusCategorySchema,
  focusIntentSchema,
  focusSessionSchema,
  focusSnapshotSchema,
  fragmentationHourlyPointSchema,
  fragmentationResultSchema,
  hostSummarySchema,
  normalizedUrlSchema,
} from "./schema.js";

export type FocusCategory = z.infer<typeof focusCategorySchema>;
export type FocusIntent = z.infer<typeof focusIntentSchema>;
export type BurnoutLevel = z.infer<typeof burnoutLevelSchema>;
export type BurnoutSignalKey = z.infer<typeof burnoutSignalKeySchema>;
export type FocusEventReason = z.infer<typeof focusEventReasonSchema>;
export type NormalizedUrl = z.infer<typeof normalizedUrlSchema>;
export type FocusSession = z.infer<typeof focusSessionSchema>;
export type FocusSnapshotV1 = z.infer<typeof focusSnapshotSchema>;
export type FragmentationHourlyPoint = z.infer<
  typeof fragmentationHourlyPointSchema
>;
export type CategoryTransition = z.infer<typeof categoryTransitionSchema>;
export type FragmentationResult = z.infer<typeof fragmentationResultSchema>;
export type DeepWorkBlock = z.infer<typeof deepWorkBlockSchema>;
export type DailyFocusMetrics = z.infer<typeof dailyFocusMetricsSchema>;
export type DailyMetrics = DailyFocusMetrics;
export type BurnoutSignal = z.infer<typeof burnoutSignalSchema>;
export type BurnoutAssessment = z.infer<typeof burnoutAssessmentSchema>;
export type CategorySummary = z.infer<typeof categorySummarySchema>;
export type HostSummary = z.infer<typeof hostSummarySchema>;
export type CanvasCourseDailyPoint = z.infer<typeof canvasCourseDailyPointSchema>;
export type CanvasCourseInterruption = z.infer<
  typeof canvasCourseInterruptionSchema
>;
export type CanvasCourseReportItem = z.infer<
  typeof canvasCourseReportItemSchema
>;
export type CanvasCourseReport = z.infer<typeof canvasCourseReportSchema>;
