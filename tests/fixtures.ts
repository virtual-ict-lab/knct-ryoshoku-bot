// SPDX-FileCopyrightText: 2026 mothue
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meal, WeeklyMenu } from "../src/model";
import { normalizeText } from "../src/transcription";

export function meal(rawText: string, warnings: string[] = []): Meal {
  return { text: normalizeText(rawText), rawText, warnings };
}

export function week(startDate = "2026-10-12", hash = "a"): WeeklyMenu {
  return {
    schemaVersion: 1,
    engine: "test",
    sourceSha256: hash.repeat(64),
    fetchedAt: "2026-10-17T00:00:00.000Z",
    startDate,
    endDate: new Date(Date.parse(`${startDate}T00:00:00Z`) + 6 * 86400000)
      .toISOString()
      .slice(0, 10),
    days: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.parse(`${startDate}T00:00:00Z`) + i * 86400000)
        .toISOString()
        .slice(0, 10),
      breakfast: meal("ごはん"),
      lunch: meal("カレーライス"),
      dinner: meal(""),
    })),
    warnings: [],
  };
}
