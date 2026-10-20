// SPDX-FileCopyrightText: 2026 mothue
// SPDX-License-Identifier: AGPL-3.0-only

import { resolve, join } from "node:path";

export const projectRoot = resolve(import.meta.dir, "..");
export const PDF_URL = "https://www.kagawa-nct.ac.jp/dormitoryE/kondate.pdf";

export function loadConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const positive = (key: string, fallback: number) => {
    const n = Number(env[key] ?? fallback);
    if (!Number.isFinite(n) || n <= 0)
      throw new Error(`${key} must be positive`);
    return n;
  };
  const adminUserIds = [
    ...new Set(
      (env.ADMIN_USER_IDS ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
  if (adminUserIds.some((id) => !/^\d+$/.test(id))) {
    throw new Error(
      "ADMIN_USER_IDS must be a comma-separated list of Discord user IDs",
    );
  }
  return {
    dataDir: resolve(env.DATA_DIR ?? join(projectRoot, "data")),
    menuJsonUrl:
      env.MENU_JSON_URL ??
      "https://virtual-ict-lab.github.io/knct-ryoshoku-api/kondate.json",
    fetchTimeoutMs: positive("FETCH_TIMEOUT_SECONDS", 30) * 1000,
    updateIntervalMs: positive("UPDATE_INTERVAL_HOURS", 6) * 3600000,
    token: env.DISCORD_BOT_TOKEN,
    adminUserIds,
  };
}

export type Config = ReturnType<typeof loadConfig>;
