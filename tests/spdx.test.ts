// SPDX-FileCopyrightText: 2026 mothue
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const script = resolve(import.meta.dir, "../scripts/check-spdx.ts");
const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function check(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), "knct-ryoshoku-bot-spdx-"));
  dirs.push(root);
  for (const [name, text] of Object.entries(files))
    await Bun.write(join(root, name), text);
  const child = Bun.spawn([process.execPath, script, ...Object.keys(files)], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { code, stdout, stderr };
}

test("Bun validates source and workflow headers including shebangs and CRLF", async () => {
  const result = await check({
    "source.ts":
      "// SPDX-FileCopyrightText: 2026 mothue\n// SPDX-License-Identifier: AGPL-3.0-only\n",
    "workflow.yml":
      "# SPDX-FileCopyrightText: 2025-2026 mothue\r\n# SPDX-License-Identifier: AGPL-3.0-only\r\n",
    "script.sh":
      "#!/bin/sh\n# SPDX-FileCopyrightText: 2026 mothue\n# SPDX-License-Identifier: AGPL-3.0-only\n",
    "package.json": "{}",
  });
  expect(result.code).toBe(0);
  expect(result.stdout).toContain("SPDX headers verified in 3 files.");
  expect(result.stderr).toBe("");
});

test("Bun rejects missing or incorrect SPDX headers", async () => {
  const result = await check({
    "missing.ts": "console.log('no headers');\n",
    "wrong.ts":
      "// SPDX-FileCopyrightText: 2026 mothue\n// SPDX-License-Identifier: MIT\n",
    "old.ts":
      "// SPDX-FileCopyrightText: 2026 mothue\n// SPDX-License-Identifier: GPL-3.0-only\n",
  });
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("missing.ts: expected SPDX");
  expect(result.stderr).toContain("wrong.ts: expected SPDX");
  expect(result.stderr).toContain("old.ts: expected SPDX");
});

test("Bun rejects an input list without supported source files", async () => {
  const result = await check({ "package.json": "{}" });
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("No source files found");
});
