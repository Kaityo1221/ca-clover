const SETTINGS_HTML="<section class=\"card settings-shell\">\n <button type=\"button\" id=\"settingsBack\" class=\"linkbtn\">← My Community</button>\n <span class=\"pill settings-caption\">SETTINGS</span>\n <h1 class=\"settings-title\">⚙️ 環境設定</h1>\n <p class=\"muted strong settings-subtitle\">CA Cloverの個人設定を管理する画面です。</p>\n <div class=\"settings-menu\">\n  <section class=\"settings-entry\" id=\"settingsPhotoEntry\">\n   <button type=\"button\" class=\"settings-toggle\" id=\"settingsPhotoToggle\" aria-controls=\"settingsPhotoPanel\" aria-expanded=\"false\">\n    <span class=\"settings-avatar\"><span id=\"settingsPhotoPlaceholder\">📸</span><img id=\"settingsPhotoAvatar\" alt=\"\" hidden referrerpolicy=\"no-referrer\"></span>\n    <span class=\"settings-entry-label\"><strong>プロフィール写真</strong><small id=\"settingsPhotoSummary\">登録・変更・削除</small></span><span class=\"settings-arrow\" aria-hidden=\"true\">⌄</span>\n   </button>\n   <div id=\"settingsPhotoPanel\" class=\"settings-panel\" hidden>\n    <p class=\"muted small strong\">中央で正方形に切り抜き、WebPまたはJPEG形式・最大256×256px・50KB以下に自動圧縮します。元画像や位置情報は送信しません。</p>\n    <div class=\"settings-photo-editor\"><img id=\"profilePhotoPreview\" alt=\"プロフィール写真のプレビュー\" hidden><div class=\"settings-photo-file\"><label for=\"profilePhotoInput\" class=\"tiny strong\">写真を選択（JPEG・PNG・WebP・HEIC）</label><input id=\"profilePhotoInput\" type=\"file\" accept=\"image/jpeg,image/png,image/webp,image/heic,image/heif\" class=\"input\"><div id=\"profilePhotoInfo\" class=\"tiny muted\"></div></div></div>\n    <button type=\"button\" id=\"profilePhotoSave\" class=\"btn section\" disabled>プロフィール写真を保存</button>\n    <button type=\"button\" id=\"profilePhotoDelete\" class=\"btn line section\" disabled>登録済み写真を削除</button>\n    <p id=\"profilePhotoStatus\" class=\"tiny strong\" role=\"status\" aria-live=\"polite\">準備中…</p>\n   </div>\n  </section>\n  <section class=\"settings-entry\" id=\"settingsMessageEntry\">\n   <button type=\"button\" class=\"settings-toggle\" id=\"settingsMessageToggle\" aria-controls=\"settingsMessagePanel\" aria-expanded=\"false\">\n    <span class=\"settings-entry-icon\" aria-hidden=\"true\">💬</span>\n    <span class=\"settings-entry-label\"><strong>交換時の一言</strong><small id=\"settingsMessageSummary\">未登録</small></span><span class=\"settings-arrow\" aria-hidden=\"true\">⌄</span>\n   </button>\n   <div id=\"settingsMessagePanel\" class=\"settings-panel\" hidden>\n    <p class=\"muted small strong\">CAメダルを開いたときに表示する一言を登録できます。未設定なら表示しません。</p>\n    <label class=\"tiny strong\" for=\"exchangeMessageInput\">交換時の一言（最大60文字・改行可）</label>\n    <textarea id=\"exchangeMessageInput\" class=\"input settings-textarea\" rows=\"3\" placeholder=\"東京から来ました！&#10;気軽に声をかけてください😊\"></textarea>\n    <div class=\"settings-counter\"><small class=\"muted\">絵文字も使えます</small><span id=\"exchangeMessageCount\">0 / 60文字</span></div>\n    <div id=\"exchangeMessagePreview\" class=\"settings-message-preview\" hidden><span>💬 メダル表示プレビュー</span><p id=\"exchangeMessagePreviewText\"></p></div>\n    <div class=\"settings-button-row\"><button id=\"exchangeMessageSave\" type=\"button\" class=\"btn\" disabled>一言を保存</button><button id=\"exchangeMessageDelete\" type=\"button\" class=\"btn line\" disabled>削除</button></div>\n    <p id=\"exchangeMessageStatus\" role=\"status\" aria-live=\"polite\" class=\"tiny strong\"></p>\n   </div>\n  </section>\n  <button type=\"button\" class=\"settings-future\" disabled><span aria-hidden=\"true\">🔔</span><span><strong>通知設定</strong><small>今後追加予定</small></span><span aria-hidden=\"true\">🔒</span></button>\n  <button type=\"button\" class=\"settings-future\" disabled><span aria-hidden=\"true\">🖥️</span><span><strong>表示設定</strong><small>今後追加予定</small></span><span aria-hidden=\"true\">🔒</span></button>\n  <button type=\"button\" class=\"settings-future\" disabled><span aria-hidden=\"true\">🛡️</span><span><strong>プライバシー</strong><small>今後追加予定</small></span><span aria-hidden=\"true\">🔒</span></button>\n  <button type=\"button\" id=\"settingsAccountLink\" class=\"settings-future\"><span aria-hidden=\"true\">👤</span><span><strong>アカウント</strong><small>登録情報・ログアウト</small></span><span aria-hidden=\"true\">›</span></button>\n </div>\n <p class=\"settings-footnote\">🍀 設定項目は今後も追加予定です。</p>\n</section>";

export function mountSettings({host,client,session,role,onBack,onAccount}){
 host.innerHTML=SETTINGS_HTML;
 const allowed=role==='ca'||role==='admin';
 const byId=id=>host.querySelector('#'+id);
 byId('settingsBack').addEventListener('click',onBack);
 byId('settingsAccountLink').addEventListener('click',onAccount);
 const panels={photo:byId('settingsPhotoPanel'),message:byId('settingsMessagePanel')};
 const toggles={photo:byId('settingsPhotoToggle'),message:byId('settingsMessageToggle')};
 let generation=0,active=true,photoLeave=null,messageLeave=null;
 function clearMounted(){
   if(photoLeave){photoLeave();photoLeave=null;}
   if(messageLeave){messageLeave();messageLeave=null;}
 }
 async function photoSummary(){
   if(!active||!allowed)return;
   try{
     const {data,error}=await client.from('ca_profile_photos').select('storage_path').eq('user_id',session.user.id).maybeSingle();
     if(!active||error)return;
     byId('settingsPhotoSummary').textContent=data?.storage_path?'登録済み':'未登録';
     const avatar=byId('settingsPhotoAvatar'),placeholder=byId('settingsPhotoPlaceholder');
     if(!data?.storage_path){avatar.hidden=true;avatar.removeAttribute('src');placeholder.hidden=false;return;}
     const signed=await client.storage.from('ca-profile-photos').createSignedUrl(data.storage_path,600);
     if(!active||signed.error||!signed.data?.signedUrl)return;
     avatar.onload=()=>{if(active){avatar.hidden=false;placeholder.hidden=true;}};
     avatar.onerror=()=>{if(active){avatar.hidden=true;placeholder.hidden=false;}};
     avatar.src=signed.data.signedUrl;
   }catch(_){}
 }
 async function messageSummary(){
   if(!active||!allowed)return;
   try{
     const {data,error}=await client.from('ca_exchange_messages').select('message').eq('user_id',session.user.id).maybeSingle();
     if(!active||error)return;
     byId('settingsMessageSummary').textContent=data?.message?'登録済み':'未登録';
   }catch(_){}
 }
 async function togglePanel(key){
   const open=panels[key].hidden;
   const request=++generation;
   clearMounted();
   for(const name of Object.keys(panels)){
     panels[name].hidden=true;
     toggles[name].setAttribute('aria-expanded','false');
   }
   if(!open){if(key==='photo')void photoSummary();return;}
   panels[key].hidden=false;
   toggles[key].setAttribute('aria-expanded','true');
   try{
     if(key==='photo'){
       const module=await import('./profile-photo.mjs?v=20261113-safari-jpeg1');
       if(!active||request!==generation||panels.photo.hidden)return;
       photoLeave=module.mountProfilePhoto({host:panels.photo,client,session,role});
     }else{
       const module=await import('./exchange-message.mjs?v=20261113-settings1');
       if(!active||request!==generation||panels.message.hidden)return;
       messageLeave=module.mountExchangeMessage({
         host:panels.message,client,session,role,
         onChange:value=>{if(active)byId('settingsMessageSummary').textContent=value?'登録済み':'未登録';}
       });
     }
   }catch(_){
     if(!active||request!==generation)return;
     const status=byId(key==='photo'?'profilePhotoStatus':'exchangeMessageStatus');
     if(status)status.textContent='設定機能を読み込めませんでした。';
   }
 }
 const onPhoto=()=>{void togglePanel('photo')};
 const onMessage=()=>{void togglePanel('message')};
 toggles.photo.addEventListener('click',onPhoto);
 toggles.message.addEventListener('click',onMessage);
 void photoSummary();
 void messageSummary();
 return ()=>{
   active=false;++generation;clearMounted();
   toggles.photo.removeEventListener('click',onPhoto);
   toggles.message.removeEventListener('click',onMessage);
   byId('settingsBack')?.removeEventListener('click',onBack);
   byId('settingsAccountLink')?.removeEventListener('click',onAccount);
 };
}
