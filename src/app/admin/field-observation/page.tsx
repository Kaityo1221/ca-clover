"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthProfile } from "@/lib/use-auth-profile";

type Position = { lat: number; lng: number; accuracyMeters: number; measuredAt: string };
type Observation = {
  id: string; squad: string; count: number; startedAt: string; endedAt: string | null;
  durationSec: number | null; category: string; memo: string;
  position: Position | null; corrected?: boolean; source: "timer" | "manual"; approved: false;
};
type FieldData = { version: 1; team: { squad: string; count: number } | null;
  active: Observation | null; observations: Observation[] };
const blank = (): FieldData => ({ version: 1, team: null, active: null, observations: [] });
const squads = ["ずんだ隊", "牛タン隊", "笹かま隊"];
const categories = ["未分類", "滞留", "信号", "狭い歩道", "危険", "順調"];
const now = () => new Date().toISOString();
const validDuration = (v: number) => Number.isSafeInteger(v) && v >= 0 && v <= 86400;
function safeParse(raw: string): FieldData {
  const s: unknown = JSON.parse(raw);
  if (!s || typeof s !== "object") throw Error("形式が不正です");
  const data = s as Partial<FieldData>;
  if (data.version !== 1 || !Array.isArray(data.observations) || data.observations.length > 10000) throw Error("形式が不正です");
  if (!data.observations.every(r => typeof r.id === "string" && typeof r.startedAt === "string" &&
    squads.includes(r.squad) && Number.isSafeInteger(r.count) && r.count >= 1 && r.count <= 1000 &&
    (r.durationSec === null || validDuration(r.durationSec)) &&
    (r.position === null || (Number.isFinite(r.position?.lat) && Number.isFinite(r.position?.lng))))) throw Error("記録形式が不正です");
  if (data.active && (typeof data.active.startedAt !== "string" || !squads.includes(data.active.squad))) throw Error("計測情報が不正です");
  return { version: 1, team: data.team ?? null, active: data.active ?? null, observations: data.observations };
}

export default function FieldObservationPage() {
  const { user, profile, loading, error, retry } = useAuthProfile();
  const allowed = !loading && !error && !!user && profile?.role === "admin";
  const key = user ? "clover-field-observations-v1:" + user.id : "";
  const [data, setData] = useState<FieldData>(blank);
  const [ready, setReady] = useState(false);
  const [squad, setSquad] = useState("牛タン隊");
  const [people, setPeople] = useState("45");
  const [category, setCategory] = useState("未分類");
  const [seconds, setSeconds] = useState("");
  const [memo, setMemo] = useState("");
  const [clock, setClock] = useState(Date.now());
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!allowed || !key) { setReady(false); setData(blank()); return; }
    try {
      const raw = window.localStorage.getItem(key);
      const restored = raw ? safeParse(raw) : blank();
      setData(restored);
      setSquad(restored.team?.squad ?? "牛タン隊");
      setPeople(String(restored.team?.count ?? 45));
      setMessage(restored.active ? "停止計測を復元しました。再開時刻を確認してください。" : "");
      setReady(true);
    } catch {
      setMessage("保存済み記録が破損しています。上書きせずJSONをバックアップしてください。");
      setReady(false);
    }
  }, [allowed, key]);
  useEffect(() => {
    if (!ready || !key) return;
    try { window.localStorage.setItem(key, JSON.stringify(data)); }
    catch { setMessage("端末への保存に失敗しました。JSONを書き出して保護してください。"); }
  }, [data, ready, key]);
  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  function change(mutator: (current: FieldData) => FieldData) { setData(current => mutator(current)); }
  function gps(id: string) {
    if (!navigator.geolocation) { setMessage("位置取得に対応していません。時刻は保存済みです。"); return; }
    navigator.geolocation.getCurrentPosition(
      p => {
        const pos: Position = { lat: p.coords.latitude, lng: p.coords.longitude, accuracyMeters: p.coords.accuracy, measuredAt: now() };
        change(s => ({ ...s, active: s.active?.id === id ? { ...s.active, position: pos } : s.active,
          observations: s.observations.map(o => o.id === id ? { ...o, position: pos } : o) }));
        setMessage("GPS位置を取得しました。");
      },
      () => setMessage("GPS取得失敗。時刻は保存しました。必要なら後で再取得できます。"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }
  function saveTeam() {
    const count = Number(people);
    if (!squads.includes(squad) || !Number.isSafeInteger(count) || count < 1 || count > 1000) {
      setMessage("人数は1〜1000の整数で入力してください。"); return;
    }
    change(s => ({ ...s, team: { squad, count } }));
    setMessage("隊と人数を保存しました。");
  }
  function stop() {
    if (!data.team || data.active) return;
    const id = crypto.randomUUID();
    const record: Observation = { id, squad: data.team.squad, count: data.team.count, startedAt: now(),
      endedAt: null, durationSec: null, category: "未分類", memo: "", position: null, source: "timer", approved: false };
    change(s => ({ ...s, active: record }));
    setMessage("停止開始時刻を保存しました。GPSを取得します。");
    gps(id);
  }
  function resume() {
    if (!data.active) return;
    const endedAt = now();
    const elapsed = Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(data.active.startedAt)) / 1000));
    const finished = { ...data.active, endedAt, durationSec: elapsed };
    change(s => ({ ...s, active: null, observations: [finished, ...s.observations] }));
    setMessage("進軍再開を記録しました。");
  }
  function manual() {
    if (!data.team || !validDuration(Number(seconds)) || seconds.trim() === "") {
      setMessage("停止時間を0〜86400秒で入力してください。"); return;
    }
    const endedAt = now();
    const id = crypto.randomUUID();
    const record: Observation = { id, squad: data.team.squad, count: data.team.count,
      startedAt: new Date(Date.parse(endedAt) - Number(seconds) * 1000).toISOString(),
      endedAt, durationSec: Number(seconds), category, memo, position: null, source: "manual", approved: false };
    change(s => ({ ...s, observations: [record, ...s.observations] }));
    setMemo(""); setSeconds(""); setMessage("手入力記録を保存しました。");
    gps(id);
  }
  function exportJson() {
    const blob = new Blob([JSON.stringify({ ...data, exportedAt: now() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "clover-field-observations-" + now().slice(0, 10) + ".json";
    document.body.append(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  async function importJson(file: File) {
    try {
      if (file.size > 3_000_000) throw Error("3MBを超えています");
      const parsed = safeParse(await file.text());
      if (!window.confirm("端末の現在の記録を置き換えますか？")) return;
      setData(parsed); setMessage("取り込みました。");
    } catch { setMessage("JSONを取り込めませんでした。元の記録は保持しました。"); }
  }
  if (loading) return <main className="p-8">認証確認中…</main>;
  if (error) return <main className="p-8"><p>{error}</p><button onClick={retry}>再確認</button></main>;
  if (!allowed) return <main className="p-8"><h1>🔒 管理者専用</h1><Link href="/">ホームへ戻る</Link></main>;
  const elapsed = data.active ? Math.max(0, Math.round((clock - Date.parse(data.active.startedAt)) / 1000)) : 0;
  return <main className="mx-auto max-w-xl space-y-4 px-4 py-6 text-slate-900">
    <Link href="/" className="text-sm font-bold text-green-700">← CA Clover Home</Link>
    <header className="rounded-2xl bg-green-950 p-5 text-white">
      <h1 className="text-xl font-black">🍀 仙台 現地観測</h1>
      <p className="mt-1 text-xs">管理者専用・端末内保存・本番作戦JSONと完全分離</p>
    </header>
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="font-bold">① 隊と集合人数</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <select aria-label="観測する隊" value={squad} onChange={e => setSquad(e.target.value)} className="rounded-lg border p-3">
          {squads.map(v => <option key={v}>{v}</option>)}
        </select>
        <input aria-label="現在人数" inputMode="numeric" type="number" min="1" max="1000" value={people} onChange={e => setPeople(e.target.value)} className="min-w-0 rounded-lg border p-3" />
      </div>
      <button disabled={!ready} onClick={saveTeam} className="mt-3 w-full rounded-xl bg-green-700 p-3 font-bold text-white">人数を記録・更新</button>
      <p className="mt-2 text-sm">記録中：{data.team ? data.team.squad + " " + data.team.count + "人" : "未設定"}</p>
    </section>
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="font-bold">② 停止・進軍再開</h2>
      <p className="my-2 text-xs text-slate-600">安全な場所で立ち止まってから操作してください。GPSは停止時の1回だけ取得します。</p>
      <div className="py-3 text-center text-4xl font-black" aria-live="off">{String(Math.floor(elapsed / 60)).padStart(2,"0")}:{String(elapsed % 60).padStart(2,"0")}</div>
      {data.active
        ? <button disabled={!ready} onClick={resume} className="w-full rounded-xl bg-green-700 p-6 text-xl font-black text-white">▶ 進軍再開・計測終了</button>
        : <button disabled={!ready || !data.team} onClick={stop} className="w-full rounded-xl bg-red-700 p-6 text-xl font-black text-white disabled:opacity-50">📍 停止！現在地を記録</button>}
      <p role="status" className="mt-3 text-sm text-amber-800">{message}</p>
    </section>
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="font-bold">③ 後から手入力</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <select aria-label="カテゴリ" value={category} onChange={e => setCategory(e.target.value)} className="rounded-lg border p-3">
          {categories.map(v => <option key={v}>{v}</option>)}
        </select>
        <input aria-label="停止時間 秒" inputMode="numeric" type="number" min="0" max="86400" placeholder="秒" value={seconds} onChange={e => setSeconds(e.target.value)} className="min-w-0 rounded-lg border p-3" />
      </div>
      <textarea aria-label="メモ" className="mt-2 w-full rounded-lg border p-3" placeholder="メモ（任意）" value={memo} onChange={e => setMemo(e.target.value)} />
      <button disabled={!ready || !data.team} onClick={manual} className="w-full rounded-xl bg-green-700 p-3 font-bold text-white disabled:opacity-50">＋ 手入力で追加</button>
    </section>
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="font-bold">④ 観測履歴 {data.observations.length}件</h2>
      {data.observations.map(r => <article key={r.id} className="mt-3 space-y-2 border-t pt-3">
        <p className="text-sm font-bold">{new Date(r.startedAt).toLocaleString("ja-JP")} / {r.squad} {r.count}人</p>
        <div className="grid grid-cols-2 gap-2">
          <select aria-label="原因分類" className="rounded-lg border p-2" value={r.category} onChange={e => change(s => ({ ...s, observations: s.observations.map(x => x.id === r.id ? { ...x, category: e.target.value } : x) }))}>
            {categories.map(v => <option key={v}>{v}</option>)}
          </select>
          <input aria-label="停止時間の補正 秒" className="min-w-0 rounded-lg border p-2" type="number" min="0" max="86400" value={r.durationSec ?? ""} onChange={e => {
            const n = Number(e.target.value);
            if (!validDuration(n) || e.target.value === "") return;
            change(s => ({ ...s, observations: s.observations.map(x => x.id === r.id ? { ...x, durationSec: n, corrected: true } : x) }));
          }} />
        </div>
        <textarea aria-label="観測メモ" className="w-full rounded-lg border p-2" value={r.memo} onChange={e => change(s => ({ ...s, observations: s.observations.map(x => x.id === r.id ? { ...x, memo: e.target.value } : x) }))} />
        <p className="text-xs text-slate-500">{r.position ? "GPS " + r.position.lat.toFixed(6) + ", " + r.position.lng.toFixed(6) + " / ±" + Math.round(r.position.accuracyMeters) + "m" : "GPS 未取得"}</p>
        <div className="flex gap-2">
          <button onClick={() => gps(r.id)} className="rounded-lg bg-slate-100 p-2 text-sm">現在地再取得</button>
          <button onClick={() => { if (window.confirm("この記録を削除しますか？")) change(s => ({ ...s, observations: s.observations.filter(x => x.id !== r.id) })); }} className="rounded-lg bg-red-50 p-2 text-sm text-red-700">削除</button>
        </div>
      </article>)}
    </section>
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="font-bold">⑤ 独立データ管理</h2>
      <p className="my-2 text-xs text-slate-600">端末内に保存します。クラウド同期やAI学習への自動送信はありません。Safariのサイトデータ消去で失われるためJSONをバックアップしてください。</p>
      <button onClick={exportJson} disabled={!ready} className="rounded-xl bg-slate-100 p-3 font-bold">JSON書き出し</button>
      <label className="mt-3 block text-sm">JSON読み込み <input type="file" accept=".json,application/json" onChange={e => { const f=e.target.files?.[0]; if(f) void importJson(f); e.target.value=""; }} /></label>
    </section>
  </main>;
}
