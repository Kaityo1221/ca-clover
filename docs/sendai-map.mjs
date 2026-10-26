// Authenticated transport only. Workspace and JWT are never persisted here.
export const EXPIRES_AT = Date.parse('2026-11-10T00:00:00+09:00');
export const API = 'https://ca-clover.vercel.app/api/sendai-map';
export const SIMULATOR_ORIGIN = 'https://meetup-operations-simulator.vercel.app';
export const allowed = role => role === 'admin' || role === 'ca';
export const active = (now = Date.now()) => Number.isFinite(now) && now < EXPIRES_AT;
export function mountSendaiMap({host, client, getIdentity, fetcher = fetch}) {
  let disposed = false, frame = null, workspace = null, selected = null, uploading = false;
  const identity = getIdentity();
  if (!host || !identity.userId || !allowed(identity.role) || !active()) return () => {};
  host.innerHTML = '<section class="card section" aria-label="仙台シティミートアップ作戦MAP"><span class="pill">11月9日まで・承認済みCA限定</span><h2 style="margin-top:10px">🏴 仙台シティミートアップ2026 作戦MAP</h2><p class="muted small strong">3部隊の進軍ルートとタイムラインを閲覧・再生できます。</p><button type="button" class="btn section" data-open>作戦MAPを開く</button><div data-admin></div><p data-status role="status" aria-live="polite" class="small strong"></p><div data-map></div></section>';
  const status = host.querySelector('[data-status]');
  const map = host.querySelector('[data-map]');
  const open = host.querySelector('[data-open]');
  function current() { const next = getIdentity(); return !disposed && host.isConnected && next.userId === identity.userId && allowed(next.role) && active(); }
  function clear() { workspace = null; if (frame) frame.remove(); frame = null; }
  function leave() { disposed = true; clear(); selected = null; clearInterval(timer); window.removeEventListener('message', receive); host.replaceChildren(); }
  function say(message) { if (!disposed) status.textContent = message; }
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
    if (!current()) return;
    if (!data?.plans || typeof data.current !== 'string' || !Object.hasOwn(data.plans, data.current)) throw new Error('作戦データの形式が違います。');
    clear(); workspace = data;
    frame = document.createElement('iframe');
    frame.title = '仙台シティミートアップ 作戦再生';
    frame.src = SIMULATOR_ORIGIN+'/?cloverViewer=1';
    frame.setAttribute('sandbox','allow-scripts allow-same-origin');
    frame.referrerPolicy = 'no-referrer';
    frame.style.cssText = 'width:100%;height:70vh;min-height:420px;border:1px solid #d9e8c7;border-radius:16px;margin-top:14px';
    frame.addEventListener('load', () => { if (current() && workspace) frame.contentWindow.postMessage({type:'sendai:load',workspace}, SIMULATOR_ORIGIN); });
    map.append(frame); say('作戦MAPを読み込んでいます…');
  }
  async function load() {
    open.disabled = true; say('承認状態と作戦データを確認しています…');
    try { const result = await request('GET'); show(result.workspace); } catch(error) { say(error.message); }
    finally { if (!disposed) open.disabled = false; }
  }
  function receive(event) { if (current() && event.origin === SIMULATOR_ORIGIN && event.source === frame?.contentWindow && event.data?.type === 'sendai:loaded') say('作戦MAPを表示しています。'); }
  window.addEventListener('message', receive);
  open.onclick = load;
  if (identity.role === 'admin') {
    const area = host.querySelector('[data-admin]');
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
        show(result.workspace); say('登録・読み戻し確認が完了しました。承認済みCAが閲覧できます。');
      } catch(error) { say('登録失敗：'+error.message); }
      finally { uploading = false; if (!disposed) { input.disabled = false; publish.disabled = !selected; } }
    };
  }
  const timer = setInterval(() => { if (!current()) { leave(); return; } if (frame) request('HEAD').catch(error => { clear(); say(error.message); }); }, 30_000);
  return leave;
}
