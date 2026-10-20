// SPDX-FileCopyrightText: 2026 mothue
// SPDX-License-Identifier: AGPL-3.0-only

import { extname, resolve } from "node:path";

async function main(): Promise<void> {
  let files = process.argv.slice(2);
  if (!files.length) {
    const result = Bun.spawnSync(["git", "ls-files", "-z"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    if (result.exitCode !== 0) throw new Error(result.stderr.toString().trim());
    files = result.stdout.toString().split("\0").filter(Boolean);
  }
  const prefixes: Record<string, string> = {
    ".ts": "//",
    ".tsx": "//",
    ".js": "//",
    ".jsx": "//",
    ".mjs": "//",
    ".cjs": "//",
    ".sh": "#",
    ".yml": "#",
    ".yaml": "#",
  };
  let checked = 0;
  const failures: string[] = [];
  for (const name of files) {
    const prefix = prefixes[extname(name)];
    if (!prefix) continue;
    checked++;
    const lines = (await Bun.file(resolve(name)).text()).split(/\r?\n/);
    if (lines[0]?.startsWith("#!")) lines.shift();
    const copyright = new RegExp(
      `^${prefix} SPDX-FileCopyrightText: [0-9]{4}(?:-[0-9]{4})? mothue$`,
    );
    if (
      !copyright.test(lines[0] ?? "") ||
      lines[1] !== `${prefix} SPDX-License-Identifier: AGPL-3.0-only`
    ) {
      failures.push(name);
    }
  }
  if (!checked) throw new Error("No source files found for SPDX validation");
  for (const name of failures) {
    console.error(
      `${name}: expected SPDX copyright (year and mothue) and AGPL-3.0-only headers at the top`,
    );
  }
  if (failures.length) process.exitCode = 1;
  else console.log(`SPDX headers verified in ${checked} files.`);
}

if (import.meta.main) {
  await main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
