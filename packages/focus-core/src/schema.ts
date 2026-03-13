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

export const burnoutLevelValues = [
  "warming_up",
  "safe",
  "warning",
  "critical",
] as const;

export const burnoutSignalKeyValues = [
  "active_time",
  "deep_work",
  "fragmentation",
] as const;

export const focusCategorySchema = z.enum(focusCategoryValues);
export const focusIntentSchema = z.enum(focusIntentValues);
export const burnoutLevelSchema = z.enum(burnoutLevelValues);
export const burnoutSignalKeySchema = z.enum(burnoutSignalKeyValues);

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
  category: focusCategorySchema,
  intent: focusIntentSchema,
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
  message: z.string(),
  signals: z.array(burnoutSignalSchema),
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

export type FocusCategory = z.infer<typeof focusCategorySchema>;
export type FocusIntent = z.infer<typeof focusIntentSchema>;
export type BurnoutLevel = z.infer<typeof burnoutLevelSchema>;
export type BurnoutSignalKey = z.infer<typeof burnoutSignalKeySchema>;
export type NormalizedUrl = z.infer<typeof normalizedUrlSchema>;
export type FocusSession = z.infer<typeof focusSessionSchema>;
export type FocusSnapshotV1 = z.infer<typeof focusSnapshotSchema>;
export type FragmentationHourlyPoint = z.infer<typeof fragmentationHourlyPointSchema>;
export type CategoryTransition = z.infer<typeof categoryTransitionSchema>;
export type FragmentationResult = z.infer<typeof fragmentationResultSchema>;
export type DeepWorkBlock = z.infer<typeof deepWorkBlockSchema>;
export type DailyFocusMetrics = z.infer<typeof dailyFocusMetricsSchema>;
export type BurnoutSignal = z.infer<typeof burnoutSignalSchema>;
export type BurnoutAssessment = z.infer<typeof burnoutAssessmentSchema>;
export type CategorySummary = z.infer<typeof categorySummarySchema>;
export type HostSummary = z.infer<typeof hostSummarySchema>;
