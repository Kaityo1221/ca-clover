# 🍀 工程② Google本人照合・Clover紐付け — 2026-11-03

## 実装
- Supabase GoTrueからBearerトークンをサーバー側 `auth.getUser(token)` で確認
- `profiles.role` が `pending` の新規アカウントだけ紐付け可能。既存 `admin` / `ca` は拒否
- Googleプロバイダー本人識別子は `identities[].provider_id` に限定。Supabase内部の `identities[].id` をGoogle IDとして流用しない
- `identity_data.sub` がある場合は `provider_id` との一致も確認
- Neon Auth Googleプロバイダーの `neon_auth.account."accountId"` と等しい申請だけ照合
- `user_ca_identities` 既存リンクの読取で既存CAを保護
- `ca_onboarding_lab.clover_identity_links` のみへユニークな申請↔Supabaseユーザー紐付けを記録し、二重紐付けを禁止
- previewブランチ・preview環境・isolated DBホスト/名・DB環境marker・同一Origin・Bearer必須
- 本番 Supabase への書込は実装されていない

## 自動契約試験
`scripts/test-new-ca-bridge-http-mock.cjs`
1. disabled 503
2. invalid token 401
3. admin GET 200
4. pending GET自身のみ 200
5. 別Google本人にはカード0件
6. 別Google本人による紐付け 409
7. 既存CAによる紐付け 403
8. Cross-Origin 403
9. 既存CA IDリンクがあるpending 409
10. 正しいpendingの隔離紐付け 200
11. 再実行・二重紐付け 409

11/11合格（mock）。隔離DBでのリンク一意制約、挿入→再実行拒否→ロールバックは前工程で実施済み。

## 実機の認証統合で未検証の部分
現行CA Clover Vercel preview のGoogleログインが、Supabase Auth の認証リダイレクト設定により本番GitHub Pagesへ移る。会長iPhoneで観測済み。ログイン連携を未修正のため、**Vercel previewにおける実Supabase pendingユーザーのブラウザ本人照合とPOSTは未実施**。既存のADMINをpendingへ変更する試験は禁止。

本番SupabaseのURL allowlistを無断変更しない。安全なプレビュー専用Auth環境または承認済みのAuthリダイレクト登録が必要。

**工程②判定：コード実装・模擬試験PASS、実機Google↔Clover連携BLOCKED。工程②全体の完了は未認定。本番NO-GO。**
