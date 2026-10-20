// SPDX-FileCopyrightText: 2026 mothue
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MenuStore } from "../src/store";
import { week } from "./fixtures";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});
async function store() {
  const dir = await mkdtemp(join(tmpdir(), "knct-ryoshoku-bot-store-"));
  dirs.push(dir);
  return new MenuStore(dir);
}

test("ignores a day outside its declared period even when it was fetched more recently", async () => {
  const cache = await store();
  const current = week();
  const unrelated = week("2026-10-19", "b");
  unrelated.fetchedAt = "2026-10-20T00:00:00.000Z";
  unrelated.days[0] = {
    ...current.days[0]!,
    lunch: { text: "別の期間", rawText: "別の期間", warnings: [] },
  };
  await cache.replace([current, unrelated]);
  expect((await cache.find("2026-10-12"))?.lunch.text).toBe("カレーライス");
  await cache.replace([unrelated]);
  expect(await cache.find("2026-10-12")).toBeNull();
});

test("selects the current period and keeps Sunday and next Monday separate", async () => {
  const cache = await store();
  const current = week();
  const next = week("2026-10-19", "b");
  next.fetchedAt = "2026-10-18T00:00:00.000Z";
  next.days[0]!.lunch.text = "翌週の献立";
  await cache.replace([next, current]);
  expect((await cache.find("2026-10-12"))?.date).toBe(current.startDate);
  expect((await cache.find("2026-10-18"))?.date).toBe(current.endDate);
  expect((await cache.find("2026-10-19"))?.lunch.text).toBe("翌週の献立");
  expect(await cache.find("2026-10-26")).toBeNull();
});

test("uses the latest acquisition when published periods overlap", async () => {
  const cache = await store();
  const older = week();
  const newer = week("2026-10-12", "b");
  newer.fetchedAt = "2026-10-18T00:00:00.000Z";
  newer.days[0]!.lunch.text = "修正版";
  await cache.replace([newer, older]);
  expect((await cache.find("2026-10-12"))?.lunch.text).toBe("修正版");
});

test("compares acquisition times chronologically across timestamp precision", async () => {
  const cache = await store();
  const older = week();
  older.fetchedAt = "2026-10-20T00:00:00Z";
  const newer = week("2026-10-12", "b");
  newer.fetchedAt = "2026-10-20T00:00:00.500Z";
  newer.days[0]!.lunch.text = "500ミリ秒後の修正版";
  await cache.replace([older, newer]);
  expect((await cache.find("2026-10-12"))?.lunch.text).toBe(
    "500ミリ秒後の修正版",
  );
});

test.each(["2026-09-28", "2026-12-28"])(
  "finds dates across the boundary in the week starting %s",
  async (start) => {
    const cache = await store();
    const menu = week(start);
    await cache.replace([menu]);
    for (const day of menu.days)
      expect((await cache.find(day.date))?.date).toBe(day.date);
  },
);
