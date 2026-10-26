"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { sendaiMapIsActive } from "@/lib/sendai-map-policy";

const SIMULATOR_ORIGIN = "https://meetup-operations-simulator.vercel.app";
const SIMULATOR_VIEWER = SIMULATOR_ORIGIN + "/?cloverViewer=1";

type Props = { supabase: ReturnType<typeof createBrowserSupabaseClient>; isAdmin: boolean };

export function SendaiMapViewer({ supabase, isAdmin }: Props) {
  const [active, setActive] = useState(sendaiMapIsActive);
  const [workspace, setWorkspace] = useState<unknown>(null);
  const [status, setStatus] = useState("公開用の作戦MAPを確認しています…");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [publishStatus, setPublishStatus] = useState("");
  const [publishError, setPublishError] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setActive(sendaiMapIsActive()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    async function load() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session?.access_token) throw new Error("ログインが必要です。");
        const result = await fetch("/api/sendai-map", {
          method: "GET",
          headers: { Authorization: "Bearer " + data.session.access_token },
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!result.ok) {
          const detail = await result.json().catch(() => ({})) as {error?: string};
          throw new Error(detail.error || "作戦MAPを読み込めません。");
        }
        const payload = await result.json() as {workspace?: unknown};
        if (!payload.workspace) throw new Error("公開データがありません。");
        if (!cancelled) { setWorkspace(payload.workspace); setStatus("閲覧専用MAPを開いています…"); }
      } catch (error) {
        if (!cancelled) setStatus(error instanceof Error ? error.message : "作戦MAPを読み込めません。");
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [active, supabase]);

  useEffect(() => {
    const received = (event: MessageEvent) => {
      if (event.origin !== SIMULATOR_ORIGIN || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "sendai:loaded") setStatus("作戦MAPを表示しています。");
    };
    window.addEventListener("message", received);
    return () => window.removeEventListener("message", received);
  }, []);

  async function publishJson() {
    const file = selectedFile;
    if (!file || !isAdmin || uploading || !active) return;
    if (!window.confirm("CA名簿は除外して公開します。運営メモや個人情報が残っていないことを確認しましたか？")) return;
    setUploading(true);
    setPublishStatus("登録中…");
    setPublishError("");
    try {
      if (file.size > 3_500_000) throw new Error("JSONが大きすぎます（上限3.5MB）。");
      const raw = JSON.parse(await file.text()) as Record<string, unknown>;
      if (!raw || typeof raw !== "object" || typeof raw.current !== "string" || !raw.plans) {
        throw new Error("作戦JSONの形式が違います。");
      }
      // CA roster must never enter the published snapshot.
      const { caRoster: _privateRoster, ...safeWorkspace } = raw;
      void _privateRoster;
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.access_token) throw new Error("ログイン状態を再確認してください。");
      const result = await fetch("/api/sendai-map", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + data.session.access_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(safeWorkspace),
        cache: "no-store",
      });
      if (!result.ok) {
        const detail = await result.json().catch(() => ({})) as {error?: string; detail?: string};
        throw new Error([detail.error || "作戦MAPを保存できません。", detail.detail].filter(Boolean).join("："));
      }
      // The private store must be readable before we tell the ADMIN it is published.
      const confirmed = await fetch("/api/sendai-map", {
        headers: { Authorization: "Bearer " + data.session.access_token },
        cache: "no-store",
      });
      if (!confirmed.ok) {
        const detail = await confirmed.json().catch(() => ({})) as {error?: string};
        throw new Error("保存後の取得確認ができません：" + (detail.error || String(confirmed.status)));
      }
      const verified = await confirmed.json() as {workspace?: unknown};
      if (!verified.workspace) throw new Error("保存後の作戦データが空です。");
      setWorkspace(verified.workspace);
      setSelectedFile(null);
      setPublishStatus("公開完了！ 承認済みCAも閲覧できます。");
      setStatus("閲覧専用MAPを開いています…");
      // Recreate iframe to ensure a repeat publish applies the new snapshot.
      if (frame.current?.contentWindow) {
        frame.current.contentWindow.postMessage({ type: "sendai:load", workspace: verified.workspace }, SIMULATOR_ORIGIN);
      }
    } catch (error) {
      setPublishStatus("");
      setPublishError(error instanceof Error ? error.message : "作戦MAPを保存できません。");
    } finally {
      setUploading(false);
    }
  }

  if (!active) return null;
  return <section className="clover-card mt-7 overflow-hidden p-4 md:p-6" aria-label="仙台シティミートアップ作戦MAP">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><div className="text-xs font-black text-lime-700">11月9日（月）まで / 承認済みCA限定</div>
        <h2 className="mt-1 text-xl font-black text-lime-950">🏴 仙台シティミートアップ2026 作戦MAP</h2></div>
      <span className="rounded-full bg-lime-100 px-3 py-1 text-xs font-black text-lime-900">閲覧・再生専用</span>
    </div>
    <p className="mt-2 text-sm text-slate-600">3部隊の進軍ルートやタイムラインを確認できます。編集・保存はできません。</p>
    {isAdmin ? <div className="mt-3 rounded-xl border border-dashed border-lime-300 bg-lime-50 p-3">
      <label className="block text-xs font-black text-lime-900" htmlFor="sendaiMapPublish">ADMIN専用：Simulatorから保存した作戦JSONを公開</label>
      <input id="sendaiMapPublish" aria-label="作戦JSONを公開" type="file" accept=".json,application/json"
        disabled={uploading} className="mt-2 block w-full text-xs"
        onChange={event => {
          const file = event.target.files?.[0] ?? null;
          setSelectedFile(file);
          setPublishError("");
          setPublishStatus(file ? "選択済み。下の「公開する」で確定してください。" : "");
        }} />
      {selectedFile ? <p className="mt-2 break-all text-xs font-semibold text-lime-900" data-testid="sendai-selected-file">
        選択中：{selectedFile.name}（{Math.ceil(selectedFile.size / 1024)}KB）
      </p> : null}
      <button type="button" onClick={() => void publishJson()} disabled={!selectedFile || uploading}
        className="mt-2 rounded-lg bg-lime-700 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
        {uploading ? "登録しています…" : "このJSONを公開する"}
      </button>
      {publishStatus ? <p role="status" className="mt-2 text-xs font-bold text-lime-900">{publishStatus}</p> : null}
      {publishError ? <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-xs font-bold text-red-800">登録失敗：{publishError}。ファイルは選択されたままなので再試行できます。</p> : null}
      <p className="mt-2 text-[11px] text-lime-800">公開前に個人情報・内部メモを確認。CSV名簿は自動除外。既存の編集データは変更しません。</p>
    </div> : null}
    <div className="mt-4 overflow-hidden rounded-2xl border border-lime-100 bg-slate-50">
      {workspace ? <iframe ref={frame} title="仙台シティミートアップ 作戦再生" src={SIMULATOR_VIEWER}
        onLoad={() => frame.current?.contentWindow?.postMessage({ type: "sendai:load", workspace }, SIMULATOR_ORIGIN)}
        className="h-[65vh] min-h-[420px] w-full border-0" loading="lazy"
        sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer"/> :
        <div className="grid min-h-44 place-items-center px-5 text-center text-sm font-semibold text-slate-600">{status}</div>}
    </div>
    <p className="mt-2 text-xs text-slate-500" role="status" aria-live="polite">{status}</p>
  </section>;
}
