import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { REPO_ROOT, SOURCE_REL } from "./lib.mjs";

test("detection reference states the thresholds the hooks module enforces", async () => {
  const source = await readFile(path.join(REPO_ROOT, "hooks/register.ts"), "utf8");
  const page = await readFile(path.join(REPO_ROOT, SOURCE_REL, "pages/reference/detection.md"), "utf8");
  for (const name of ["SAME_REPLY_TURNS", "IDLE_TURNS", "SIMILAR"]) {
    const value = new RegExp(`const ${name} = ([0-9.]+)`, "u").exec(source)?.[1];
    assert.ok(value, `${name} is not a constant in hooks/register.ts`);
    assert.match(page, new RegExp(`\\| \`${name}\` \\| ${value.replace(".", "\\.")} \\|`, "u"),
      `${name} is ${value} in hooks/register.ts`);
  }
});
