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
async function cli(args: string[], env: Record<string, string>) {
  const child = Bun.spawn([process.execPath, "src/cli.ts", ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...env, NO_COLOR: "1" },
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, code };
}

test("JSON refresh keeps stdout machine-readable and logs to stderr", async () => {
  const dir = await mkdtemp(join(tmpdir(), "knct-ryoshoku-bot-logging-"));
  dirs.push(dir);
  await new MenuStore(dir).replace([week()]);
  const server = Bun.serve({
    port: 0,
    fetch: () => Response.json({ schemaVersion: 1, weeks: [week()] }),
  });
  try {
    const result = await cli(["update"], {
      DATA_DIR: dir,
      MENU_JSON_URL: server.url.href,
    });
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ changed: false, weeks: 1 });
    expect(result.stderr).toContain("[menu::download]");
    expect(result.stderr).toContain("[menu::update] Menu unchanged");
    expect(result.stderr).toMatch(/duration=\d+\.\d{3}s/);
    expect(result.stderr).not.toContain("\x1b[");
  } finally {
    server.stop(true);
  }
});

test("CLI errors include module and stack with a failing exit code", async () => {
  const result = await cli(["extract"], {});
  expect(result.code).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("ERROR [cli]");
  expect(result.stderr).toContain("Unknown command: extract");
  expect(result.stderr).toContain("src/cli.ts:");
});
