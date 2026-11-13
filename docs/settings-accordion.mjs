const SETTINGS_HTML="<section class=\"card settings-shell\">\n  <div id=\"settingsMenuScreen\">\n    <div class=\"settings-heading\">\n      <button type=\"button\" id=\"settingsBack\" class=\"linkbtn\">← My Community</button>\n      <span class=\"pill settings-caption\">SETTINGS</span>\n      <h1 class=\"settings-title\">⚙️ 環境設定</h1>\n      <p class=\"muted strong settings-subtitle\">CA Cloverの個人設定を管理する画面です。</p>\n    </div>\n    <nav class=\"settings-menu\" aria-label=\"環境設定メニュー\">\n      <button type=\"button\" id=\"settingsProfileLink\" class=\"settings-menu-card settings-profile-card\">\n        <span class=\"settings-avatar\" aria-hidden=\"true\"><span id=\"settingsPhotoPlaceholder\">📸</span><img id=\"settingsPhotoAvatar\" alt=\"\" hidden referrerpolicy=\"no-referrer\"></span>\n        <span class=\"settings-entry-label\"><strong>プロフィール写真・一言</strong><small>登録・変更・削除</small></span>\n        <span class=\"settings-arrow\" aria-hidden=\"true\">›</span>\n      </button>\n      <button type=\"button\" id=\"settingsAccountLink\" class=\"settings-menu-card\">\n        <span class=\"settings-entry-icon\" aria-hidden=\"true\">👤</span><span class=\"settings-entry-label\"><strong>アカウント</strong><small>登録情報の確認と管理</small></span><span class=\"settings-arrow\" aria-hidden=\"true\">›</span>\n      </button>\n      <button type=\"button\" class=\"settings-menu-card settings-future\" disabled>\n        <span class=\"settings-entry-icon\" aria-hidden=\"true\">🔔</span><span class=\"settings-entry-label\"><strong>通知設定</strong><small>お知らせの受け取り方法を設定します</small></span><span class=\"settings-future-mark\" aria-label=\"準備中\">準備中</span>\n      </button>\n      <button type=\"button\" class=\"settings-menu-card settings-future\" disabled>\n        <span class=\"settings-entry-icon\" aria-hidden=\"true\">🖥️</span><span class=\"settings-entry-label\"><strong>表示設定</strong><small>画面の表示や見た目を調整します</small></span><span class=\"settings-future-mark\" aria-label=\"準備中\">準備中</span>\n      </button>\n      <button type=\"button\" class=\"settings-menu-card settings-future\" disabled>\n        <span class=\"settings-entry-icon\" aria-hidden=\"true\">🛡️</span><span class=\"settings-entry-label\"><strong>プライバシー</strong><small>公開範囲やデータの取り扱いを設定します</small></span><span class=\"settings-future-mark\" aria-label=\"準備中\">準備中</span>\n      </button>\n    </nav>\n    <p class=\"settings-footnote\">ⓘ 今後も設定項目を追加予定です。</p>\n    <div class=\"settings-clover-landscape\" aria-hidden=\"true\"><span>🍀</span></div>\n  </div>\n  <div id=\"settingsProfileScreen\" hidden>\n    <button type=\"button\" id=\"settingsProfileBack\" class=\"linkbtn\">← 環境設定に戻る</button>\n    <span class=\"pill settings-caption\">PROFILE</span>\n    <h1 class=\"settings-title\">プロフィール設定</h1>\n    <p class=\"muted strong settings-subtitle\">写真と一言メッセージを管理できます。</p>\n    <section id=\"settingsPhotoPanel\" class=\"settings-detail-card\">\n      <h2 class=\"settings-detail-title\">📸 プロフィール写真</h2>\n      <p class=\"muted small strong\">中央で正方形に切り抜き、WebPまたはJPEG形式・最大256×256px・50KB以下に自動圧縮します。元画像や位置情報は送信しません。</p>\n      <div class=\"settings-photo-editor\">\n        <img id=\"profilePhotoPreview\" alt=\"プロフィール写真のプレビュー\" hidden>\n        <div class=\"settings-photo-file\">\n          <label for=\"profilePhotoInput\" class=\"tiny strong\">写真を選択（JPEG・PNG・WebP・HEIC）</label>\n          <input id=\"profilePhotoInput\" type=\"file\" accept=\"image/jpeg,image/png,image/webp,image/heic,image/heif\" class=\"input\">\n          <div id=\"profilePhotoInfo\" class=\"tiny muted\"></div>\n        </div>\n      </div>\n      <button type=\"button\" id=\"profilePhotoSave\" class=\"btn section\" disabled>プロフィール写真を保存</button>\n      <button type=\"button\" id=\"profilePhotoDelete\" class=\"btn line section\" disabled>登録済み写真を削除</button>\n      <p id=\"profilePhotoStatus\" class=\"tiny strong\" role=\"status\" aria-live=\"polite\">準備中…</p>\n    </section>\n    <section id=\"settingsMessagePanel\" class=\"settings-detail-card\">\n      <h2 class=\"settings-detail-title\">💬 一言メッセージ</h2>\n      <p class=\"muted small strong\">CAメダルを開いたときに表示する一言です。未登録なら表示しません。</p>\n      <label class=\"tiny strong\" for=\"exchangeMessageInput\">一言メッセージ（最大60文字・改行可）</label>\n      <textarea id=\"exchangeMessageInput\" class=\"input settings-textarea\" rows=\"3\" placeholder=\"東京から来ました！&#10;気軽に声をかけてください😊\"></textarea>\n      <div class=\"settings-counter\"><small class=\"muted\">絵文字も使えます</small><span id=\"exchangeMessageCount\">0 / 60文字</span></div>\n      <div id=\"exchangeMessagePreview\" class=\"settings-message-preview\" hidden>\n        <span>💬 プレビュー</span><p id=\"exchangeMessagePreviewText\"></p>\n      </div>\n      <div class=\"settings-button-row\">\n        <button id=\"exchangeMessageSave\" type=\"button\" class=\"btn\" disabled>一言を保存</button>\n        <button id=\"exchangeMessageDelete\" type=\"button\" class=\"btn line\" disabled>削除</button>\n      </div>\n      <p id=\"exchangeMessageStatus\" role=\"status\" aria-live=\"polite\" class=\"tiny strong\"></p>\n    </section>\n  </div>\n</section>";

export function mountSettings({host,client,session,role,onBack,onAccount}){
  host.innerHTML=SETTINGS_HTML;
  const allowed=(role==='ca'||role==='admin')&&!!session?.user?.id;
  const byId=id=>host.querySelector('#'+id);
  const main=byId('settingsMenuScreen'),detail=byId('settingsProfileScreen');
  const menuBack=byId('settingsBack'),profileLink=byId('settingsProfileLink'),profileBack=byId('settingsProfileBack'),account=byId('settingsAccountLink');
  let active=true,opening=0,photoLeave=null,messageLeave=null;
  function cleanupEditors(){
    if(photoLeave){photoLeave();photoLeave=null;}
    if(messageLeave){messageLeave();messageLeave=null;}
  }
  async function updateAvatar(){
    if(!active||!allowed)return;
    const avatar=byId('settingsPhotoAvatar'),placeholder=byId('settingsPhotoPlaceholder');
    try{
      const {data,error}=await client.from('ca_profile_photos').select('storage_path').eq('user_id',session.user.id).maybeSingle();
      if(!active||error)return;
      if(!data?.storage_path){
        avatar.hidden=true;avatar.removeAttribute('src');placeholder.hidden=false;return;
      }
      const signed=await client.storage.from('ca-profile-photos').createSignedUrl(data.storage_path,600);
      if(!active||signed.error||!signed.data?.signedUrl)return;
      avatar.onload=()=>{if(active){avatar.hidden=false;placeholder.hidden=true;}};
      avatar.onerror=()=>{if(active){avatar.hidden=true;placeholder.hidden=false;}};
      avatar.src=signed.data.signedUrl;
    }catch(_){}
  }
  async function openProfile(){
    const generation=++opening;
    main.hidden=true;
    detail.hidden=false;
    cleanupEditors();
    const mount=async(path,mountName,sectionId,statusId)=>{
      try{
        const module=await import(path);
        if(!active||generation!==opening||detail.hidden)return;
        return module[mountName]({host:byId(sectionId),client,session,role});
      }catch(_){
        if(active&&generation===opening){
          const status=byId(statusId);
          if(status)status.textContent='設定機能を読み込めませんでした。';
        }
        return null;
      }
    };
    photoLeave=await mount('./profile-photo.mjs?v=20261113-safari-jpeg1','mountProfilePhoto','settingsPhotoPanel','profilePhotoStatus');
    if(!active||generation!==opening||detail.hidden){cleanupEditors();return;}
    messageLeave=await mount('./exchange-message.mjs?v=20261114-message-label1','mountExchangeMessage','settingsMessagePanel','exchangeMessageStatus');
  }
  function returnToMenu(){
    ++opening;
    cleanupEditors();
    detail.hidden=true;
    main.hidden=false;
    void updateAvatar();
  }
  const back=()=>{++opening;cleanupEditors();onBack();};
  const onProfile=()=>{void openProfile();};
  menuBack.addEventListener('click',back);
  account.addEventListener('click',onAccount);
  profileLink.addEventListener('click',onProfile);
  profileBack.addEventListener('click',returnToMenu);
  void updateAvatar();
  return ()=>{
    active=false;++opening;cleanupEditors();
    menuBack.removeEventListener('click',back);
    account.removeEventListener('click',onAccount);
    profileLink.removeEventListener('click',onProfile);
    profileBack.removeEventListener('click',returnToMenu);
  };
}