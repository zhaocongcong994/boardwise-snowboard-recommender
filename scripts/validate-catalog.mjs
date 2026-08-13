import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateCatalogSubmission } from "../lib/catalog.ts";

const file = process.argv[2] ?? "data/catalog-submissions.json";
const submissions = JSON.parse(await readFile(file, "utf8"));
assert.ok(Array.isArray(submissions), "目录文件顶层必须是数组");

let failed = false;
for (const [index, submission] of submissions.entries()) {
  const errors = validateCatalogSubmission(submission);
  if (errors.length) {
    failed = true;
    console.error(`[${index}] ${submission?.board?.brand ?? "?"} ${submission?.board?.model ?? "?"}: ${errors.join("；")}`);
  }
}

if (failed) process.exitCode = 1;
else console.log(`目录校验通过：${submissions.length} 条待审数据`);
