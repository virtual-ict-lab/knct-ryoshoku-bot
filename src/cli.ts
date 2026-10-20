// SPDX-FileCopyrightText: 2026 mothue
// SPDX-License-Identifier: AGPL-3.0-only

import { readFile } from "node:fs/promises";
import { parseArgs, styleText } from "node:util";
import { REST } from "discord.js";
import { loadConfig } from "./config";
import { makeEmbed } from "./commands";
import { registerCommands } from "./registration";
import { dateInJapan } from "./dates";
import { MenuStore } from "./store";
import { updateMenu } from "./update";
import { createLogger } from "./logger";

const log = createLogger("cli");

export async function main(args = process.argv.slice(2)): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      date: { type: "string" },
      guild: { type: "string" },
    },
  });
  const [command] = positionals;
  const config = loadConfig();
  if (command === "start") {
    const metadata: { version?: string } = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    );
    const version = metadata.version?.trim();
    const banner = [
      "                         __           __",
      ".----.--.--.-----.-----.|  |--.-----.|  |--.--.--.",
      "|   _|  |  |  _  |__ --||     |  _  ||    <|  |  |",
      "|__| |___  |_____|_____||__|__|_____||__|__|_____|",
      "     |_____|",
      "",
      `  knct-ryoshoku-bot ${version ? `v${version}` : "DEVELOP"}`,
    ].join("\n");
    console.log(
      `\n${styleText("#87cefa", banner)}\n${styleText("dim", `  Bun v${Bun.version}`)}\n`,
    );
    await (await import("./bot")).startBot();
    return;
  }
  if (command === "register") {
    if (!config.token) throw new Error("DISCORD_BOT_TOKEN is required");
    const rest = new REST({ version: "10" }).setToken(config.token);
    await registerCommands(rest, undefined, values.guild);
    return;
  }
  if (command === "update") {
    const r = await updateMenu(config);
    console.log(
      JSON.stringify(
        {
          changed: r.changed,
          weeks: r.weeks.length,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (command === "preview") {
    const date = values.date ?? dateInJapan();
    const day = await new MenuStore(config.dataDir).find(date);
    if (!day) {
      console.log(`${date} の献立はまだ取得できていません。`);
      return;
    }
    console.log(JSON.stringify(makeEmbed(day, "プレビュー").toJSON(), null, 2));
    return;
  }
  if (command) throw new Error(`Unknown command: ${command}`);
  console.log(
    "Usage: bun run src/cli.ts <start|register [--guild ID]|update|preview [--date YYYY-MM-DD]>",
  );
}

if (import.meta.main)
  main().catch((error) => {
    log.error("Command failed", { error });
    process.exitCode = 1;
  });
