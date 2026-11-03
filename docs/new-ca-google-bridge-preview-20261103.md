# 🍀 Discord → CA Clover Google本人照合ブリッジ（隔離プレビュー）

作成：2026-11-03（JST）
判定：**本番NO-GO**。本番CA権限の発行コードは追加していません。

## 接続の仕組み

- 公式Discord OAuth APAC CAロール確認済みの申請をNeon分離ブランチ `br-round-firefly-b4i7hsso` の `ca_onboarding_lab.requests` に保管。
- Neon Auth Googleの `neon_auth.account.accountId` と、CA Clover Supabase Authのサーバー検証済み `auth.identities.provider_id`（GoTrue JSON互換 `id`）を比較する。同じGoogle OAuth provider subjectである場合のみ一致とみなす。**Neon user UUIDとSupabase user UUIDは同一視しない**。
- `GET /api/new-ca/bridge` はCA Clover Supabase `getUser(accessToken)`で現在のユーザーをサーバー確認し、`profiles.role`をDBで再確認する。ADMINは隔離申請一覧を閲覧可。一般ユーザーはGoogle provider subjectが一致する自分の隔離申請のみ閲覧可。
- `POST /api/new-ca/bridge` は `pending` + 本人一致 + 既存 `user_ca_identities` 0件 + 同一オリジン + DB識別印 + 隔離申請所有権を確認して **Neonのみ** `ca_onboarding_lab.clover_identity_links` へ一意INSERT。既存CA/ADMINに対する連携書込は拒否。
- `/admin/new-ca`：ADMIN限定、実験申請を1枚ずつのフリップカードで表示。隔離承認済みも表示するが、実CA権限付与ボタンは無効。
- `/new-ca/link`：新規pendingユーザーが本人のGoogle申請を照合。実CA Cloverへの権限付与なし。

## 起動できる環境

Vercelの `ca-clover` プロジェクトの preview branch `feature/new-ca-approval-admin-preview-20261103` のみに以下を設定：
- `NEW_CA_BRIDGE_ENABLED=true`（preview/branch限定）
- `NEW_CA_LAB_DATABASE_URL`（preview/branch限定・**secret**。値をGitHubに保存しない）

アプリ側でも `VERCEL_ENV=preview` とブランチ名一致、Neonホスト / `ca_clover_test` DB一致、隔離DBの専用 marker を要求。いずれか不一致なら503で停止。本番 `VERCEL_ENV=production` は絶対に起動しない。

Supabaseには**認証確認・既存リンクのSELECTのみ**。本番の `profiles` `user_ca_identities` `community_memberships` `medals` にINSERT/UPDATE/DELETEしない。Neon環境を取り違えた場合は書き込みを拒否。

## 動作確認

- 実Google認証：Neon Auth と CA Clover Supabase管理者Google identity のOAuth provider subjectが一致（IDは公表しない）。
- Vercel Next.js preview build READY。ターゲット `production` ではない。
- API合成HTTP：feature OFF 503、認証なし401、ADMIN一覧200、本人のみ閲覧200、既存CA書込み403、クロスオリジン403、既存紐付け409、pending新規連携200（labのみ）、二重連携409、全PASS。
- Neon実PostgreSQL：新設 `clover_identity_links` に合成レコード1回挿入成功、2回目0、ロールバック後0を確認。
- Google provider subject、branch isolationなど12/12の合成チェックPASS。

## 未完了：本番GO判定禁止

1. iPhone実機でプレビュー `/admin/new-ca` に隔離申請が表示されることを確認。
2. 新規pendingでGoogle本人照合を実機確認。既存ADMINをpendingに変更して試験しない。
3. 実CAマスター・実Campfireの現在データをサーバー再照合し、既存 `user_ca_identities` と一意制約・失効を隔離環境で検証。
4. 本番の一回限りの承認RPC（原子トランザクション）、管理者監査ログと巻戻し・競合試験。
5. 既存CA **全件** のログイン・メダル・Meetup・Community・スタンプを回帰検証し、会長の別途本番GO承認を取得。

**禁止：Draft PRの自動マージ、CA Clover本番DB/Edge/Cron/Pagesの変更。**
