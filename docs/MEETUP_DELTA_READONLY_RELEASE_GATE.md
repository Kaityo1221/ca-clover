# My Community Meetup差分同期の公開ゲート（Draft PR #198）

2026-11-02 JST。**本番NO-GO。mainへのマージ、公開環境へのデプロイは禁止。**

## 現在の実装
- 従来のMeetup読込データは、同一ブラウザセッション内の前回取得データと比較する。これはCampfire APIの更新検知とは別物。
- `src/lib/meetup-delta-api-contract.ts` と `src/lib/meetup-delta-request.ts` は、サーバー承認済みの応答だけを型・Community ID・件数で検証し、1 Communityでも失敗すれば合計を表示しない。
- `src/components/authorized-meetup-delta-panel.tsx` は、現在のログインをSupabaseで再確認し、読み取り専用Edge Function `ca-meetup-delta-readonly` を呼ぶ準備がある。
- **未デプロイ・未存在のEdge APIを勝手に呼ばないため、公開スイッチは初期OFF。** `NEXT_PUBLIC_CA_MEETUP_DELTA_READONLY === "enabled"` の時だけMy CommunityにAPIパネルを出す。

## API契約（backend Draft PR #26と一致）
```json
{"ok":true,"communityId":"<requested Community UUID>","added":1,"updated":0,"unchanged":12}
```
- エラー時はHTTP 401、403、503等。**「0件」「更新なし」と誤表示しない**。
- 送信: Supabase Edge Functions のPOST、bodyは `{communityId}` のみ。
- SupabaseブラウザSDKが付けるユーザーJWTをサーバーで実GoTrue検証する。ブラウザから渡されたCommunity一覧・ロールを認証情報として信用しない。
- サーバーは `profiles.role`、`user_ca_identities.verified_at`、有効な1st/2nd `ca_members`、`community_ca_members` を照合する。
- サーバーは対象Communityに紐づくCampfire公式IDを自分で取得する。サービスロールとCampfireトークンは**サーバー外に公開しない**。
- メダルや本人識別情報を変更するDB/Edge APIは呼ばない。

## 公開前の必須ゲート
1. Backend側に `ca-meetup-delta-readonly` Edge本体を実装し、実Auth・実スキーマ・CORS・レート制限を隔離で検証。
2. 実Campfire取得を、安全に認可された方法で検証。API制限・ページ欠落・異常応答を確認。
3. Backend #25（認証）、#26（差分）、#27（メダル保護）を組み合わせた統合審査。既存PRと本番設定への副作用を禁止。
4. フロントCI・公開境界CI・Safariの画面確認、未承認ユーザーや途中失敗で件数が出ないことを確認。
5. 承認の上で初めてゲート変更とデプロイ。独断で有効化しない。

## 注意
本PRのコード・表示部品が完成していても、バックエンド本体と実Campfireに接続されていない限り、Meetup自動更新は**未完成**。
