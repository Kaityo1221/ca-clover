export type CaMasterRecord = {
  sourceKey: string;
  trainerName: string;
  caLevel: "1st" | "2nd";
  communityName: string;
  campfireUrl: string;
  communityId: string | null;
  prefecture: string;
  joinDate: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
};

export const DEFAULT_CA_MASTER_SHEET =
  "https://docs.google.com/spreadsheets/d/1BtPjOxNX4JhttKKJa_-qrIXdVmK5UsbAX-RcLmLTuwk/edit?gid=1086182934#gid=1086182934";

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

function findHeader(header: string[], names: string[]) {
  for (const name of names) {
    const index = header.indexOf(name);
    if (index >= 0) return index;
  }
  return -1;
}

export function toCsvExportUrl(sheetUrl: string) {
  const id = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  if (!id) throw new Error("Google Sheet URLを認識できません");
  const gid = sheetUrl.match(/[?#&]gid=(\d+)/)?.[1] ?? "0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (char !== "\r") cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

function parseNumber(value: string | undefined) {
  const number = Number.parseFloat((value ?? "").trim());
  return Number.isFinite(number) ? number : null;
}

function normalizeDate(value: string) {
  const raw = value.trim();
  if (!raw) return null;
  const ymd = raw.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  return null;
}

export function extractCommunityId(campfireUrl: string) {
  try {
    const url = new URL(campfireUrl);
    const encoded = url.searchParams.get("deep_link_sub1");
    if (!encoded) return null;
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    const params = new URLSearchParams(decoded);
    const id = params.get("c");
    return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function parseCaMasterCsv(csv: string): CaMasterRecord[] {
  const rows = parseCsv(csv);
  if (rows.length < 2) return [];
  const header = rows[0].map(normalizeHeader);
  const index = {
    name: header.indexOf("pgo trainer name"),
    second: header.indexOf("2nd ca"),
    group: header.indexOf("campfire group name"),
    url: header.indexOf("campfire url"),
    city: header.indexOf("primary city"),
    date: header.indexOf("ca join date"),
    status: findHeader(header, ["status", "ステータス", "状態"]),
    lat: findHeader(header, ["lng 緯度", "lat 緯度", "緯度", "latitude", "lat"]),
    lng: findHeader(header, ["lat 経度", "lng 経度", "経度", "longitude", "lng"]),
  };

  if (index.name < 0 || index.group < 0 || index.city < 0) {
    throw new Error("CA masterの必須列が見つかりません");
  }

  return rows.slice(1).flatMap((row) => {
    const trainerName = (row[index.name] ?? "").trim();
    const communityName = (row[index.group] ?? "").trim();
    const city = (row[index.city] ?? "").trim();
    const prefecture = city.match(/^\d{2}_(.+)$/)?.[1] ?? city;
    if (!trainerName || !communityName || !prefecture) return [];

    const campfireUrl = index.url >= 0 ? (row[index.url] ?? "").trim() : "";
    const communityId = extractCommunityId(campfireUrl);
    const latitude = index.lat >= 0 ? parseNumber(row[index.lat]) : null;
    const longitude = index.lng >= 0 ? parseNumber(row[index.lng]) : null;
    const second = index.second >= 0 ? (row[index.second] ?? "").trim() : "";

    return [{
      sourceKey: `${trainerName.toLowerCase()}|${communityId ?? communityName.toLowerCase()}`,
      trainerName,
      caLevel: second ? "2nd" : "1st",
      communityName,
      campfireUrl,
      communityId,
      prefecture,
      joinDate: index.date >= 0 ? normalizeDate(row[index.date] ?? "") : null,
      status: index.status >= 0 ? (row[index.status] ?? "").trim() : "",
      latitude,
      longitude,
    }];
  });
}
