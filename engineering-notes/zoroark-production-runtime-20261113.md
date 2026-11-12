# ゾロアーク工程③〜⑧：公開前の専用ランタイム

本番公開は **NO-GO**。本変更はFrontend #270（工程① #256をbase）、Backend #63（工程① #62をbase）の隔離系列に限定。main/pagesへのマージ、Production設定変更、Productionフラグ有効化は実施しない。

## 接続・権限

- 新規専用Neon project `silent-sea-07101633`、DB `zoroark_prod`。
- Production: `br-young-cloud-beynzbbm` / main。Preview QA: `br-young-hat-bejq7jhc` / `zoroark-release-qa-20261113`。
- スキーマ名 `zoroark_isolated` は工程①の関数契約との互換のため維持。専用DB内にのみ新設。
- GM接続: `ZOROARK_NEON_GM_DATABASE_URL` / `zoroark_runtime_gm`。
- ゲスト接続: `ZOROARK_NEON_GUEST_DATABASE_URL` / `zoroark_runtime_guest`。
- 両ロールはテーブルへの直接アクセス不可、DDL/管理/RLS迂回権限なし。必要な関数だけEXECUTE可。関数所有者は専用NOLOGIN/NOBYPASSRLSロール、固定search_pathと明示RLSポリシーを使用。
- 環境・Gitブランチ・DB endpoint・DB名・接続ロールを照合し、DB内target/versionも確認。汎用DATABASE_URL、旧ZOROARK_NEON_DATABASE_URLへのfallbackなし。
- Previewは工程②専用Gitブランチのみ。Productionはmainかつ `ZOROARK_PRODUCTION_ENABLED=true` が別途必要。現時点では設定しない。
- 既存開発project `ca-clover-test`、Supabase DB/Edge/Cronは変更しない。Supabaseは既存公開キーでgetUserと本人profiles.roleを読み取り検証するだけ。

## 安全境界

Origin/Sec-Fetch-Site、JSON、ゲスト/GM独自ヘッダー、ストリーム実測2048byte上限。秘密をJSON/URL/localStorage/ログへ出さない（GMへの新規招待レスポンスは仕様上必要）。QRは端末内生成、招待はfragment読取後に履歴から削除。

`__Host-zg_device` を招待inspectで発行し、join/meで要求。参加Cookie `__Host-zg_guest` と両方を照合。両CookieはHttpOnly/Secure/SameSite=Strict/Path=/。DBは秘密のSHA-256のみ保存し、端末識別ハッシュはルーム別に再ハッシュ。ルーム内端末/名前一意制約と行ロックで同時申請も制御。終了/失効/拒否済みセッションは遮断。旧4引数join/1引数meはゲストロールから実行不可。

同じ実在人物が別ブラウザーを使用することや他人の名前を入力することは防げないため、GMの現地確認と承認が必要。ブラウザーのゲストCookieは1組のため、同じブラウザーで別ルームに参加すると直近の参加へ切り替わる。

全体1200要求/分のDBレート制限を維持。IP/指紋保存なし。参加記録は最大4×定員/ルームに制限。セッション期限は最長6時間、招待15分。期限切れデータの自動削除Cronは追加していない。公開前に保存期間・管理者による削除運用を決める。

## 検証

- `node --test scripts/ci/test-zoroark-runtime.mjs`：実ハンドラーに合成Auth/SQLを注入し、フラグOFF・接続取り違え・認可・CSRF・本文上限・Cookie・IDOR等を試験。
- `node scripts/ci/test-zoroark-neon-qa.mjs`：明示した専用QA資格情報のみ。実Neonロールと実SQLでAPI統合・12並列定員・8並列同名/同端末・Cookie結合・GM所有者・招待更新・拒否を試験。Authは合成であり実CA試験ではない。作成した合成ルームだけfinallyで削除。
- `node scripts/ci/test-zoroark-production-readonly.mjs`：ProductionへのSELECTのみ。実ログイン・識別・管理権限なし・直接テーブル拒否を確認。公開フラグを変更しない。
- Backendの新規No Deploy CIはPostgres 17へ同じv3→v4 SQLを適用し、ACL/RLS/認可/失効を試験。クラウド資格情報は不要。
- Windowsローカルの標準Turbopackは子プロセスエラー。webpackでのビルドも別途確認し、標準ビルドはGitHub CIの結果を最終根拠にする。

## 手動Previewと実機試験

Vercel connectorはteam `kaityo1222` に対象projectを列挙できない。別project作成や保護解除で迂回しない。

1. Vercel `kaityo1222/ca-clover` → Settings → Environment Variables。**PreviewかつGit branch `feature/zoroark-guest-invite-chat-isolated-20261113` 限定**で新GM/Guest接続を別々のSecretとして登録。旧汎用接続は今回のコードでは使わない。
2. 同じ限定範囲で `ZOROARK_ROOM_CREATE_ENABLED=true` と `ZOROARK_GUEST_LOBBY_ENABLED=true`。Productionには追加・変更しない。`ZOROARK_PRODUCTION_ENABLED` は未設定/OFFのまま。
3. PR最新コミットをPreviewとして再デプロイし、Ready/commit一致、target=Preview、Production branch=main、domain=`ca-clover.vercel.app`のままであることを照合。
4. PCの実CAで `/zoroark/rooms` → 作成 → 新QRを別端末iPhone Safariで読取 → nickname → 承認待ち → GM承認 → 本人ページを更新。同じルームの他端末情報・秘密が表示されないことを確認。
5. 再読込、Cookie削除、拒否、受付ロック、旧QR失効、期限切れ、異なるGM、Safariカメラからの遷移を確認。DevToolsのCookieは属性だけ記録し、生値・QRを共有しない。

実機Safari・実CA QR別端末E2Eが未完了なら最終検証はBLOCKED。最終PASSとユーザー追加GOが揃うまでProduction公開不可。

## 統合時の注意

2026-11-13取得時Frontend main `985d2eb` は8ファイルで競合（ci.yml/public-boundary-ci.yml/AGENTS.md/PRIVATE_BACKEND_SPLIT.md/README.md/package.json/verify-public-boundary.mjs/login/page.tsx）。pages `aeed06e` とBackend main `3349c02` は競合なし。現在のPR baseは変更しない。pagesは静的/docs公開系であり、Next APIの本番導入先はVercel main。main統合は専用候補で再レビューしてから行い、pagesへの安易なマージを本番API公開手順と扱わない。
