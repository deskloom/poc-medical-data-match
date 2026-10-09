"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { matchRecords, changedFields, validateRecord, toOutputRows, summarize } = require("../lib/match");

const root = path.join(__dirname, "..");
const existing = JSON.parse(fs.readFileSync(path.join(root, "data", "existing.json"), "utf8"));
const monthly = JSON.parse(fs.readFileSync(path.join(root, "data", "monthly.json"), "utf8"));

test("今月分と管理中データを突き合わせて新規・変更・継続・終了候補に分類する", () => {
  const results = matchRecords(existing, monthly);
  const byCode = new Map(results.map((r) => [r.code, r.updateType]));
  assert.equal(byCode.get("F-0001"), "継続");
  assert.equal(byCode.get("F-0002"), "変更");
  assert.equal(byCode.get("F-0004"), "変更");
  assert.equal(byCode.get("F-0011"), "新規");
  assert.equal(byCode.get("F-0009"), "終了候補");
  assert.equal(byCode.get("F-0010"), "終了候補");
  const summary = summarize(results);
  assert.equal(summary.新規, 4);
  assert.equal(summary.変更, 2);
  assert.equal(summary.継続, 6);
  assert.equal(summary.終了候補, 2);
});

test("変更ありの行について変わった項目名を列挙する", () => {
  const results = matchRecords(existing, monthly);
  const byCode = new Map(results.map((r) => [r.code, r]));
  assert.deepEqual(byCode.get("F-0002").changedFields, ["departments"]);
  assert.deepEqual(byCode.get("F-0004").changedFields, ["tel"]);
  assert.deepEqual(byCode.get("F-0001").changedFields, []);
});

test("必須項目の欠けや形式の誤りがある行に要確認を付ける", () => {
  const results = matchRecords(existing, monthly);
  const byCode = new Map(results.map((r) => [r.code, r]));
  const bad = byCode.get("F-0013");
  assert.equal(bad.needsReview, true);
  assert.ok(bad.reviewReasons.length >= 3);
  assert.equal(byCode.get("F-0001").needsReview, false);
  assert.equal(byCode.get("F-0009").needsReview, true);
  assert.equal(validateRecord({}).length > 0, true);
});

test("照合結果を指定フォーマットの出力行に整形する", () => {
  const rows = toOutputRows(matchRecords(existing, monthly));
  assert.equal(rows.length, monthly.length + 2);
  for (const row of rows) {
    assert.ok(row.code, "codeがある");
    assert.ok(["新規", "変更", "継続", "終了候補"].includes(row.updateType));
    assert.equal(typeof row.note, "string");
  }
  const changed = rows.find((r) => r.code === "F-0002");
  assert.equal(changed.changedFields, "departments");
});

test("全候補ぶんの結果を重複なく返す", () => {
  const results = matchRecords(existing, monthly);
  const codes = results.map((r) => r.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(results.length, new Set([...existing.map((r) => r.code), ...monthly.map((r) => r.code)]).size);
});

test("画面用のデータが同梱データと件数・内容で一致している", () => {
  const html = fs.readFileSync(path.join(root, "docs", "index.html"), "utf8");
  for (const rec of [...existing, ...monthly]) {
    assert.ok(html.includes(rec.code), `${rec.code}が画面に含まれる`);
  }
  assert.ok(html.includes("F-0013"));
});
