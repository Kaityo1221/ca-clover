import { buildParticipantCsv } from "./csv-core.mjs";
import { getPublicExportFailure } from "./export-failure.mjs";

// FICTIONAL DATA ONLY. This preview makes no network or Supabase requests.
const fakeEvents = [
  {
    event: { id: "demo-past-001", eventTime: "2026-10-11T14:00:00+09:00" },
    title: "コミュニティ・デイ ミートアップ", date: "2026.10.11（日）14:00", status: "終了",
    counts: { participating: 2, checkedIn: 1 },
    members: [
      { id: "a", username: "Trainer_A" },
      { id: "b", username: "Trainer_B" },
      { id: "c", username: "Trainer_C" },
    ],
    rsvpStatuses: [
      { userId: "a", rsvpStatus: "ACCEPTED" },
      { userId: "b", rsvpStatus: "CHECKED_IN" },
      { userId: "c", rsvpStatus: "DECLINED" },
    ],
  },
  {
    event: { id: "demo-live-002", eventTime: "2026-10-15T14:00:00+09:00" },
    title: "キョダイマックス レイド", date: "2026.10.15（木）14:00", status: "LIVE（例）",
    counts: { participating: 3, checkedIn: 2 },
    members: [
      { id: "d", username: "Trainer_D" },
      { id: "e", username: "Trainer_E" },
      { id: "f", username: "Trainer_F" },
    ],
    rsvpStatuses: [
      { userId: "d", rsvpStatus: "CHECKED_IN" },
      { userId: "e", rsvpStatus: "CHECKED_IN" },
      { userId: "f", rsvpStatus: "ACCEPTED" },
    ],
  },
  {
    event: { id: "demo-future-003", eventTime: "2026-10-25T14:00:00+09:00" },
    title: "週末ミートアップ", date: "2026.10.25（日）14:00", status: "開催予定（例）",
    counts: { participating: 2, checkedIn: 0 },
    members: [
      { id: "g", username: "Trainer_G" },
      { id: "h", username: "Trainer_H" },
    ],
    rsvpStatuses: [
      { userId: "g", rsvpStatus: "ACCEPTED" },
      { userId: "h", rsvpStatus: "ACCEPTED" },
    ],
  }
];

const cards = document.querySelector("#cards");
const output = document.querySelector("#feedback");
const dialog = document.querySelector("#detail");
const detailText = document.querySelector("#detail-text");
const demoMode = document.querySelector("#demo-mode");
const confirmDialog = document.querySelector("#confirm-export");
const confirmEvent = document.querySelector("#confirm-event");
const confirmCancel = document.querySelector("#confirm-cancel");
const confirmGenerate = document.querySelector("#confirm-generate");
let pendingExport = null;

function requestExportConfirmation(item, button) {
  if (button.disabled || pendingExport) return;
  if (typeof confirmDialog.showModal !== "function") {
    output.textContent = "この環境では確認画面を開けないため、CSVの生成を中止しました。";
    return;
  }
  // No member-status collection and no CSV creation before confirmation.
  pendingExport = { item, button };
  confirmEvent.textContent = item.title + " / " + item.date;
  confirmDialog.showModal();
}

confirmCancel.addEventListener("click", () => {
  pendingExport = null;
  confirmDialog.close();
});
confirmDialog.addEventListener("cancel", () => { pendingExport = null; });
confirmDialog.addEventListener("close", () => {
  if (!confirmDialog.open) pendingExport = null;
});
confirmGenerate.addEventListener("click", () => {
  if (!pendingExport) return;
  const { item, button } = pendingExport;
  pendingExport = null; // prevent double confirmation
  confirmDialog.close();
  void mockDownload(item, button);
});

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);
  return element;
}

function summaryBlock(label, value, kind) {
  const box = node("div", "stat");
  box.append(node("span", "stat-label", label));
  box.append(node("strong", "stat-value " + (kind || ""), value));
  return box;
}

function showDetail(item) {
  detailText.textContent = item.title + " / " + item.date +
    "\n\nこの詳細画面はモックです。実際のMy Communityには未接続です。";
  if (typeof dialog.showModal === "function") dialog.showModal();
  else output.textContent = detailText.textContent;
}

async function mockDownload(item, button) {
  if (button.disabled) return;
  const mode = demoMode.value;
  button.disabled = true;
  button.textContent = "取得中…";
  output.textContent = "模擬データで取得処理を試しています（Campfire通信なし）。";
  try {
    // Demo-only delay: makes the loading state visible. Never used by the API.
    await new Promise((resolve) => setTimeout(resolve, 350));
    if (mode === "busy") throw { status: 429 };
    if (mode === "timeout") throw { code: "TIMEOUT" };
    const result = buildParticipantCsv({
      event: item.event,
      members: item.members,
      rsvpStatuses: item.rsvpStatuses,
      allPagesComplete: mode !== "incomplete",
      allStatusesComplete: true,
    });
    const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = href;
      a.download = result.filename;
      a.style.display = "none";
      document.body.append(a);
      a.click();
      a.remove();
    } finally {
      // The object URL is local to this browser tab, never uploaded.
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    }
    output.textContent = "デモCSV生成完了：" + result.summary.rows + "件（架空のアカウントのみ）";
  } catch (error) {
    // The UI must never leak a raw API response or participant name on failures.
    const safeError = getPublicExportFailure(mode === "incomplete"
      ? { code: "INCOMPLETE" }
      : error);
    output.textContent = safeError.message + "（この画面では模擬エラーです）";
  } finally {
    button.disabled = false;
    button.textContent = "↓ CSV";
  }
}

for (const item of fakeEvents) {
  // These aggregate counts are mock equivalents of existing DB summary fields.
  // Never prefetch member details or generate CSV when rendering a list.
  const card = node("article", "meetup-card");
  const main = node("button", "card-primary");
  main.type = "button";
  main.setAttribute("aria-label", item.title + "の詳細を開く");
  main.append(node("div", "date", item.date));
  main.append(node("div", "title", item.title));
  main.addEventListener("click", () => showDetail(item));

  const footer = node("div", "card-footer");
  const stats = node("div", "stats");
  stats.append(
    summaryBlock("参加表明", item.counts.participating + "人"),
    summaryBlock("チェックイン", item.counts.checkedIn + "人", "green"),
  );
  const download = node("button", "csv-button", "↓ CSV");
  download.type = "button";
  download.setAttribute("aria-label", item.title + "のCSV生成の確認画面を開く");
  download.addEventListener("click", () => requestExportConfirmation(item, download));
  footer.append(stats, download);
  card.append(node("div", "status", item.status), main, footer);
  cards.append(card);
}

document.querySelector("#close-detail").addEventListener("click", () => dialog.close());
