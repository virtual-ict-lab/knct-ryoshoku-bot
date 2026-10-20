// SPDX-FileCopyrightText: 2026 mothue
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const sourceRoot = resolve(import.meta.dir, "..");
const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function fixture() {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), "knct-ryoshoku-bot-tools-")),
  );
  dirs.push(root);
  await cp(join(sourceRoot, "scripts"), join(root, "scripts"), {
    recursive: true,
  });
  await cp(join(sourceRoot, "src"), join(root, "src"), { recursive: true });
  await Bun.write(
    join(root, "package.json"),
    '{"name":"tools-test","type":"module","private":true}',
  );
  await Bun.write(
    join(root, ".env.example"),
    "MENU_JSON_URL=https://virtual-ict-lab.github.io/knct-ryoshoku-api/kondate.json\n",
  );
  return root;
}

async function run(
  root: string,
  script: string,
  extra: Record<string, string> = {},
) {
  const env = { ...process.env };
  for (const key of [
    "DATA_DIR",
    "ADMIN_USER_IDS",
    "MENU_JSON_URL",
    "FETCH_TIMEOUT_SECONDS",
    "UPDATE_INTERVAL_HOURS",
  ])
    delete env[key];
  const child = Bun.spawn(
    [process.execPath, join(root, "scripts", `${script}.ts`)],
    {
      cwd: root,
      env: { ...env, NO_COLOR: "1", ...extra },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, code };
}

test("setup installs dependencies and creates public API configuration", async () => {
  const root = await fixture();
  const result = await run(root, "setup");
  expect(result.code).toBe(0);
  expect(await Bun.file(join(root, ".env")).text()).toContain(
    "MENU_JSON_URL=https://virtual-ict-lab.github.io/knct-ryoshoku-api/kondate.json",
  );
});

test("setup preserves an existing env file", async () => {
  const root = await fixture();
  const content =
    "MENU_JSON_URL=https://example.test/menus.json\n# Keep this file\n";
  await Bun.write(join(root, ".env"), content);
  const result = await run(root, "setup");
  expect(result.code).toBe(0);
  expect(await Bun.file(join(root, ".env")).text()).toBe(content);
});

test("clean removes compiler caches while preserving data, dependencies, env and symlink targets", async () => {
  const root = await fixture();
  const external = await mkdtemp(join(tmpdir(), "knct-ryoshoku-bot-external-"));
  dirs.push(external);
  const removable = ["nested/project.tsbuildinfo", "project.tsbuildinfo"];
  const retained = [
    "data/keep.tsbuildinfo",
    "node_modules/keep.tsbuildinfo",
    ".git/keep.tsbuildinfo",
    "custom-data/keep.tsbuildinfo",
    ".env",
  ];
  for (const file of [...removable, ...retained]) {
    await mkdir(resolve(root, file, ".."), { recursive: true });
    await Bun.write(join(root, file), "keep");
  }
  await Bun.write(join(external, "keep.tsbuildinfo"), "keep");
  await symlink(external, join(root, "external"));
  await symlink(join(root, "custom-data"), join(root, "data-alias"));
  const env = { DATA_DIR: join(root, "data-alias") };
  expect((await run(root, "clean", env)).code).toBe(0);
  for (const file of removable)
    expect(await Bun.file(join(root, file)).exists()).toBe(false);
  for (const file of retained)
    expect(await Bun.file(join(root, file)).text()).toBe("keep");
  expect(await Bun.file(join(external, "keep.tsbuildinfo")).text()).toBe(
    "keep",
  );
  expect((await run(root, "clean", env)).code).toBe(0);
});
