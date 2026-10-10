# CA Clover｜翌朝PCバックアップ実行シート
2026-10-11 用 / **準備のみ** / 本番更新禁止

## 朝、PCで行うこと（会長が確認してから開始）
1. GitHubに **Privateリポジトリ `ca-clover-backup`** を用意するか、暗号化されたPC内保存先を決める。公開リポジトリ `ca-clover` には絶対に置かない。
2. Supabaseプロジェクトの接続方法と現在のバックアップ利用可能なプランを確認する。DB接続パスワード、API service_roleキー、暗号化パスワードをGitHub・会話・ログ・スクリプトへ貼らない。
3. **本番同期は解除しない**：`sync_automation_state.id=1.last_ca_master_at=2099-01-01` を維持。旧 `sync-ca-master` は危険なため手動実行しない。
4. Supabase公式の安全な手段で **roles / schema / application data** を非公開で保存する。公式CLI例： [Database dump](https://supabase.com/docs/reference/cli/supabase-db-dump)。通常のCLI dumpだけではAuth管理スキーマやStorageオブジェクト実体が含まれない点に注意。
5. **Auth 6名のログイン復元可能性** と **Storage 418件の実オブジェクト** をそれぞれ確認。DBの `storage.objects` 418行は画像本体ではない。Authのパスワード・セッション・トークンに触れる作業は本番への副作用と機微性を慎重に検討。
6. 保存物は暗号化し、公開されない保管先に置く。**GitHubの通常Git管理は100MB超の単一ファイルを受け付けない**。暗号化した各ファイルの実容量を測ってから保管方法を選ぶ（必要ならLFSやRelease asset等の制約・容量を別途確認）。
7. バックアップしたファイルを別の隔離環境へ復元し、ユーザー対応、Identity、メダル13枚、デザイン13件、Storage実体を照合。**復元成功まではバックアップ完了判定しない**。
8. バックアップ復元PASSを確認した後も、PR #128やDB/Edgeの本番適用、初回CAマスター同期、2099年停止解除は**別途明示承認**が必要。

## 事前確認済みの目安（2026-10-10 read-only）
- PostgreSQL全体: 約102MB（稼働DBサイズ、dumpファイル容量ではない）
- Storage実体のメタデータ合計: 約84.6MB / 418件
- データ量合計の目安: 約187MB。暗号化・エクスポート後の実容量は別。
- Auth users 6、profiles 6、Identity 6、獲得メダル13、デザイン履歴13、孤立Identity 0。
- 目標PC空き容量: 少なくとも1GB、世代管理なら数GB確保。
- Supabase開発ブランチは0件。新規作成や有料機能への変更は承認なしに行わない。

## 今夜終えられる作業と朝まで残る作業
- 済：CAマスター安全停止・異常系・同時実行・権限・メダル発行・デザイン復元の合成DB QA。
- 済：PostgREST実HTTP境界の独立コミット→障害→専用ゲート停止リハーサル。
- 済：community-claimの実稼働v14とのGraphQLクエリ互換性とCI/ビルド。
- 未済：**実本番データを使うバックアップと隔離復元、Supabase Edge全体の本番相当E2E、リリースGO承認**。
- 予定：本書は作業手順であり、データ/秘密情報を含まない。本番へ操作はしていない。

参照：
- [統合リリースDraft PR #128](https://github.com/Kaityo1221/ca-clover/pull/128)
- `supabase/review/private-backup-restore-readiness-20261010.md`
- `supabase/review/release-isolated-postgrest-http-qa-20261010.md`

**GO判定：現時点でSTOP。翌朝もバックアップを確認するまでSTOP。**
