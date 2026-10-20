// SPDX-FileCopyrightText: 2026 mothue
// SPDX-License-Identifier: AGPL-3.0-only

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { lock as lockDirectory } from "proper-lockfile";
import { MenuCacheSchema } from "./model";
import { MenuStore } from "./store";
import type { Config } from "./config";
import { createLogger, elapsed } from "./logger";

const log = createLogger("menu::update");
const downloadLog = createLogger("menu::download");
const MAX_JSON_BYTES = 5 * 1024 * 1024;

async function downloadMenus(config: Config) {
  const started = performance.now();
  downloadLog.info("Downloading menu JSON");
  const response = await fetch(config.menuJsonUrl, {
    signal: AbortSignal.timeout(config.fetchTimeoutMs),
    headers: { "User-Agent": "knct-ryoshoku-bot/1.0" },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Menu download failed: HTTP ${response.status}`);
  }
  if (Number(response.headers.get("content-length") ?? 0) > MAX_JSON_BYTES) {
    await response.body?.cancel();
    throw new Error("Menu JSON is too large");
  }
  if (!response.body) throw new Error("Empty menu response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > MAX_JSON_BYTES) throw new Error("Menu JSON is too large");
      chunks.push(next.value);
    }
  } finally {
    await reader.cancel();
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  const cache = MenuCacheSchema.parse(
    JSON.parse(new TextDecoder().decode(data)),
  );
  if (!cache.weeks.length) throw new Error("Published menu history is empty");
  downloadLog.info("Menu JSON downloaded", {
    bytes: size,
    weeks: cache.weeks.length,
    duration: elapsed(started),
  });
  return cache.weeks;
}

const updates = new Map<string, Promise<unknown>>();

export async function waitForUpdates(): Promise<void> {
  await Promise.allSettled([...updates.values()]);
}

export function updateMenu(config: Config) {
  const previous = updates.get(config.dataDir) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => performUpdate(config));
  updates.set(config.dataDir, next);
  void next
    .finally(() => {
      if (updates.get(config.dataDir) === next) updates.delete(config.dataDir);
    })
    .catch(() => {});
  return next;
}

async function performUpdate(config: Config) {
  const started = performance.now();
  log.info("Checking menu JSON");
  await mkdir(config.dataDir, { recursive: true });
  const release = await lockDirectory(config.dataDir, {
    lockfilePath: join(config.dataDir, ".update.lock"),
    realpath: false,
    stale: 15000,
    update: 5000,
    retries: 0,
  });
  try {
    const weeks = await downloadMenus(config);
    const store = new MenuStore(config.dataDir);
    const existing = await store.load();
    const changed = JSON.stringify(existing) !== JSON.stringify(weeks);
    if (changed) await store.replace(weeks);
    log.info(changed ? "Menu updated" : "Menu unchanged", {
      weeks: weeks.length,
      duration: elapsed(started),
    });
    return { changed, weeks };
  } finally {
    await release();
  }
}
