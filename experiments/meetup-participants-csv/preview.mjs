import { buildParticipantCsv } from "./csv-core.mjs";

// FICTIONAL DATA ONLY. This preview makes no network or Supabase requests.
const fakeEvents = [
  {
    event: { id: "demo-past-001", eventTime: "2026-10-11T14:00:00+09:00" },
    title: "コミュニティ・デイ ミートアップ", date: "2026.10.11（日）14:00", status: "終了",
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
  button.disabled = true;
  button.textContent = "取得中…";
  output.textContent = "模擬データからCSVを生成しています（Campfire通信なし）。";
  try {
    const result = buildParticipantCsv({
      event: item.event,
      members: item.members,
      rsvpStatuses: item.rsvpStatuses,
      allPagesComplete: true,
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
  } catch {
    // Avoid including raw participant fields or API responses in diagnostics.
    output.textContent = "CSV生成に失敗しました。取得状況を確認してください。";
  } finally {
    button.disabled = false;
    button.textContent = "↓ CSV";
  }
}

for (const item of fakeEvents) {
  const result = buildParticipantCsv({
    event: item.event,
    members: item.members,
    rsvpStatuses: item.rsvpStatuses,
    allPagesComplete: true,
    allStatusesComplete: true,
  });
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
    summaryBlock("参加表明", result.summary.participating + "人"),
    summaryBlock("チェックイン", result.summary.checkedIn + "人", "green"),
  );
  const download = node("button", "csv-button", "↓ CSV");
  download.type = "button";
  download.setAttribute("aria-label", item.title + "のCSVをダウンロード");
  download.addEventListener("click", () => mockDownload(item, download));
  footer.append(stats, download);
  card.append(node("div", "status", item.status), main, footer);
  cards.append(card);
}

document.querySelector("#close-detail").addEventListener("click", () => dialog.close());
