/* CA Clover | Medal Rally aggregate utilities. Read-only; one completed pair = one exchange. */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.StampExchangeStats = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;

  function jstDate(iso) {
    const time = Date.parse(iso);
    if (!Number.isFinite(time)) throw new Error("Invalid exchange timestamp");
    return new Date(time + JST_OFFSET_MS).toISOString().slice(0, 10);
  }

  function nextDay(day) {
    const time = Date.parse(day + "T00:00:00.000Z");
    return new Date(time + DAY_MS).toISOString().slice(0, 10);
  }

  function build(records, asOf) {
    if (!Array.isArray(records)) throw new TypeError("Exchange records must be an array");
    const today = jstDate(asOf || new Date().toISOString());
    const seen = new Set();
    const daily = new Map();
    let first = null;
    let last = null;
    let invalid = 0;
    for (const record of records) {
      if (!record || !record.exchange_key || seen.has(record.exchange_key)) continue;
      seen.add(record.exchange_key);
      if (!record.completed_at) {
        invalid += 1;
        continue;
      }
      let date;
      try { date = jstDate(record.completed_at); }
      catch (_) { invalid += 1; continue; }
      if (date > today) { invalid += 1; continue; }
      daily.set(date, (daily.get(date) || 0) + 1);
      if (!first || date < first) first = date;
      if (!last || date > last) last = date;
    }
    if (invalid) throw new Error("交換完了日時が未確定の記録が " + invalid + " 件あります。集計を停止しました。");
    let cumulative = 0;
    const days = [];
    for (let day = first; day && day <= today; day = nextDay(day)) {
      const count = daily.get(day) || 0;
      cumulative += count;
      days.push({ day, count, cumulative });
    }
    return { total: cumulative, firstDate: first, lastDate: last, asOfDate: today, days };
  }

  function recent(days, period) {
    if (period === "all") return days.slice();
    const n = period === "7" ? 7 : 30;
    return days.slice(-n);
  }

  return Object.freeze({ jstDate, build, recent });
});
