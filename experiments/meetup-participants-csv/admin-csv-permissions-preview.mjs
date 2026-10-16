import { canAdminGrantCsvExport } from "./csv-permission.mjs";

// Synthetic, ephemeral ADMIN UX ONLY. Never writes permissions or stores CA names.
const fakeAccounts = [
  { id: "sample-01", name: "テストCA 01", role: "ca", community: "サンプルCommunity A", granted: false },
  { id: "sample-02", name: "テストCA 02", role: "ca", community: "サンプルCommunity B", granted: false },
  { id: "sample-03", name: "承認待ちテスト", role: "pending", community: "未割当", granted: false },
];

const root = document.querySelector("#accounts");
const feedback = document.querySelector("#feedback");

function element(tag, className, content) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (content !== undefined) el.textContent = content;
  return el;
}

function render() {
  root.replaceChildren();
  for (const account of fakeAccounts) {
    const card = element("article", "account");
    const nameGroup = element("div");
    nameGroup.append(element("div", "name", account.name));
    nameGroup.append(element("div", "meta", account.community + " / " + account.role.toUpperCase()));
    const controls = element("div", "controls");
    controls.append(element("span", account.granted ? "permission on" : "permission",
      account.granted ? "CSV権限：あり" : "CSV権限：なし"));
    const toggle = element("button", account.granted ? "active" : "",
      account.granted ? "CSV権限を解除" : "CSV権限を付与");
    toggle.type = "button";
    toggle.dataset.accountId = account.id;
    toggle.disabled = !canAdminGrantCsvExport({ actorRole: "admin", targetRole: account.role });
    toggle.setAttribute("aria-label", account.name + "のCSV出力権限を" + (account.granted ? "解除" : "付与"));
    toggle.addEventListener("click", () => {
      if (!canAdminGrantCsvExport({ actorRole: "admin", targetRole: account.role })) return;
      account.granted = !account.granted;
      feedback.textContent = account.name + "の模擬CSV権限を" +
        (account.granted ? "ON" : "OFF") + "にしました（保存・通信なし）。";
      render();
    });
    controls.append(toggle);
    card.append(nameGroup, controls);
    root.append(card);
  }
}

render();
