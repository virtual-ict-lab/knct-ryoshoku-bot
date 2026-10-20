// SPDX-FileCopyrightText: 2026 mothue
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from "bun:test";
import { normalizeText } from "../src/transcription";
import { dateInJapan, addDays, weekdayDate } from "../src/dates";

test("normalizes cached warning text without guessing dish names", () => {
  expect(
    normalizeText(" [ Ａ ]\r\n 牛乳（２００ｍｌ）\n夜力レ一登場！！ "),
  ).toBe("[ A ]\n牛乳(200ml)\n夜力レ一登場!!");
});

test("calculates dates in JST over UTC midnight and month boundaries", () => {
  expect(dateInJapan(new Date("2026-10-15T15:00:00Z"))).toBe("2026-10-16");
  expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
  expect(weekdayDate("2026-10-18", 0)).toBe("2026-10-12");
  expect(dateInJapan(new Date("2026-12-31T14:59:59Z"))).toBe("2026-12-31");
  expect(dateInJapan(new Date("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
  expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  expect(weekdayDate("2027-01-03", 6)).toBe("2027-01-03");
});
