// SPDX-FileCopyrightText: 2026 mothue
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from "bun:test";
import {
  commandDefinitions,
  makeHelpEmbed,
  makePrivacyEmbed,
  responseFor,
} from "../src/commands";
import baseline from "./fixtures/discord-compatibility.json";

for (const fixture of baseline.cases) {
  test(`preserves complete pre-migration replies and embeds: ${fixture.name}`, () => {
    for (const command of ["today", "tomorrow", "search"] as const) {
      const actual = JSON.parse(
        JSON.stringify(responseFor(command, fixture.day, fixture.date)),
      );
      expect(actual).toEqual(fixture.responses[command]);
    }
  });
}

test("preserves command definitions, help and privacy embeds", () => {
  expect(commandDefinitions().map((command) => command.toJSON())).toEqual(
    baseline.commands,
  );
  expect(makeHelpEmbed().toJSON()).toEqual(baseline.help);
  expect(
    makePrivacyEmbed(
      "公開された献立JSON・取得日時を稼働サーバーに保存します",
    ).toJSON(),
  ).toEqual(baseline.privacy);
});
