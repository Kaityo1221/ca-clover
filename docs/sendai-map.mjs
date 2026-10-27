// Authenticated transport only. Workspace and JWT are never persisted here.
export const EXPIRES_AT = Date.parse('2026-11-10T00:00:00+09:00');
export const API = 'https://ca-clover.vercel.app/api/sendai-map';
export const SIMULATOR_ORIGIN = 'https://meetup-operations-simulator.vercel.app';
export const allowed = role => role === 'admin' || role === 'ca';
export const active = (now = Date.now()) => Number.isFinite(now) && now < EXPIRES_AT;
export function mountSendaiMap({host, client, getIdentity, fetcher = fetch}) {
  let disposed = false, frame = null, workspace = null, selected = null, uploading = false;
  let pendingWorkspace = null, pollBusy = false;
  const identity = getIdentity();
  if (!host || !identity.userId || !allowed(identity.role) || !active()) return () => {};
  if (!document.getElementById('sendai-map-sheet-style')) {
    const style=document.createElement('style'); style.id='sendai-map-sheet-style';
    style.textContent=`
      .sm-entry{display:flex;flex-direction:column;align-items:flex-end;gap:5px;width:96px;max-width:100%}
      .sm-launcher-caption{font-size:10px;line-height:1.4;font-weight:800;color:#4d7c0f;text-align:right}.sm-launcher-caption span{display:block}
      .sm-launcher-caption{animation:sm-caption-glow 5s ease-in-out infinite}
      @keyframes sm-caption-glow{0%,60%,100%{color:#4d7c0f;text-shadow:none}75%,85%{color:#65a30d;text-shadow:0 0 6px #bef264,0 0 12px #d9f99d}}
      @media(prefers-reduced-motion:reduce){.sm-launcher-caption{animation:none}}
      .sm-launcher{width:44px;height:44px;display:grid;place-items:center;border:1px solid #c8e997;border-radius:14px;background:linear-gradient(135deg,#f7fee7,#e2f7b9);color:#365314;padding:0;box-shadow:0 3px 10px #3653140d}
      .sm-launcher:hover{border-color:#84cc16;background:#ecfccb}
      .sm-launcher-icon{font-size:23px;line-height:1}
      .sm-launcher:focus-visible,.sm-close:focus-visible{outline:3px solid #65a30d;outline-offset:2px}
      dialog.sm-sheet{position:fixed;inset:0;width:100%;max-width:none;height:100vh;height:100dvh;max-height:none;margin:0;padding:0;border:0;background:#f7fee7;color:#1f2937;overflow:hidden;overscroll-behavior:none}
      dialog.sm-sheet[open]{display:flex;flex-direction:column}
      .sm-sheet::backdrop{background:#18314066}
      .sm-sheet-head{flex:none;padding:max(8px,env(safe-area-inset-top)) 14px 8px;background:#fff;border-bottom:1px solid #e2edcc;touch-action:none;user-select:none;cursor:grab}
      .sm-grip{width:40px;height:4px;border-radius:9px;background:#cbd5c0;margin:0 auto 7px}
      .sm-title-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
      .sm-sheet h2{font-size:16px;margin:0;color:#365314;line-height:1.3}
      .sm-hint{font-size:10px;color:#64748b;margin-top:3px}
      .sm-close{flex:none;width:44px;height:44px;border:0;border-radius:50%;background:#f1f5e9;color:#365314;font-size:24px;padding:0}
      .sm-status{flex:none;padding:6px 14px;font-size:11px;line-height:1.5;margin:0;overflow-wrap:anywhere;background:#f7fee7}
      .sm-map{flex:1;min-height:0;position:relative;display:flex;background:#edf2e6;padding-bottom:env(safe-area-inset-bottom)}
      .sm-map iframe{display:block;flex:1;width:100%;height:100%;min-height:0;border:0}
      .sm-admin{position:absolute;inset:0;z-index:2;background:#fff;overflow:auto;padding:16px;overscroll-behavior:contain}
      .sm-admin[hidden]{display:none}
      .sm-admin .section{margin-top:12px}
      .sm-manage{flex:none;border:0;border-radius:10px;background:#ecfccb;color:#365314;font-size:11px;padding:8px;font-weight:800}
      .sm-admin p{line-height:1.5}
      .sm-update{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;background:#e8f6e8;border-bottom:1px solid #a7d2ac;font-size:12px;font-weight:700}
      .sm-update[hidden]{display:none}
      .sm-update button{background:#166b4c;color:white;border:0;border-radius:9px;padding:9px 12px;font-size:12px;font-weight:800;min-height:38px}
      @media(prefers-reduced-motion:reduce){.sm-sheet{scroll-behavior:auto}}
    `;
    document.head.append(style);
  }
  host.innerHTML='<div class="sm-entry"><span class="sm-launcher-caption"><span>仙台シティ</span><span>ミートアップ</span></span><button type="button" class="sm-launcher" data-open title="仙台シティミートアップの作戦MAP" aria-label="仙台作戦MAPを開く" aria-haspopup="dialog" aria-expanded="false"><span class="sm-launcher-icon" aria-hidden="true">🏴</span></button></div>';
  const open=host.querySelector('[data-open]');
  const sheet=document.createElement('dialog'); sheet.className='sm-sheet';
  sheet.setAttribute('aria-labelledby','sendai-sheet-title');
  sheet.innerHTML='<header class="sm-sheet-head" data-drag><div class="sm-grip"></div><div class="sm-title-row"><div><h2 id="sendai-sheet-title">🏴 仙台作戦MAP</h2><div class="sm-hint">下にスワイプで閉じる · 11月9日まで</div></div><div style="display:flex;align-items:center;gap:8px"><button type="button" class="sm-manage" data-manage hidden>JSON登録</button><button type="button" class="sm-close" data-close aria-label="作戦MAPを閉じる">×</button></div></div></header><p class="sm-status" data-status role="status" aria-live="polite"></p><div class="sm-update" data-update hidden><span>新しい作戦が公開されました</span><button type="button" data-apply-update>最新作戦に切り替える</button></div><div class="sm-map" data-map><div class="sm-admin" data-admin hidden></div></div>';
  document.body.append(sheet);
  const status=sheet.querySelector('[data-status]'), map=sheet.querySelector('[data-map]');
  const manage=sheet.querySelector('[data-manage]'), area=sheet.querySelector('[data-admin]');
  const updateBanner=sheet.querySelector('[data-update]');
  let generation=0, previousOverflow=null, previousFocus=null, motion=null;
  const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function current() { const next = getIdentity(); return !disposed && host.isConnected && next.userId === identity.userId && allowed(next.role) && active(); }
  function clear() { workspace = null; pendingWorkspace = null; updateBanner.hidden = true; if (frame) frame.remove(); frame = null; }
  function animate(frames) { motion?.cancel(); motion=reduced()?null:sheet.animate(frames,{duration:240,easing:'cubic-bezier(.2,.8,.2,1)'}); return motion; }
  function finishClose() {
    generation++; clear(); motion?.cancel(); motion=null;
    if (sheet.open) sheet.close();
    sheet.style.transform='';
    open.setAttribute('aria-expanded','false');
    if (previousOverflow !== null) { document.body.style.overflow=previousOverflow; previousOverflow=null; }
    if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
  }
  function closeSheet() {
    if (!sheet.open) return;
    generation++; clear();
    const animation=animate([{transform:sheet.style.transform||'translateY(0)'},{transform:'translateY(100%)'}]);
    if (animation) animation.finished.then(finishClose,()=>{}); else finishClose();
  }
  function leave() { disposed = true; finishClose(); selected = null; clearInterval(timer); window.removeEventListener('message', receive); sheet.remove(); host.replaceChildren(); }
  function say(message) { if (!disposed) status.textContent = message; }
  sheet.querySelector('[data-close]').onclick=closeSheet;
  sheet.addEventListener('cancel',event=>{event.preventDefault();closeSheet();});
  const handle=sheet.querySelector('[data-drag]'); let drag=null;
  handle.addEventListener('pointerdown',event=>{
    if (event.target.closest('button') || !event.isPrimary) return;
    drag={x:event.clientX,y:event.clientY,id:event.pointerId,dy:0}; motion?.cancel();motion=null;
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove',event=>{
    if (!drag || event.pointerId!==drag.id) return;
    drag.dy=Math.max(0,event.clientY-drag.y);
    sheet.style.transform='translateY('+drag.dy+'px)';
  });
  function endDrag(event) {
    if (!drag || event.pointerId!==drag.id) return;
    const dismiss=drag.dy>80&&Math.abs(event.clientX-drag.x)<drag.dy; drag=null;
    if (dismiss && event.type!=='pointercancel') closeSheet();
    else { animate([{transform:sheet.style.transform},{transform:'translateY(0)'}]);sheet.style.transform=''; }
  }
  handle.addEventListener('pointerup',endDrag);handle.addEventListener('pointercancel',endDrag);
  async function request(method, body) {
    if (!current()) throw new Error('ログイン状態・公開期間を確認してください。');
    const {data, error} = await client.auth.getSession();
    if (error || !data.session?.access_token || data.session.user.id !== identity.userId) throw new Error('再ログインしてください。');
    const response = await fetcher(API, {method, headers:{Authorization:'Bearer '+data.session.access_token, ...(body ? {'Content-Type':'application/json'} : {})}, ...(body ? {body} : {}), cache:'no-store', credentials:'omit'});
    if (!current()) throw new Error('閲覧を終了しました。');
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { if (response.status === 401 || response.status === 403 || response.status === 410) clear(); throw new Error((result.error || '作戦MAPを読み込めません。') + (result.code ? '（'+result.code+'）' : '')); }
    return result;
  }
  function show(data) {
    if (!current() || !sheet.open) return;
    if (!data?.plans || typeof data.current !== 'string' || !Object.hasOwn(data.plans, data.current)) throw new Error('作戦データの形式が違います。');
    clear(); workspace = data;
    frame = document.createElement('iframe');
    frame.title = '仙台シティミートアップ 作戦再生';
    frame.src = SIMULATOR_ORIGIN+'/?cloverViewer=1';
    frame.setAttribute('sandbox','allow-scripts allow-same-origin');
    frame.referrerPolicy = 'no-referrer';
    frame.style.cssText = 'width:100%;height:100%;min-height:0;border:0';
    frame.addEventListener('load', () => { if (current() && workspace) frame.contentWindow.postMessage({type:'sendai:load',workspace}, SIMULATOR_ORIGIN); });
    map.append(frame); say('作戦MAPを読み込んでいます…');
  }
  // Poll the authenticated GET endpoint, not an unauthenticated storage URL.
  // Keep playback untouched until the viewer explicitly accepts the update.
  async function checkForUpdate() {
    if (pollBusy || !current() || !sheet.open || !frame || !workspace) return;
    pollBusy = true;
    const ticket = generation, displayed = workspace;
    try {
      const result = await request('GET');
      if (ticket !== generation || !sheet.open || workspace !== displayed || !frame) return;
      if (!result.workspace?.plans || typeof result.workspace.current !== 'string' ||
          !Object.hasOwn(result.workspace.plans,result.workspace.current)) return;
      if (JSON.stringify(result.workspace) !== JSON.stringify(displayed)) {
        pendingWorkspace = result.workspace;
        updateBanner.hidden = false;
      } else {
        pendingWorkspace = null;
        updateBanner.hidden = true;
      }
    } catch(error) {
      // request() already clears the iframe if access is revoked.
      if (ticket === generation && current() && !frame) say(error.message);
    } finally { pollBusy = false; }
  }
  sheet.querySelector('[data-apply-update]').onclick = () => {
    if (!current() || !sheet.open || !pendingWorkspace) return;
    const latest = pendingWorkspace;
    generation++; // invalidate any in-flight checks before changing the iframe
    show(latest);
  };
  async function load() {
    const ticket=++generation; say('承認状態と作戦データを確認しています…');
    try { const result = await request('GET'); if(ticket===generation) show(result.workspace); }
    catch(error) { if(ticket===generation) say(error.message); }
  }
  function receive(event) { if (current() && sheet.open && event.origin === SIMULATOR_ORIGIN && event.source === frame?.contentWindow && event.data?.type === 'sendai:loaded') { if(!status.textContent.includes('登録・読み戻し確認が完了')) say('作戦MAPを表示しています。'); } }
  window.addEventListener('message', receive);
  open.onclick = () => {
    if (!current() || sheet.open) return;
    previousFocus=document.activeElement; previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';sheet.style.transform='';area.hidden=true;
    sheet.showModal(); open.setAttribute('aria-expanded','true');
    sheet.querySelector('[data-close]').focus({preventScroll:true});
    animate([{transform:'translateY(100%)'},{transform:'translateY(0)'}]);void load();
  };
  if (identity.role === 'admin') {
    manage.hidden=false;
    manage.onclick=()=>{area.hidden=!area.hidden;manage.setAttribute('aria-expanded',String(!area.hidden));};
    area.innerHTML = '<div class="section"><label class="small strong">ADMIN専用：作戦JSONを登録<input data-file type="file" accept=".json,application/json" style="display:block;max-width:100%;margin-top:8px"></label><p data-file-name class="small" style="overflow-wrap:anywhere"></p><button data-publish type="button" class="btn line section" disabled>このJSONを登録する</button></div>';
    const input = area.querySelector('[data-file]');
    const name = area.querySelector('[data-file-name]');
    const publish = area.querySelector('[data-publish]');
    input.onchange = () => { selected = input.files[0] || null; name.textContent = selected ? selected.name+'（'+selected.size.toLocaleString()+' bytes）' : ''; publish.disabled = !selected; };
    publish.onclick = async () => {
      if (uploading || !selected || !current() || getIdentity().role !== 'admin') return;
      uploading = true; input.disabled = publish.disabled = true; say('登録・読み戻し確認中…');
      try {
        if (selected.size > 3_500_000) throw new Error('JSONの上限は3.5MBです。');
        const raw = JSON.parse(await selected.text());
        const {caRoster, ...safe} = raw; void caRoster;
        await request('POST',JSON.stringify(safe));
        const result = await request('GET');
        if (JSON.stringify(result.workspace) !== JSON.stringify(safe)) throw new Error('読み戻した作戦データが一致しません。再読込してください。');
        area.hidden=true;manage.setAttribute('aria-expanded','false');
        show(result.workspace); say('登録・読み戻し確認が完了しました。承認済みCAが閲覧できます。');
      } catch(error) { say('登録失敗：'+error.message); }
      finally { uploading = false; if (!disposed) { input.disabled = false; publish.disabled = !selected; } }
    };
  }
  const timer = setInterval(() => { if (!current()) { leave(); return; } if (sheet.open && frame) void checkForUpdate(); }, 30_000);
  return leave;
}
