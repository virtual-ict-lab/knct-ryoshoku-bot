// SPDX-FileCopyrightText: 2026 mothue
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { MenuStore } from "../src/store";
import { week } from "../tests/fixtures";

const root = resolve(import.meta.dir, "..");

test("one published API request supplies current and next weeks and remains usable offline", async () => {
  const dir = await mkdtemp(join(tmpdir(), "knct-ryoshoku-bot-integration-"));
  const current = week();
  current.days[6]!.lunch = {
    text: "野菜サラダ",
    rawText: "野菜ｻﾗﾀﾞ\n8",
    warnings: [
      "OCR要確認 (0.72): 野菜ｻﾗﾀﾞ",
      "低信頼度のため表示省略 (0.12): 8",
    ],
  };
  const upcoming = week("2026-10-19", "b");
  upcoming.fetchedAt = "2026-10-18T00:00:00.000Z";
  upcoming.days[0]!.lunch.text = "翌週月曜の献立";
  const requests: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname;
      requests.push(path);
      if (path !== "/kondate.json")
        return new Response("Unexpected additional request", { status: 404 });
      return Response.json({
        schemaVersion: 1,
        weeks: [upcoming, current],
        publishedForDate: "2026-10-18",
        sourceUrl: "https://www.kagawa-nct.ac.jp/dormitoryE/kondate.pdf",
        current: {
          startDate: current.startDate,
          endDate: current.endDate,
          json: "archive/current.json",
        },
        upcoming: {
          startDate: upcoming.startDate,
          endDate: upcoming.endDate,
          json: "archive/next.json",
        },
      });
    },
  });
  const url = new URL("kondate.json", server.url).href;
  async function cli(command: string, date?: string) {
    const child = Bun.spawn(
      [
        process.execPath,
        "src/cli.ts",
        command,
        ...(date ? ["--date", date] : []),
      ],
      {
        cwd: root,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          DATA_DIR: dir,
          MENU_JSON_URL: url,
          FETCH_TIMEOUT_SECONDS: "1",
          NO_COLOR: "1",
        },
      },
    );
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { stdout, stderr, code };
  }
  try {
    const update = await cli("update");
    expect(update.code).toBe(0);
    expect(JSON.parse(update.stdout)).toEqual({ changed: true, weeks: 2 });
    expect(requests).toEqual(["/kondate.json"]);
    const store = new MenuStore(dir);
    expect((await store.find("2026-10-18"))?.lunch.text).toBe("野菜サラダ");
    const sunday = await cli("preview", "2026-10-18");
    expect(sunday.code).toBe(0);
    expect(JSON.parse(sunday.stdout).fields[1].value).toBe(
      "⚠️ 野菜サラダ\n\n⚠️ 認識が不確かな1行を省略",
    );
    const monday = await cli("preview", "2026-10-19");
    expect(monday.code).toBe(0);
    expect(JSON.parse(monday.stdout).fields[1].value).toBe("翌週月曜の献立");
    expect(requests).toHaveLength(1);
    const before = await Bun.file(store.path).text();
    server.stop(true);
    expect((await cli("update")).code).toBe(1);
    expect(await Bun.file(store.path).text()).toBe(before);
    expect(await cli("preview", "2026-10-18")).toEqual(sunday);
    const missing = await cli("preview", "2026-10-26");
    expect(missing.code).toBe(0);
    expect(missing.stdout.trim()).toBe(
      "2026-10-26 の献立はまだ取得できていません。",
    );
  } finally {
    server.stop(true);
    await rm(dir, { recursive: true, force: true });
  }
});
