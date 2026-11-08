import test from "node:test";
import assert from "node:assert/strict";
import { validateCsvPurpose, CSV_PURPOSE_OPTIONS } from "./csv-purpose.mjs";

test("short purpose choices match PO approved labels", () => {
  assert.deepEqual(Object.values(CSV_PURPOSE_OPTIONS), [
    "ミニゲーム利用", "出欠確認と照合のため", "イベント運営", "その他",
  ]);
});
test("purpose must be selected", () => {
  assert.equal(validateCsvPurpose({ category: "", acknowledged: true }).code, "PURPOSE_REQUIRED");
  assert.equal(validateCsvPurpose({ category: "bogus", acknowledged: true }).valid, false);
});
test("ordinary purpose requires no additional explanation", () => {
  assert.equal(validateCsvPurpose({ category: "mini_game", acknowledged: true }).valid, true);
  assert.equal(validateCsvPurpose({ category: "attendance", acknowledged: true }).valid, true);
  assert.equal(validateCsvPurpose({ category: "event_operations", acknowledged: true }).valid, true);
});
test("Other category requires short supplemental note", () => {
  assert.equal(validateCsvPurpose({ category: "other", acknowledged: true }).code, "OTHER_REQUIRES_DETAIL");
  assert.equal(validateCsvPurpose({ category: "other", detail: "   ", acknowledged: true }).valid, false);
  assert.equal(validateCsvPurpose({ category: "other", detail: " 抽選処理 ", acknowledged: true }).detail, "抽選処理");
});
test("acknowledgement is compulsory", () => {
  assert.equal(validateCsvPurpose({ category: "mini_game", acknowledged: false }).code, "ACKNOWLEDGEMENT_REQUIRED");
  assert.equal(validateCsvPurpose({ category: "mini_game" }).valid, false);
});
test("supplemental text is bounded and type checked", () => {
  assert.equal(validateCsvPurpose({ category: "mini_game", detail: "あ".repeat(200), acknowledged: true }).valid, true);
  assert.equal(validateCsvPurpose({ category: "mini_game", detail: "あ".repeat(201), acknowledged: true }).valid, false);
  assert.equal(validateCsvPurpose({ category: "mini_game", detail: 123, acknowledged: true }).valid, false);
});
test("missing or invalid data defaults to blocked", () => {
  assert.equal(validateCsvPurpose().valid, false);
  assert.equal(validateCsvPurpose({ category: null, acknowledged: true }).valid, false);
  assert.equal(validateCsvPurpose({ category: "other", detail: undefined, acknowledged: true }).valid, false);
});
