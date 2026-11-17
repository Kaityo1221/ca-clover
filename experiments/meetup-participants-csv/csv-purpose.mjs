// Frontend-only validation contract for the offline CSV confirmation preview.
// Real export API must validate purpose again with authenticated actor permissions.
export const CSV_PURPOSE_OPTIONS = Object.freeze({
  mini_game: "ミニゲーム利用",
  attendance: "出欠確認と照合のため",
  event_operations: "イベント運営",
  other: "その他",
});

export function validateCsvPurpose({ category, detail = "", acknowledged } = {}) {
  if (!Object.hasOwn(CSV_PURPOSE_OPTIONS, category ?? "")) {
    return { valid: false, code: "PURPOSE_REQUIRED" };
  }
  if (typeof detail !== "string" || detail.length > 200) {
    return { valid: false, code: "PURPOSE_DETAIL_INVALID" };
  }
  const note = detail.trim();
  if (category === "other" && note.length === 0) {
    return { valid: false, code: "OTHER_REQUIRES_DETAIL" };
  }
  if (acknowledged !== true) {
    return { valid: false, code: "ACKNOWLEDGEMENT_REQUIRED" };
  }
  return { valid: true, code: null, category, detail: note };
}
