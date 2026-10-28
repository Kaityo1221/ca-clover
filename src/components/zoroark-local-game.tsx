"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import {
  TALK_TOPICS, winner, type DifficultyChoice, type Round,
} from "@/lib/zoroark-game";

type Phase = "setup" | "pass" | "talk" | "vote" | "result";
type TalkMode = "free" | "rounds";

function formatSeconds(value: number): string {
  const v = Math.max(0, Math.ceil(value));
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
}

const mainButton = "w-full rounded-2xl bg-lime-400 px-4 py-3.5 text-base font-black text-lime-950 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-extrabold text-slate-700 disabled:opacity-50";

export function ZoroarkLocalGame() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [count, setCount] = useState(6);
  const [level, setLevel] = useState<DifficultyChoice>("all");
  const [duration, setDuration] = useState(180);
  const [mode, setMode] = useState<TalkMode>("free");
  const [round, setRound] = useState<Round | null>(null);
  const [roundNumber, setRoundNumber] = useState(0);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [remaining, setRemaining] = useState(180);
  const [running, setRunning] = useState(false);
  const [talkRound, setTalkRound] = useState(1);
  const [topicIndex, setTopicIndex] = useState(0);
  const [voted, setVoted] = useState<number | null>(null);
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requestInFlight = useRef(false);
  const deadline = useRef(0);
  const history = useRef<string[]>([]);

  useEffect(() => {
    try {
      const data: unknown = JSON.parse(sessionStorage.getItem("clover-zoroark-pairs-v1") || "[]");
      history.current = Array.isArray(data)
        ? [...new Set(data.filter((v): v is string => typeof v === "string" && /^[a-z][0-9]{2}$/.test(v)))].slice(-6)
        : [];
    } catch { history.current = []; }
  }, []);

  useEffect(() => {
    const hidePrompt = () => {
      if (document.visibilityState !== "visible") setVisible(false);
    };
    document.addEventListener("visibilitychange", hidePrompt);
    return () => document.removeEventListener("visibilitychange", hidePrompt);
  }, []);

  useEffect(() => {
    if (!running || phase !== "talk" || duration === 0) return;
    const timer = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) setRunning(false);
    }, 200);
    return () => window.clearInterval(timer);
  }, [duration, phase, running]);

  async function begin() {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setError("");
    setVisible(false);
    setRound(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const {data, error: sessionError} = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (sessionError || !token) throw new Error("ログイン状態を再確認してください。");
      // GitHub Pages is a static entrypoint, not the Next.js API host.
      const api = window.location.origin === "https://kaityo1221.github.io"
        ? "https://ca-clover.vercel.app/api/zoroark/round"
        : "/api/zoroark/round";
      const result = await fetch(api, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({count, difficulty: level, recent: history.current}),
        cache: "no-store",
        credentials: "omit",
      });
      const payload = await result.json().catch(() => ({})) as {round?: Round; error?: string};
      if (!result.ok) throw new Error(payload.error || "ゲームを開始できません。");
      const newRound = payload.round;
      if (!newRound || !Array.isArray(newRound.prompts) || newRound.prompts.length !== count ||
          !Number.isInteger(newRound.wolf) || newRound.wolf < 0 || newRound.wolf >= count) {
        throw new Error("お題の配布内容を検証できませんでした。");
      }
      history.current = [...history.current, newRound.pair.id].slice(-6);
      try { sessionStorage.setItem("clover-zoroark-pairs-v1", JSON.stringify(history.current)); } catch {}
      setRound(newRound);
      setRoundNumber(n => n + 1);
      setPlayerIndex(0);
      setRemaining(duration);
      setRunning(false);
      setTalkRound(1);
      setTopicIndex((previous) => (previous + 1) % TALK_TOPICS.length);
      setVoted(null);
      setReveal(false);
      setPhase("pass");
    } catch (cause) {
      setRound(null);
      setPhase("setup");
      setError(cause instanceof Error ? cause.message : "お題を取得できませんでした。");
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  function reset() {
    setRunning(false);
    setVisible(false);
    setRound(null);
    setVoted(null);
    setReveal(false);
    setError("");
    setPhase("setup");
  }

  function nextPlayer() {
    if (!round) return;
    setVisible(false);
    if (playerIndex + 1 >= round.count) {
      setPhase("talk");
    } else {
      setPlayerIndex(i => i + 1);
    }
  }

  function toggleTimer() {
    if (!duration || phase !== "talk") return;
    if (running) {
      setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
      setRunning(false);
    } else if (remaining > 0) {
      deadline.current = Date.now() + remaining * 1000;
      setRunning(true);
    }
  }

  function extendTimer() {
    if (!duration) return;
    setRemaining(n => n + 30);
    if (running) deadline.current += 30000;
  }

  return (
    <section className="mx-auto mt-6 w-full max-w-xl rounded-[28px] border border-lime-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-lime-100 px-3 py-1 text-[11px] font-black text-lime-900">🦊 GM専用・現地プレイ</span>
        <span className="text-xs font-black text-slate-400">ROUND {roundNumber || "準備"}</span>
      </div>

      {phase === "setup" && <>
        <h2 className="mt-5 text-2xl font-black text-lime-950">ゲームを準備する</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
          CAのスマホを順番に回します。参加者が自分だけのお題を確認し、みんなでゾロアークを探します。
        </p>
        <label className="mt-6 block text-sm font-black text-slate-700">参加人数（GMは含めない）</label>
        <div className="mt-2 flex items-center justify-center gap-5">
          <button className={secondaryButton + " max-w-16"} aria-label="人数を減らす" onClick={() => setCount(n => Math.max(3, n - 1))}>−</button>
          <strong className="min-w-14 text-center text-4xl text-lime-950">{count}</strong>
          <button className={secondaryButton + " max-w-16"} aria-label="人数を増やす" onClick={() => setCount(n => Math.min(12, n + 1))}>＋</button>
        </div>
        <p className="mt-1 text-center text-xs font-bold text-slate-500">推奨6〜8人・3〜12人対応</p>
        <label htmlFor="zoroark-difficulty" className="mt-5 block text-sm font-black text-slate-700">お題の難易度</label>
        <select id="zoroark-difficulty" value={level} onChange={e => setLevel(e.target.value as DifficultyChoice)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900">
          <option value="all">おまかせ（全42組）</option>
          <option value="easy">初級（12組）</option>
          <option value="normal">中級（15組）</option>
          <option value="hard">上級（15組）</option>
        </select>
        <label htmlFor="zoroark-mode" className="mt-5 block text-sm font-black text-slate-700">会話の進め方</label>
        <select id="zoroark-mode" value={mode} onChange={e => setMode(e.target.value as TalkMode)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900">
          <option value="free">フリートーク</option><option value="rounds">順番に2周</option>
        </select>
        <label htmlFor="zoroark-duration" className="mt-5 block text-sm font-black text-slate-700">トーク時間</label>
        <select id="zoroark-duration" value={duration} onChange={e => setDuration(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900">
          <option value={120}>2分</option><option value={180}>3分</option><option value={300}>5分</option><option value={0}>制限なし</option>
        </select>
        <p className="mt-5 rounded-xl bg-lime-50 p-3 text-sm font-semibold leading-6 text-lime-950">🎭 ポケモンの名前は言わない。嘘やブラフはOK！</p>
        {error ? <p role="alert" className="mt-3 text-sm font-bold text-rose-700">{error}</p> : null}
        <button className={mainButton + " mt-5"} onClick={() => void begin()} disabled={busy}>{busy ? "CA権限を確認しています…" : "ゲームを開始する"}</button>
      </>}

      {phase === "pass" && round && <>
        <h2 className="mt-5 text-2xl font-black text-lime-950">プレイヤー {playerIndex + 1} / {round.count}</h2>
        <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-black leading-6 text-amber-900">
          ⚠️ プレイヤー{playerIndex + 1}だけが画面を見てください。次の人に渡す前に必ず隠しましょう。
        </p>
        <div className="mt-4 flex gap-1.5">{round.prompts.map((_, i) => <span key={i} className={"h-1.5 flex-1 rounded-full " + (i < playerIndex ? "bg-lime-500" : "bg-slate-200")} />)}</div>
        <div className="mt-4 flex min-h-56 flex-col items-center justify-center rounded-[24px] border-2 border-slate-200 bg-slate-900 p-5 text-center text-white">
          {visible ? <>
            <span className="text-xs font-bold text-lime-200">あなたの秘密のお題</span>
            <strong className="mt-5 text-3xl font-black">{round.prompts[playerIndex]}</strong>
            <p className="mt-4 text-sm font-semibold text-slate-200">名前を言わずに特徴を話そう</p>
          </> : <><span className="text-6xl">🔒</span><p className="mt-5 text-sm font-semibold text-slate-100">本人だけがお題を開いてください</p></>}
        </div>
        <div className="mt-5 grid gap-3">
          {visible ?
            <button className={mainButton} onClick={nextPlayer}>確認した・お題を隠す</button> :
            <button className={mainButton} onClick={() => setVisible(true)}>自分のお題を見る</button>}
          <button className={secondaryButton} onClick={reset}>人数設定に戻る</button>
        </div>
      </>}

      {phase === "talk" && round && <>
        <h2 className="mt-5 text-2xl font-black text-lime-950">会話で探り合おう！</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">発言は自由。嘘もOKです。GMは全員に話す機会を作ってください。</p>
        <p className="mt-4 rounded-xl bg-lime-50 p-3 text-sm font-black text-lime-900">
          🎤 {mode === "free" ? "フリートーク" : `順番に2周・${talkRound}周目`}
        </p>
        <div className="my-6 text-center text-6xl font-black tabular-nums text-lime-950">{duration ? formatSeconds(remaining) : "∞"}</div>
        <div className="grid grid-cols-2 gap-3">
          <button className={secondaryButton} onClick={toggleTimer} disabled={!duration || (!running && remaining === 0)}>{running ? "⏸ 一時停止" : "▶ タイマー開始"}</button>
          <button className={secondaryButton} onClick={extendTimer} disabled={!duration}>＋30秒</button>
          <button className={secondaryButton} onClick={() => setTopicIndex(i => (i + 1) % TALK_TOPICS.length)}>🎤 話題を変える</button>
          <button className={secondaryButton} onClick={() => setTalkRound(n => n === 1 ? 2 : 1)}>🔁 次の周へ</button>
        </div>
        <div className="mt-5 rounded-2xl border border-lime-200 bg-lime-50 p-4">
          <div className="text-xs font-black text-lime-800">GM向けトーク補助</div>
          <p className="mt-2 text-base font-black text-lime-950">{TALK_TOPICS[topicIndex]}</p>
        </div>
        <button className={mainButton + " mt-5"} onClick={() => { setRunning(false); setPhase("vote"); }}>指差し投票へ</button>
      </>}

      {phase === "vote" && round && <>
        <h2 className="mt-5 text-2xl font-black text-lime-950">ゾロアークは誰だ？</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">みんなで「せーの！」と指差し。最多得票の人をGMが入力します。同票なら決選投票で1人を選びます。</p>
        <div className="mt-5 grid grid-cols-4 gap-2">
          {round.prompts.map((_, i) => <button key={i} aria-pressed={voted === i + 1}
            className={voted === i + 1 ? "rounded-xl bg-lime-400 px-2 py-4 font-black text-lime-950" : "rounded-xl border border-slate-200 px-2 py-4 font-black text-slate-800"}
            onClick={() => setVoted(i + 1)}>{i + 1}番</button>)}
        </div>
        <button className={mainButton + " mt-5"} disabled={voted === null} onClick={() => { setReveal(false); setPhase("result"); }}>判定画面へ</button>
        <button className={secondaryButton + " mt-3"} onClick={() => setPhase("talk")}>トークに戻る</button>
      </>}

      {phase === "result" && round && voted !== null && <>
        <h2 className="mt-5 text-2xl font-black text-lime-950">正体発表！</h2>
        {reveal ? <>
          <div className="mt-5 rounded-[24px] bg-gradient-to-br from-purple-800 via-indigo-800 to-slate-900 p-7 text-center text-white">
            <div className="animate-bounce text-7xl" aria-hidden>🦊</div>
            <div className="mt-4 text-sm font-black">ゾロアークは…</div>
            <div className="mt-2 text-5xl font-black">{round.wolf + 1}番！</div>
          </div>
          <div className="mt-5 rounded-2xl bg-lime-50 px-4 py-4 text-center text-xl font-black text-lime-950">
            {winner(round, voted) === "villagers" ? "🎉 多数派の勝ち！" : "🎭 ゾロアークの勝ち！"}
          </div>
          <p className="mt-4 text-sm font-semibold leading-7 text-slate-700">
            最多得票：{voted}番<br />多数派：<strong>{round.majority}</strong><br />少数派：<strong>{round.minority}</strong>
          </p>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-7 text-slate-700">
            共通点：{round.pair.common}<br />違い：{round.pair.difference}
          </div>
          <button className={mainButton + " mt-5"} onClick={() => void begin()} disabled={busy}>{busy ? "準備中…" : "次のゲームへ"}</button>
          <button className={secondaryButton + " mt-3"} onClick={reset}>人数設定へ戻る</button>
        </> : <>
          <div className="mt-4 rounded-2xl bg-slate-900 p-10 text-center text-6xl text-white">🎭</div>
          <p className="mt-4 text-center text-sm font-bold text-slate-600">みんなが見ている状態で公開しましょう！</p>
          <button className={mainButton + " mt-5"} onClick={() => setReveal(true)}>🦊 正体を公開する</button>
        </>}
      </>}
    </section>
  );
}
