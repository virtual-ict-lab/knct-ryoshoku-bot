// SPDX-FileCopyrightText: 2026 mothue
// SPDX-License-Identifier: AGPL-3.0-only

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { MenuCacheSchema, type WeeklyMenu, type DailyMenu } from "./model";

export async function atomicJson(path: string, value: unknown): Promise<void> {
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, JSON.stringify(value, null, 2) + "\n", {
      mode: 0o600,
    });
    await rename(temp, path);
  } finally {
    await rm(temp, { force: true });
  }
}

export class MenuStore {
  readonly path: string;

  constructor(readonly directory: string) {
    this.path = join(directory, "menus.json");
  }

  async load(): Promise<WeeklyMenu[]> {
    try {
      return MenuCacheSchema.parse(
        JSON.parse(await readFile(this.path, "utf8")),
      ).weeks;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async replace(weeks: WeeklyMenu[]): Promise<void> {
    const cache = MenuCacheSchema.parse({ schemaVersion: 1, weeks });
    await mkdir(this.directory, { recursive: true });
    await atomicJson(this.path, cache);
  }

  async find(date: string): Promise<DailyMenu | null> {
    const weeks = await this.load();
    weeks.sort((a, b) => Date.parse(b.fetchedAt) - Date.parse(a.fetchedAt));
    for (const week of weeks) {
      if (date < week.startDate || date > week.endDate) continue;
      const day = week.days.find((d) => d.date === date);
      if (day) return day;
    }
    return null;
  }
}
