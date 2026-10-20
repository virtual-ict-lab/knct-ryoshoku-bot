// SPDX-FileCopyrightText: 2026 mothue
// SPDX-License-Identifier: AGPL-3.0-only

import { constants } from "node:fs";
import { copyFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { loadConfig, projectRoot } from "../src/config";
import { createLogger, elapsed } from "../src/logger";

const log = createLogger("setup");

async function main(): Promise<void> {
  const started = performance.now();
  log.info("Installing JavaScript dependencies");
  const child = Bun.spawn([process.execPath, "install", "--frozen-lockfile"], {
    cwd: projectRoot,
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await child.exited;
  if (code !== 0) throw new Error(`bun install failed (exit ${code})`);
  const envPath = join(projectRoot, ".env");
  try {
    await copyFile(
      join(projectRoot, ".env.example"),
      envPath,
      constants.COPYFILE_EXCL,
    );
    log.info("Created .env from .env.example");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    log.info("Keeping existing .env");
  }
  const config = loadConfig({
    ...parseEnv(await readFile(envPath, "utf8")),
    ...process.env,
  });
  log.info("Setup complete", { duration: elapsed(started) });
  log.info(
    config.token
      ? "Run bun run start to start the bot"
      : "Set DISCORD_BOT_TOKEN in .env, then run bun run start",
  );
}

await main().catch((error) => {
  log.error("Setup failed", { error });
  process.exitCode = 1;
});
