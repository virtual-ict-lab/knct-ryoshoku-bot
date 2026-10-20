// SPDX-FileCopyrightText: 2026 mothue
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MenuStore } from "../src/store";
import { updateMenu } from "../src/update";
import { loadConfig } from "../src/config";
import { week } from "./fixtures";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((p) => rm(p, { recursive: true, force: true })),
  );
});
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "knct-ryoshoku-bot-test-"));
  dirs.push(dir);
  return loadConfig({ DATA_DIR: dir, FETCH_TIMEOUT_SECONDS: "0.05" });
}

test("fetches all published weeks and detects corrections even when source PDF hash is unchanged", async () => {
  const config = await setup();
  const weeks = [week(), week("2026-10-19", "b")];
  let path = "";
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      path = new URL(request.url).pathname;
      return Response.json({ schemaVersion: 1, weeks });
    },
  });
  try {
    const cfg = {
      ...config,
      menuJsonUrl: new URL("menus.json", server.url).href,
    };
    expect((await updateMenu(cfg)).changed).toBe(true);
    expect(path).toBe("/menus.json");
    const store = new MenuStore(config.dataDir);
    expect((await store.find("2026-10-16"))?.lunch.text).toBe("カレーライス");
    expect((await store.find("2026-10-20"))?.breakfast.text).toBe("ごはん");
    expect(await store.find("2026-10-26")).toBeNull();
    expect((await updateMenu(cfg)).changed).toBe(false);
    weeks[0]!.days[0]!.lunch.text = "修正版";
    expect((await updateMenu(cfg)).changed).toBe(true);
    expect((await store.find("2026-10-12"))?.lunch.text).toBe("修正版");
  } finally {
    server.stop(true);
  }
});

test.each([
  "http",
  "html",
  "json",
  "version",
  "empty",
  "partial",
  "size",
  "stream-size",
])("%s response cannot overwrite the last valid cache", async (failure) => {
  const config = await setup();
  const store = new MenuStore(config.dataDir);
  await store.replace([week()]);
  const before = await Bun.file(store.path).text();
  const server = Bun.serve({
    port: 0,
    fetch: () => {
      if (failure === "http")
        return new Response("Unavailable", { status: 503 });
      if (failure === "html") return new Response("<html>error</html>");
      if (failure === "json")
        return new Response('{"schemaVersion":1,"weeks":[');
      if (failure === "size") {
        const json = JSON.stringify({
          schemaVersion: 1,
          weeks: [week("2026-10-19", "b")],
        });
        return new Response(json.padEnd(5 * 1024 * 1024 + 1, " "));
      }
      if (failure === "stream-size")
        return new Response(
          new ReadableStream({
            start(controller) {
              const json = JSON.stringify({
                schemaVersion: 1,
                weeks: [week("2026-10-19", "b")],
              });
              controller.enqueue(
                new TextEncoder().encode(json.padEnd(5 * 1024 * 1024 + 1, " ")),
              );
              controller.close();
            },
          }),
        );
      return Response.json({
        schemaVersion: failure === "version" ? 2 : 1,
        weeks: failure === "empty" ? [] : [week(), {}],
      });
    },
  });
  try {
    const update = updateMenu({ ...config, menuJsonUrl: server.url.href });
    if (failure === "size" || failure === "stream-size")
      await expect(update).rejects.toThrow("Menu JSON is too large");
    else await expect(update).rejects.toThrow();
    expect(await Bun.file(store.path).text()).toBe(before);
  } finally {
    server.stop(true);
  }
});

test("request timeout preserves cache", async () => {
  const config = await setup();
  const store = new MenuStore(config.dataDir);
  await store.replace([week()]);
  const before = await Bun.file(store.path).text();
  const server = Bun.serve({
    port: 0,
    async fetch() {
      await Bun.sleep(100);
      return Response.json({ schemaVersion: 1, weeks: [week("2026-10-19")] });
    },
  });
  try {
    await expect(
      updateMenu({
        ...config,
        menuJsonUrl: server.url.href,
        fetchTimeoutMs: 10,
      }),
    ).rejects.toThrow();
    expect(await Bun.file(store.path).text()).toBe(before);
  } finally {
    server.stop(true);
  }
});

test("concurrent refreshes are serialized and abandoned locks recover", async () => {
  const config = await setup();
  const { mkdir, utimes } = await import("node:fs/promises");
  const lock = join(config.dataDir, ".update.lock");
  await mkdir(lock);
  const old = new Date(Date.now() - 60000);
  await utimes(lock, old, old);
  const server = Bun.serve({
    port: 0,
    fetch: () => Response.json({ schemaVersion: 1, weeks: [week()] }),
  });
  try {
    const cfg = { ...config, menuJsonUrl: server.url.href };
    const results = await Promise.all([updateMenu(cfg), updateMenu(cfg)]);
    expect(results.map((r) => r.changed)).toEqual([true, false]);
  } finally {
    server.stop(true);
  }
});

test("corrupt local cache is not overwritten", async () => {
  const config = await setup();
  const store = new MenuStore(config.dataDir);
  await Bun.write(store.path, "{broken");
  const server = Bun.serve({
    port: 0,
    fetch: () => Response.json({ schemaVersion: 1, weeks: [week()] }),
  });
  try {
    await expect(
      updateMenu({ ...config, menuJsonUrl: server.url.href }),
    ).rejects.toThrow();
    expect(await Bun.file(store.path).text()).toBe("{broken");
  } finally {
    server.stop(true);
  }
});

test("saved data remains queryable after the producer stops", async () => {
  const config = await setup();
  const server = Bun.serve({
    port: 0,
    fetch: () => Response.json({ schemaVersion: 1, weeks: [week()] }),
  });
  const cfg = { ...config, menuJsonUrl: server.url.href };
  await updateMenu(cfg);
  server.stop(true);
  await expect(updateMenu(cfg)).rejects.toThrow();
  expect(
    (await new MenuStore(config.dataDir).find("2026-10-16"))?.lunch.text,
  ).toBe("カレーライス");
});
