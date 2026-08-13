import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const endpoint = process.argv[2] ?? "http://localhost:3002/api/admin/catalog/changes";
const submissions = JSON.parse(await readFile("data/catalog-submissions.json", "utf8"));
assert.ok(Array.isArray(submissions), "目录文件顶层必须是数组");

let submitted = 0;
for (const submission of submissions) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(`${submission.board.brand} ${submission.board.model}: ${result.details?.join("；") || result.error || response.statusText}`);
  }
  submitted += 1;
  console.log(`已提交：${submission.board.brand} ${submission.board.model}`);
}

console.log(`完成：${submitted} 条真实规格已送入待审核队列`);
