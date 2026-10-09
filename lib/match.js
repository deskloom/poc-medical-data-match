"use strict";

// 月次公開データと管理中データの照合ロジック。
// Node (require) とブラウザ (window.DataMatch) の両方で使う。

const COMPARE_FIELDS = ["name", "address", "tel", "departments", "beds"];
const CODE_PATTERN = /^F-\d{4}$/;
const TEL_PATTERN = /^\d{2,4}-\d{2,4}-\d{4}$/;

function sameValue(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    const left = [...(a || [])].sort();
    const right = [...(b || [])].sort();
    return left.length === right.length && left.every((v, i) => v === right[i]);
  }
  return (a === undefined ? null : a) === (b === undefined ? null : b);
}

function changedFields(oldRec, newRec) {
  return COMPARE_FIELDS.filter((f) => !sameValue(oldRec[f], newRec[f]));
}

// 1件ぶんの入力チェック。問題があれば理由の配列を返す。
function validateRecord(rec) {
  const reasons = [];
  if (!rec || typeof rec !== "object") return ["行が空または形式が正しくありません"];
  if (!CODE_PATTERN.test(rec.code || "")) reasons.push("機関コードの形式が正しくありません");
  if (!rec.name) reasons.push("名称が空です");
  if (!rec.address) reasons.push("所在地が空です");
  if (!TEL_PATTERN.test(rec.tel || "")) reasons.push("電話番号の形式が正しくありません");
  if (!Array.isArray(rec.departments) || rec.departments.length === 0) reasons.push("診療科が空です");
  if (!Number.isInteger(rec.beds) || rec.beds < 0) reasons.push("病床数が0以上の整数ではありません");
  return reasons;
}

// 照合本体。existing: 管理中、monthly: 今月公開分。
// 戻り値: [{ code, updateType, changedFields, needsReview, reviewReasons, record }]
// updateType: "継続" | "変更" | "新規" | "終了候補"
function matchRecords(existing, monthly) {
  const oldByCode = new Map((existing || []).map((r) => [r.code, r]));
  const newByCode = new Map((monthly || []).map((r) => [r.code, r]));
  const results = [];

  for (const rec of monthly || []) {
    const old = oldByCode.get(rec.code);
    const reasons = validateRecord(rec);
    if (!old) {
      results.push({
        code: rec.code,
        updateType: "新規",
        changedFields: [],
        needsReview: reasons.length > 0,
        reviewReasons: reasons,
        record: rec,
      });
    } else {
      const diffs = changedFields(old, rec);
      results.push({
        code: rec.code,
        updateType: diffs.length === 0 ? "継続" : "変更",
        changedFields: diffs,
        needsReview: reasons.length > 0,
        reviewReasons: reasons,
        record: rec,
      });
    }
  }

  for (const rec of existing || []) {
    if (!newByCode.has(rec.code)) {
      results.push({
        code: rec.code,
        updateType: "終了候補",
        changedFields: [],
        needsReview: true,
        reviewReasons: ["今月の公開データに見当たりません。終了・移転の確認が必要です"],
        record: rec,
      });
    }
  }

  return results;
}

// 照合結果を指定フォーマットの出力行に整形する。
function toOutputRows(results) {
  return results.map((r) => ({
    code: r.code,
    name: r.record.name || "",
    address: r.record.address || "",
    tel: r.record.tel || "",
    departments: (r.record.departments || []).join("・"),
    updateType: r.updateType,
    changedFields: r.changedFields.join(","),
    needsReview: r.needsReview ? "要確認" : "",
    note: r.reviewReasons.join(" / "),
  }));
}

function summarize(results) {
  const s = { total: results.length, 新規: 0, 変更: 0, 継続: 0, 終了候補: 0, 要確認: 0 };
  for (const r of results) {
    s[r.updateType] += 1;
    if (r.needsReview) s.要確認 += 1;
  }
  return s;
}

const api = { matchRecords, changedFields, validateRecord, toOutputRows, summarize, COMPARE_FIELDS };

if (typeof module !== "undefined" && module.exports) {
  module.exports = api;
}
if (typeof window !== "undefined") {
  window.DataMatch = api;
}
