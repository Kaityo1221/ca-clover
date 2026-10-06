"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PREFECTURE_ORDER } from "@/lib/prefecture-order";

type Props = {
  acquiredPrefectures: ReadonlySet<string>;
  acquiredStampCount: number;
  onSelectPrefecture?: (prefecture: string) => void;
};

const CODE_TO_PREFECTURE = Object.fromEntries(
  PREFECTURE_ORDER.map((prefecture,index)=>[String(index+1).padStart(2,"0"),prefecture])
);

export function StampJapanMap({ acquiredPrefectures, acquiredStampCount, onSelectPrefecture }: Props) {
  const [svg,setSvg]=useState("");
  const mapRef=useRef<HTMLDivElement|null>(null);
  const acquiredCount=useMemo(
    ()=>PREFECTURE_ORDER.filter(prefecture=>acquiredPrefectures.has(prefecture)).length,
    [acquiredPrefectures],
  );

  useEffect(()=>{
    let alive=true;
    void fetch("/geolonia-map-mobile.svg")
      .then(response=>{
        if(!response.ok) throw new Error("map load failed");
        return response.text();
      })
      .then(text=>{if(alive) setSvg(text);})
      .catch(()=>{if(alive) setSvg("");});
    return()=>{alive=false;};
  },[]);

  useEffect(()=>{
    const root=mapRef.current;
    if(!root||!svg) return;
    const prefectures=root.querySelectorAll<SVGGElement>(".prefecture");
    prefectures.forEach(element=>{
      const code=element.dataset.code??"";
      const prefecture=CODE_TO_PREFECTURE[code];
      const acquired=Boolean(prefecture&&acquiredPrefectures.has(prefecture));
      element.style.fill=acquired?"#78a866":"#eeeeee";
      element.style.stroke=acquired?"#527943":"#8f948d";
      element.style.strokeWidth=acquired?"1.4":"1";
      element.style.cursor=prefecture?"pointer":"default";
      element.style.transition="fill .2s ease, stroke .2s ease";
      element.setAttribute("role","button");
      element.setAttribute("tabindex","0");
      element.setAttribute("aria-label",prefecture+(acquired?" 交換済み":" 未交換"));
      const activate=()=>{
        if(prefecture) onSelectPrefecture?.(prefecture);
      };
      element.onclick=activate;
      element.onkeydown=(event)=>{
        if(event.key==="Enter"||event.key===" "){
          event.preventDefault();
          activate();
        }
      };
    });
  },[acquiredPrefectures,onSelectPrefecture,svg]);

  return <section className="mt-5 overflow-hidden rounded-[30px] border border-[#d7e3cf] bg-gradient-to-b from-[#f8fcf5] to-white p-4 shadow-[0_16px_38px_rgba(77,112,61,.10)] sm:p-6">
    <div className="flex items-end justify-between gap-4">
      <div>
        <div className="text-[10px] font-black tracking-[.18em] text-[#6f9560]">JAPAN MAP</div>
        <h2 className="mt-1 text-xl font-black text-[#3d4938] sm:text-2xl">出会いで、日本が緑になる。</h2>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-2xl font-black text-[#4f7d3b]">{acquiredCount}<span className="ml-1 text-xs text-[#8ca082]">/ 47</span></div>
        <div className="text-[9px] font-black text-[#87947f]">交流した都道府県</div>
      </div>
    </div>

    <div className="mt-4 overflow-hidden rounded-[24px] border border-[#e2eadc] bg-white p-1 sm:p-2">
      {svg
        ?<div
          ref={mapRef}
          className="mx-auto w-full max-w-[760px] [&_.geolonia-svg-map]:block [&_.geolonia-svg-map]:h-auto [&_.geolonia-svg-map]:w-full"
          dangerouslySetInnerHTML={{__html:svg}}
        />
        :<div className="grid aspect-square place-items-center text-sm font-black text-[#819078]">日本地図を読み込み中... 🗾</div>}
    </div>

    <div className="mt-3 flex items-center justify-between gap-3 rounded-[18px] bg-[#eef5e9] px-4 py-3">
      <div className="text-[10px] font-bold leading-4 text-[#6d7d65]">
        CAとスタンプ交換すると、そのCAのCommunityがある都道府県が点灯します。
      </div>
      <div className="shrink-0 text-right">
        <div className="text-lg font-black text-[#4f7d3b]">{acquiredStampCount}</div>
        <div className="text-[9px] font-black text-[#819078]">獲得スタンプ</div>
      </div>
    </div>

    <div className="mt-2 text-right text-[8px] font-bold text-[#a0a79b]">
      Map: Geolonia Japanese Prefectures / GFDL
    </div>
  </section>;
}
