# CA Clover｜隔離HTTP検証の実施結果（2026-10-10）

## 検証判定
**GitHub Actionsの使い捨てPostgreSQL＋PostgRESTでのHTTP通信：PASS。**
**本番Supabase Edge→PostgRESTフルE2E：未実施。Production Release STOP。**

対象: Draft PR #128。Supabaseの本番DB、Edge Functions、CAマスター同期、
公開pagesのいずれも更新していない。Supabaseの別プロジェクト・開発ブランチは
作成していない（現時点の開発ブランチは0件）。

## 使い捨て隔離環境
- GitHub Actions / `ubuntu-latest`
- PostgreSQL 16 サービス（認証文字列はテスト専用の固定ダミー）
- `postgrest/postgrest:v12.2.8` コンテナ、hostローカル3000番ポート
- 例示用の偽CA・Community・Identity・メダルをDBに挿入
- 正式Supabase接続情報、実ユーザーID、JWT、メールアドレスを**使用しない**

関連ファイル:
- `.github/workflows/ca-master-postgrest-http-qa.yml`
- `scripts/ci/ca-master-http-fixture.sql`
- `scripts/ci/test-ca-master-http.mjs`

確認した実際のHTTPシナリオ:
1. `PATCH /ca_members` が正常終了し、独立したDBトランザクションとして確定。
2. 次の `PATCH /communities` が NOT NULL 制約で HTTP 400 / SQLSTATE 23502。
3. 1番の変更だけが残り、2番の失敗は取り消される。
4. **別の実行者ID**によるCAマスター停止要求は対象0行で拒否。
5. **実行中の所有者ID**による専用CAマスター停止要求は1行更新で成功。
6. 一般Cron `enabled` は `true`、既存Identity・メダルは更新前後で完全一致。
7. 接続不可能なURLへの試行で通信失敗を検出し、HTTP成功と混同しない。

**結果:** GitHub Actions `CA master / Isolated PostgREST HTTP QA` run
**#38055914031 PASS**。従来のPostgreSQL QA run **#38055914064 PASS**、
通常CI run **#38055914061 PASS**。

### 解釈と限界
HTTP境界をまたぐ部分コミットと所有者付き停止が実際のPostgRESTで再現できた。
ただし、**この試験では本番のEdge Functionハンドラ自体は動作させていない**。
PostgREST側のテスト用権限は実Supabaseのservice_role/RLSと同一ではない。
使い捨てDBは必要最小限の合成スキーマであり、本番の全関数・Storage・Auth・
Vault・Cron・Campfireを再現するものではない。これで本番実行が安全と断定しない。

## バックアップ準備の現状
Supabaseの本番read-only確認:
- `auth.users`: **6行**
- `profiles`: **6行**
- `user_ca_identities`: **6行**
- `stamp_collections`: **13行**
- `stamp_collection_designs`: **13行**
- `community_icon_versions`: **150行**
- `storage.objects`: **418行**（ファイル本体ではない）
- `sync_automation_state.last_ca_master_at`: **2099-01-01**（緊急停止維持）
- 通常Cron `enabled=true`。

**未完了:** DB・Auth・Storage実体の復元可能な独立バックアップを取得していない。
実際の復元・差分検証も実施していない。Supabaseの料金プランは未確認。
新しいSupabase project / development branch作成は費用確認と明示承認が必要。

## 残りの本番GO条件
1. 非公開で暗号化された**復元可能な**バックアップ一式、Storage実体とAuthを含む復元テスト。
2. 本番同等DDL・RLS・RPC・Edge Functionによる隔離フルE2Eと障害注入。
3. 依存PR #119 / #120 / #121 / #127 / #128 の適用順・差分・切り戻しレビュー。
4. CAマスターの同期停止を残したままステージングへ保護DDL/RPC/Edgeを適用し、権限拒否と既存Identityを照合。
5. 会長による本番適用への**明示承認**。初回限定同期と自動同期解除は別々に承認する。

**判定：合成HTTP QA PASS、本番GOはSTOP。**
