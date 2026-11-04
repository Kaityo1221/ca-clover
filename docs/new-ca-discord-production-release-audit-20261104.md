# CA Clover 🍀 Discord連携版 本番公開審査

日付：2026-11-04（JST）
依頼：Google＋Campfireだけの新版ではなく、従来開発してきた**Discord OAuthを先に使う新規CA登録版**を正式公開する。
現状：**UI/隔離Neonプレビューは存在。本番登録・承認・権限付与はNO-GO。**

## 依頼切り替え時の措置

- Pages向け Google＋Campfire UI PR #211 は未マージのまま closed（2026-11-04）。これを代替として公開しない。
- 既存の本番 Pages、CA認証、Community、メダル、Meetup、承認済みユーザーは変更しない。
- 00Kanonpapa39の重複2アカウントは保護、削除・統合・メールアドレスによる自動上書きは禁止。
- 既存の本番登録方法は、Discord版が独立E2E・ロールバック・承認監査を通過するまでは継続する。

## 正式に公開したい登録フロー

1. 新規CAがDiscord OAuthで現在のAPAC CAロールをサーバー検証（表示名でなくDiscord User ID）。
2. トレーナー名・Community/Campfire URLを入力し、CA原本・現行Campfire情報をサーバーで照合（現状の隔離実装では架空マスター限定）。
3. 同じGoogle OAuth provider subjectでログインし、CA Clover側の**本人のGoogleアカウント**と紐付け（メールアドレスだけでは照合しない）。
4. 管理者がDiscord ID、現在のロール、CA原本、Community、既存の認証・割当履歴を確認。
5. 管理者が最終承認すると、1回限りの原子RPCで profiles.role、user_ca_identities、community_memberships、審査監査を**必要な分だけ**更新する。既存CAの権限・メダル・履歴は変更しない。
6. 再ログイン後にCA権限で利用できることを本人と管理者が確認。失敗時は不整合・二重付与がないことを確認する。

## 今回の実コードから確認できた停止条件

| 項目 | 現状 | 本番GOの条件 |
| --- | --- | --- |
| Discord→Google OAuthの申請画面 | `ca-clover-discord-oauth-lab/onboarding-preview.html` に存在 | 本番用の実申請フォームへ置換。架空値・`is_synthetic` 制約を外す前に正本検証を実装 |
| Discordロールの現在検証 | 隔離テスト経路が存在 | 管理者承認時にもBotによる現在ロールと紐付け済みDiscord IDを再検証 |
| Google本人照合 | Vercelプレビュー `/new-ca/link`、`/api/new-ca/bridge` | Google OAuth redirect allowlistと新規pending実アカウントのE2E PASS |
| Neon隔離マスター | `master_snapshot.is_synthetic=true` | 公式CA正本とCommunityデータの実読み取り・差分・失効の監査 |
| サーバー認証・権限 | プレビュー専用 `isIsolatedBridgeReady()` | 本番向けに別の明示的安全ゲート、原子RPC、監査、RLSを構築して検証 |
| 最終承認 | `/api/new-ca/approve` は隔離DBのみ | 本番用書込RPCが実Supabase Auth + RLSテスト合格後に公開 |
| 公開設定 | Vercel `ca-clover` はNEW_CAブリッジ関連変数をプレビュー分岐に限定 | 本番変数・リダイレクトは審査済み経路にのみ設定 |
| 総合回帰 | 合成試験中心 | 現行CA/ADMINログイン・初回pending・二重登録・拒否・復元・メダル/Meetup等を隔離E2E PASS |

## 本番反映してはいけないもの

- `src/lib/new-ca-bridge-policy.ts` の `isIsolatedBridgeReady()` を環境フラグだけでproduction許可する変更。
- `ca-clover-discord-oauth-lab` の `onboarding-preview.html` を「本番CA登録」と誤表示すること。
- 既存本番の `profiles.role`、`community_memberships`、`user_ca_identities` をクライアントから直接書き換えること。
- 本人のGoogle provider subject、Discord ID、EXPLORE IDの衝突や失効を、メールの一致だけで通すこと。
- 新規CA承認と無関係な削除機能 Draft PR #35 / #210 を一緒に本番反映すること。

## 工程とSTOP判定

- **P0 現状確認・誤ったPR停止：完了**。PR #211 closed、Pages本番HEAD不変。
- **P1 実申請用データ契約・正本検証・隔離マスター：未完了**。
- **P2 実pending Google + Discord OAuth + Campfire の隔離結合試験：BLOCKED**（実アカウントのE2E未実施）。
- **P3 本番一回限りの承認RPC・RLS・監査・並走失効試験：未完成**。
- **P4 CI/実機/iPhone/ロールバックと本番GO審査：未実施**。

本番GOは P1〜P4全PASS後に限る。工程が未完了でも既存の運用は維持する。
