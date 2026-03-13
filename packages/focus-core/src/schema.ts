import { z } from "zod";

export const focusCategoryValues = [
  "coding",
  "docs",
  "learning",
  "communication",
  "social",
  "entertainment",
  "search",
  "admin",
  "uncategorized",
] as const;

export const focusIntentValues = [
  "productive",
  "neutral",
  "distracting",
] as const;

export const burnoutLevelValues = ["Safe", "Warning", "Critical"] as const;

export const burnoutSignalKeyValues = [
  "active_time",
  "deep_work",
  "fragmentation",
] as const;
export const focusEventReasonValues = [
  "activated",
  "updated",
  "window_blur",
  "removed",
  "heartbeat",
] as const;

export const focusCategorySchema = z.enum(focusCategoryValues);
export const focusIntentSchema = z.enum(focusIntentValues);
export const burnoutLevelSchema = z.enum(burnoutLevelValues);
export const burnoutSignalKeySchema = z.enum(burnoutSignalKeyValues);
export const focusEventReasonSchema = z.enum(focusEventReasonValues);

export const timestampStringSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid timestamp",
  });

export const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const normalizedUrlSchema = z.object({
  origin: z.string().min(1),
  path: z.string().min(1),
  hostname: z.string().min(1),
});

export const focusSessionSchema = z.object({
  id: z.string().min(1),
  origin: z.string().min(1),
  path: z.string().min(1),
  hostname: z.string().min(1),
  documentTitle: z.string().min(1).nullable().optional(),
  tabId: z.number().int().nullable().optional(),
  windowId: z.number().int().nullable().optional(),
  category: focusCategorySchema,
  intent: focusIntentSchema,
  eventReason: focusEventReasonSchema.optional(),
  isPathMasked: z.boolean().optional(),
  startTime: timestampStringSchema,
  endTime: timestampStringSchema,
  durationSeconds: z.number().int().nonnegative(),
});

export const focusSnapshotSchema = z.object({
  version: z.literal(1),
  exportedAt: timestampStringSchema,
  timezone: z.string().min(1),
  sessions: z.array(focusSessionSchema),
});

export const fragmentationHourlyPointSchema = z.object({
  hour: z.string().regex(/^\d{2}:00$/),
  switches: z.number().int().nonnegative(),
});

export const categoryTransitionSchema = z.object({
  from: focusCategorySchema,
  to: focusCategorySchema,
  count: z.number().int().positive(),
});

export const fragmentationResultSchema = z.object({
  date: localDateSchema,
  totalSwitches: z.number().int().nonnegative(),
  activeHours: z.number().nonnegative(),
  fragmentationScore: z.number().nonnegative(),
  hourly: z.array(fragmentationHourlyPointSchema),
  matrix: z.array(categoryTransitionSchema),
});

export const deepWorkBlockSchema = z.object({
  startTime: timestampStringSchema,
  endTime: timestampStringSchema,
  durationMinutes: z.number().nonnegative(),
  categories: z.array(focusCategorySchema),
});

export const dailyFocusMetricsSchema = z.object({
  date: localDateSchema,
  activeMinutes: z.number().nonnegative(),
  productiveMinutes: z.number().nonnegative(),
  deepWorkMinutes: z.number().nonnegative(),
  shallowWorkMinutes: z.number().nonnegative(),
  fragmentationScore: z.number().nonnegative(),
  categorySwitches: z.number().int().nonnegative(),
});

export const dailyMetricsSchema = dailyFocusMetricsSchema;

export const burnoutSignalSchema = z.object({
  key: burnoutSignalKeySchema,
  triggered: z.boolean(),
  previous: z.number().nonnegative(),
  current: z.number().nonnegative(),
});

export const burnoutWindowSummarySchema = z.object({
  startDate: localDateSchema,
  endDate: localDateSchema,
  averages: z.object({
    activeMinutes: z.number().nonnegative(),
    deepWorkMinutes: z.number().nonnegative(),
    fragmentationScore: z.number().nonnegative(),
  }),
});

export const burnoutAssessmentSchema = z.object({
  level: burnoutLevelSchema,
  warmingUp: z.boolean().default(false),
  message: z.string(),
  signals: z.array(burnoutSignalSchema),
  triggeredSignalKeys: z.array(burnoutSignalKeySchema).default([]),
  currentWindow: burnoutWindowSummarySchema.nullable(),
  previousWindow: burnoutWindowSummarySchema.nullable(),
});

export const categorySummarySchema = z.object({
  category: focusCategorySchema,
  durationMinutes: z.number().nonnegative(),
});

export const hostSummarySchema = z.object({
  hostname: z.string().min(1),
  durationMinutes: z.number().nonnegative(),
});

export const canvasCourseDailyPointSchema = z.object({
  date: localDateSchema,
  durationMinutes: z.number().nonnegative(),
  sessionCount: z.number().int().nonnegative(),
  switchOutCount: z.number().int().nonnegative(),
  distractingSwitchCount: z.number().int().nonnegative(),
});

export const canvasCourseInterruptionSchema = z.object({
  at: timestampStringSchema,
  hostname: z.string().min(1),
  path: z.string().min(1),
  intent: focusIntentSchema,
  durationSeconds: z.number().int().nonnegative(),
  returnedToCourse: z.boolean(),
  returnAt: timestampStringSchema.nullable(),
  fastSwitch: z.boolean(),
});

export const canvasCourseReportItemSchema = z.object({
  courseId: z.string().min(1),
  totalMinutes: z.number().nonnegative(),
  sessionCount: z.number().int().nonnegative(),
  switchOutCount: z.number().int().nonnegative(),
  distractingSwitchCount: z.number().int().nonnegative(),
  fastSwitchCount: z.number().int().nonnegative(),
  returnToCourseCount: z.number().int().nonnegative(),
  returnRate: z.number().min(0).max(1),
  daily: z.array(canvasCourseDailyPointSchema),
  topDistractionHosts: z.array(hostSummarySchema),
  interruptions: z.array(canvasCourseInterruptionSchema),
});

export const canvasCourseReportSchema = z.object({
  fastSwitchThresholdSeconds: z.number().int().positive(),
  totalCanvasMinutes: z.number().nonnegative(),
  totalCourseCount: z.number().int().nonnegative(),
  courses: z.array(canvasCourseReportItemSchema),
});
