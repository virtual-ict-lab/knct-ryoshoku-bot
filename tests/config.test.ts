// SPDX-FileCopyrightText: 2026 mothue
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from "bun:test";
import { loadConfig } from "../src/config";

test("defaults to the published menu API with the existing refresh policy", () => {
  const config = loadConfig({});
  expect(config.menuJsonUrl).toBe(
    "https://virtual-ict-lab.github.io/knct-ryoshoku-api/kondate.json",
  );
  expect(config.fetchTimeoutMs).toBe(30_000);
  expect(config.updateIntervalMs).toBe(6 * 3_600_000);
});

test("keeps explicit API and refresh configuration", () => {
  const config = loadConfig({
    MENU_JSON_URL: "https://example.test/kondate.json",
    FETCH_TIMEOUT_SECONDS: "10",
    UPDATE_INTERVAL_HOURS: "2",
  });
  expect(config.menuJsonUrl).toBe("https://example.test/kondate.json");
  expect(config.fetchTimeoutMs).toBe(10_000);
  expect(config.updateIntervalMs).toBe(7_200_000);
});
