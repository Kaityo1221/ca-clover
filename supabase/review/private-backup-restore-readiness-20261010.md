# CA Clover｜本番切替前のバックアップ・復元確認（未実施）
**2026-10-10 / PR #128 / 本番更新は STOP**

この文書はレビュー専用。バックアップファイルの作成・本番復元・本番DB書込はまだ実行していない。
本番のアカウント情報、Identity、メダル履歴を含むバックアップを、公開GitHubやGitHub Actions artifactsへ置かない。

## 1. バックアップとデータ照合は別物
`supabase/review/release-private-data-fingerprints.READONLY.sql` による5テーブルの件数と
フィンガープリントは、更新前後の違いを検知するためだけのもの。**復元はできない。**
今回本番で読み取り専用確認ができたのは、accounts 6、memberships 6、identities 6、
medals 13、designs 13、orphan 0。CAマスターは2099年仮停止を維持。
追加のバックアップ対象調査（read-only、2026-10-10）：`auth.users` **6行**、
`storage.objects` **418行**、`community_icon_versions` **150行**。
**Storageの418行は画像本体ではなくメタデータ件数**。実オブジェクトとAuthの復元方法を別途検証する。

## 2. 本番バックアップの範囲
最小でも以下を含む**復元可能な**DBスナップショット：
- `profiles`, `community_memberships`, `user_ca_identities`
- `stamp_collections`, `stamp_collection_designs`
- `ca_members`, `community_ca_members`, `communities`,
  `community_campfire_ids`, `community_icon_versions`
- `community_access_requests`, `sync_automation_state`, `sync_runs`
- 関連する **外部キー / UNIQUE / CHECK / RLS / 関数 / トリガー / シーケンス / 権限**
- Supabase Auth の本人アカウント（`auth.users`等）との対応関係・復元方法
- Storageにアイコンや保存物がある場合は**オブジェクト実体**（DB metadataだけでは復元不可）
- 本番Edge Functionsのソースとバージョン、Cron構成と有効状態

権限と機密性を確認した非公開の暗号化領域を保存先とし、元データをpublic GitHub、
PRコメント、CIログ、ChatGPTへの貼り付けに使わない。

## 3. 可能な取得手段と限界
**Supabase公式ドキュメント:**
- [Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase CLI `db dump`](https://supabase.com/docs/reference/cli/supabase-db-dump)
- [Restore Platform Project to Self-Hosted](https://supabase.com/docs/guides/self-hosting/restore-from-platform)

契約プランによりダッシュボードのバックアップ機能は異なる。**プランは未確認**。
公式ドキュメントによれば、Free利用者にはCLI `supabase db dump` で
独立バックアップを取得・保管する方法が推奨される。

担当者の**非公開・安全な作業端末**で、秘密を環境変数や適切な認証管理に保持し、
Supabase CLIとDockerが利用可能な場合の公式例（**現時点では実行しない**）：

```sh
# SUPABASE_DB_URL は個別に非公開の方法で設定し、履歴・ログに出さない。
# 秘密をコード・CI・チャットに貼らない。
supabase db dump --db-url "$SUPABASE_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" -f schema.sql
supabase db dump --db-url "$SUPABASE_DB_URL" -f data.sql --use-copy --data-only
```

**重要:** Supabase CLIの通常dumpは `auth`, `storage` 等のSupabase管理スキーマを
除外するため、上記3ファイルだけで本番のログインアカウントやStorage実体まで
完全復元できるとはみなさない。Auth/Storageは別途復元手順が必要。
セキュリティを維持したままDBスキーマ・アプリデータ・アカウント・保存ファイルを
整合して復元できるか、管理者が検証するまで**GOは禁止**。

## 4. リハーサル・受入条件
- [ ] Supabase開発ブランチは現時点で0件。新規の開発ブランチや有料構成は未作成で、費用確認とユーザー承認なしに作成しない
- [ ] 利用プラン・復元手段を確認し、バックアップの費用が発生する操作は実行前に確認
- [ ] 本番CAマスター専用停止を維持したまま、正式な読み取り可能バックアップを取得
- [ ] 生成物の暗号化保管、アクセス制限、保存期限、秘匿性を確認
- [ ] **本番以外**の隔離環境へ復元し、個別のユーザーID・Identity・メダル・デザインの整合性を確認
- [ ] Auth/Storage/Edge/Cronも復元できるか確認（public DBのテーブル数だけでは不十分）
- [ ] 同期前後の非公開フィンガープリント・個別ID差分を突合
- [ ] 復旧責任者・復旧開始/中止の条件を文書化
- [ ] 自動CAマスター復帰は初回限定同期の個別PASSまで別途禁止
- [ ] 会長の本番切替への明示承認

## 5. 本番適用状況
- PR #128および依存PRはDraft、未マージ
- 本番 `sync-ca-master` v4とIdentity複合FK `ON DELETE CASCADE` は未変更
- CAマスター2099年緊急停止維持、通常Campfire Cronは稼働
- **バックアップ未確保、復元テスト未実施。本番適用STOP。**

## 6. 公開GitHubへの流出を防ぐ補助策
`.gitignore` に `/private-backups/`, `/backups/`,
`/roles.sql`, `/schema.sql`, `/data.sql`,
`*.dump`, `*.backup`, `*.pgdump` を追加。
これは誤追加を減らすだけで、暗号化・アクセス制御や `git add -f` からの保護ではない。
実バックアップを **publicリポジトリ配下へ作成しない**方針は変えない。
