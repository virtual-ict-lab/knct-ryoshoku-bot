// SPDX-FileCopyrightText: 2026 mothue
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from "zod";

export const meals = ["breakfast", "lunch", "dinner"] as const;
export type MealName = (typeof meals)[number];
export const MealSchema = z.object({
  text: z.string(),
  rawText: z.string(),
  warnings: z.array(z.string()),
});

export type Meal = z.infer<typeof MealSchema>;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const WeeklyMenuSchema = z.object({
  schemaVersion: z.literal(1),
  engine: z.string(),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  fetchedAt: z.string().datetime(),
  startDate: date,
  endDate: date,
  days: z
    .array(
      z.object({
        date,
        breakfast: MealSchema,
        lunch: MealSchema,
        dinner: MealSchema,
      }),
    )
    .min(1)
    .max(7),
  warnings: z.array(z.string()),
});

export const MenuCacheSchema = z.object({
  schemaVersion: z.literal(1),
  weeks: z.array(WeeklyMenuSchema),
});

export type WeeklyMenu = z.infer<typeof WeeklyMenuSchema>;

export type DailyMenu = WeeklyMenu["days"][number];
