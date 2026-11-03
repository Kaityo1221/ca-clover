# STEP 1: Discord申請とCA Clover Google本人紐付け（2026-11-03）

## 実装状況
- `/new-ca/link`: pendingアカウント専用のGoogle本人照合ページ。Google一致申請が1件で未占有のときだけ連携可能。
- `/api/new-ca/bridge`: サーバー側でSupabase Auth getUser、最新profiles.role、Google identity provider_id、既存user_ca_identitiesを検証。
- 隔離NeonのGoogle accountIdとSupabase Google provider subjectを完全一致させる。
- 同じ申請の別人による占有を拒否し、一意制約で同じClover userの複数リンクも拒否。
- 画面で「連携済み」は申請が**現在のClover user**に結びついているときだけ表示。他人のリンクを成功扱いにしない。
- 同一pendingユーザーの連携再送は既存リンクを変更せず `alreadyLinked` を返す。
- 書込先は隔離Neonの `ca_onboarding_lab.clover_identity_links` だけ。本番DBのprofiles/identity/Community/権限は更新しない。
- プレビュー専用フラグ、DB名、分岐名とmarkerにより公開環境ではfail-closed。
 
## 確認済み
- 実Neon PostgreSQL: 初回紐付け1件、同じ申請を別ユーザーへ追加できない、SAVEPOINTロールバック後リンク0件。
- 模擬HTTP: OFF、無効JWT、ADMIN read、pending本人read、別Google、既存CA拒否、Origin拒否、既存ユーザーidentity拒否、初回pending書込、同一ユーザー再実行、本人所有確認すべてPASS。
- Vercel previewデプロイREADY。

## 実アカウントE2Eは未実施
本番Supabase Authを使用した**新規pendingテストユーザーのサインイン・本人紐付けPOST**は未検証。既存ADMIN・CAアカウントをpendingへ切り替えない。実ユーザーで試す際も既存アカウント変更禁止。隔離Neonの合成申請と同じGoogleアカウントを持つ専用pendingテストアカウントが必要。

**判定: STEP1機能コードと隔離DB/模擬テストPASS、実pending E2E BLOCKED。本番承認・CA権限付与はNO-GO。**
