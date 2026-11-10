// Isolated profile photo UI. No storage writes until both explicit preview gate and RLS migration are enabled.
export function mountProfilePhoto({host, client, session, role}) {
  const MAX_BYTES = 50 * 1024;
  const BUCKET = 'ca-profile-photos';
  const TABLE = 'ca_profile_photos';
  const allowed = role === 'ca' || role === 'admin';
  // The production page does not define this flag. Fail closed on all current deployments.
  const writeEnabled = window.CA_PROFILE_PHOTO_UPLOAD_ENABLED === true;
  const input = host.querySelector('#profilePhotoInput');
  const image = host.querySelector('#profilePhotoPreview');
  const save = host.querySelector('#profilePhotoSave');
  const msg = host.querySelector('#profilePhotoStatus');
  const removeButton = host.querySelector('#profilePhotoDelete');
  const info = host.querySelector('#profilePhotoInfo');
  let blob = null;
  let previewUrl = null;
  let signedUrl = null;
  let active = true;
  let working = false;
  const setStatus = (s) => { if (active) msg.textContent = s; };
  const clearPreview = () => { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = null; };
  function setImage(url) {
    if (!active) return;
    image.src = url || '';
    image.hidden = !url;
  }
  function validateFile(file) {
    if (!file || !file.type.startsWith('image/')) throw Error('画像ファイルを選択してください。');
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.type))
      throw Error('JPEG・PNG・WebP・HEICから選択してください。');
    if (file.size > 15 * 1024 * 1024) throw Error('元画像は15MB以内にしてください。');
  }
  async function compress(file) {
    validateFile(file);
    const url = URL.createObjectURL(file);
    const source = new Image();
    try {
      await new Promise((resolve, reject) => {
        source.onload = resolve;
        source.onerror = () => reject(Error('画像を読み込めません。別の画像を選択してください。'));
        source.src = url;
      });
      if (!source.naturalWidth || !source.naturalHeight || source.naturalWidth * source.naturalHeight > 80000000)
        throw Error('画像の縦横サイズが大きすぎます。');
      let side = 256;
      const crop = Math.min(source.naturalWidth, source.naturalHeight);
      const left = Math.floor((source.naturalWidth - crop) / 2);
      const top = Math.floor((source.naturalHeight - crop) / 2);
      for (; side >= 64; side = Math.floor(side * .8)) {
        const canvas = document.createElement('canvas');
        canvas.width = side;
        canvas.height = side;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw Error('画像変換に対応していないブラウザです。');
        ctx.drawImage(source, left, top, crop, crop, 0, 0, side, side);
        for (const quality of [.8, .7, .6, .5]) {
          const out = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
          // Safari may silently fall back to PNG; never store the wrong MIME as WebP.
          if (out && out.type === 'image/webp' && out.size <= MAX_BYTES) return out;
        }
      }
      throw Error('50KB以下に圧縮できませんでした。別の画像を選択してください。');
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  async function showStored() {
    if (!allowed) return;
    const {data, error} = await client.from(TABLE).select('storage_path').eq('user_id', session.user.id).maybeSingle();
    if (!active) return;
    if (error) { setStatus('写真保存先はまだ準備されていません。'); return; }
    if (!data?.storage_path) { setStatus('プロフィール写真は未登録です。'); return; }
    const signed = await client.storage.from(BUCKET).createSignedUrl(data.storage_path, 60 * 10);
    if (!active) return;
    if (signed.error) { setStatus('登録写真を読み込めませんでした。'); return; }
    signedUrl = signed.data.signedUrl;
    if (!blob) setImage(signedUrl);
    setStatus('登録済みのプロフィール写真を表示中です。');
  }
  async function selectFile() {
    if (!allowed || !active) return;
    blob = null;
    save.disabled = true;
    clearPreview();
    const file = input.files?.[0];
    if (!file) return;
    setStatus('画像を圧縮しています…');
    try {
      const compressed = await compress(file);
      if (!active) return;
      blob = compressed;
      previewUrl = URL.createObjectURL(blob);
      setImage(previewUrl);
      info.textContent = 'WebP / ' + Math.round(blob.size / 1024 * 10) / 10 + 'KB（最大50KB）';
      save.disabled = !writeEnabled || !allowed;
      setStatus(writeEnabled ? 'プレビューを確認して保存してください。' : '圧縮プレビュー完了。保存機能は隔離試験中のため無効です。');
    } catch (err) {
      if (active) { info.textContent = ''; setStatus(err.message || '画像を処理できませんでした。'); }
    }
  }
  async function upload() {
    if (!writeEnabled || !allowed || !blob || working) return;
    working = true;
    save.disabled = true;
    setStatus('保存しています…');
    let path = null;
    try {
      const {data: auth, error: authError} = await client.auth.getUser();
      if (authError || !auth.user || auth.user.id !== session.user.id)
        throw Error('ログイン情報が確認できません。再ログインしてください。');
      const uid = auth.user.id;
      // Avoid overwriting the currently registered image until the DB reference changes.
      path = uid + '/' + crypto.randomUUID() + '.webp';
      const old = await client.from(TABLE).select('storage_path').eq('user_id', uid).maybeSingle();
      if (old.error) throw Error('保存先DBを確認できません。');
      const uploaded = await client.storage.from(BUCKET).upload(path, blob, {
        cacheControl: '3600', contentType: 'image/webp', upsert: false
      });
      if (uploaded.error) throw Error('写真を保存できませんでした。');
      const oldPath = old.data?.storage_path || null;
      // Optimistic compare-and-swap: never overwrite a concurrent change.
      const updated = oldPath
        ? await client.from(TABLE).update({
            storage_path: path, updated_at: new Date().toISOString()
          }).eq('user_id', uid).eq('storage_path', oldPath).select('storage_path').maybeSingle()
        : await client.from(TABLE).insert({
            user_id: uid, storage_path: path, updated_at: new Date().toISOString()
          }).select('storage_path').maybeSingle();
      if (updated.error || updated.data?.storage_path !== path)
        throw Error('写真が別の画面で変更された可能性があります。再読み込みしてください。');
      path = null; // The DB now owns this reference. Never clean up the current image.
      if (oldPath && oldPath.startsWith(uid + '/')) {
        await client.storage.from(BUCKET).remove([oldPath]);
      }
      blob = null;
      clearPreview();
      input.value = '';
      setStatus('プロフィール写真を保存しました。');
      await showStored();
    } catch (err) {
      setStatus(err.message || '写真を保存できませんでした。');
    } finally {
      if (path) await client.storage.from(BUCKET).remove([path]).catch(() => {});
      working = false;
      if (active) save.disabled = !blob || !writeEnabled || !allowed;
    }
  }
  async function removeCurrentPhoto() {
    if (!writeEnabled || !allowed || working) return;
    working = true;
    removeButton.disabled = true;
    save.disabled = true;
    try {
      const {data: auth, error: authError} = await client.auth.getUser();
      if (authError || auth.user?.id !== session.user.id) throw Error('ログイン情報が確認できません。');
      const uid = auth.user.id;
      const old = await client.from(TABLE).select('storage_path').eq('user_id', uid).maybeSingle();
      if (old.error) throw Error('写真を確認できませんでした。');
      if (!old.data?.storage_path) { setStatus('登録済みの写真はありません。'); return; }
      const path = old.data.storage_path;
      // Deleting the DB record first stops new viewers from seeing the photo.
      // A conditional DELETE prevents stale clients from deleting a replacement.
      const removed = await client.from(TABLE).delete().eq('user_id', uid).eq('storage_path', path)
        .select('storage_path').maybeSingle();
      if (removed.error || removed.data?.storage_path !== path)
        throw Error('写真が変更されました。画面を読み直してください。');
      const fileRemoval = await client.storage.from(BUCKET).remove([path]);
      clearPreview();
      blob = null;
      input.value = '';
      info.textContent = '';
      setImage('');
      setStatus(fileRemoval.error
        ? '写真の登録は解除しました。古い画像の削除は後で再試行してください。'
        : 'プロフィール写真を削除しました。');
    } catch(err) { setStatus(err.message || '削除できませんでした。'); }
    finally {
      working = false;
      removeButton.disabled = !writeEnabled || !allowed;
      save.disabled = !blob || !writeEnabled || !allowed;
    }
  }
  input.disabled = !allowed;
  input.addEventListener('change', selectFile);
  save.addEventListener('click', upload);
  removeButton.disabled = !allowed || !writeEnabled;
  removeButton.addEventListener('click', removeCurrentPhoto);
  if (!allowed) setStatus('プロフィール写真の登録は承認済みCAのみ利用できます。');
  else if (!writeEnabled) setStatus('画像の選択・圧縮プレビューができます。保存はまだ有効化していません。');
  else showStored();
  return () => { active = false; clearPreview(); input.removeEventListener('change', selectFile); save.removeEventListener('click', upload); removeButton.removeEventListener('click', removeCurrentPhoto); };
}
