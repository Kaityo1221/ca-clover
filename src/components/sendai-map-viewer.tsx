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
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);
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
          const detail = await result.json().catch(() => ({})) as {error?: string; code?: string};
          throw new Error((detail.error || "作戦MAPを読み込めません。") + (detail.code ? "（" + detail.code + "）" : ""));
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

  async function publishJson(file: File) {
    if (!isAdmin || uploading || !active) return;
    if (!window.confirm("CA名簿は除外して公開します。運営メモや個人情報が残っていないことを確認しましたか？")) {
      setPublishStatus("公開操作をキャンセルしました。");
      return;
    }
    setUploading(true);
    setPublishStatus("登録中：サーバーで保存と読み戻しを確認しています…");
    setStatus("公開用作戦データを登録しています…");
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
        const detail = await result.json().catch(() => ({})) as {error?: string; code?: string};
        throw new Error((detail.error || "作戦MAPを保存できません。") + (detail.code ? "（" + detail.code + "）" : ""));
      }
      setWorkspace(safeWorkspace);
      setPublishStatus("公開用JSONを登録しました。承認済みCAが閲覧できます。");
      setStatus("新しい作戦MAPを登録しました。閲覧画面へ反映しています…");
      // Recreate iframe to ensure a repeat publish applies the new snapshot.
      if (frame.current?.contentWindow) {
        frame.current.contentWindow.postMessage({ type: "sendai:load", workspace: safeWorkspace }, SIMULATOR_ORIGIN);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "作戦MAPを保存できません。";
      setPublishStatus("登録に失敗しました：" + message);
      setStatus(message);
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
          const file = event.target.files?.[0];
          if (file) {
            setSelectedFileName(file.name);
            setPublishStatus("選択したファイル：" + file.name);
            void publishJson(file);
          }
        }} />
      {selectedFileName ? <p className="mt-2 break-all text-xs font-bold text-slate-700">選択中：{selectedFileName}</p> : null}
      {publishStatus ? <p className="mt-2 break-words rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-800" role="status" aria-live="polite">{publishStatus}</p> : null}
      <p className="mt-1 text-[11px] text-lime-800">公開前に個人情報・内部メモを確認。CSV名簿は自動除外。既存の編集データは変更しません。</p>
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
