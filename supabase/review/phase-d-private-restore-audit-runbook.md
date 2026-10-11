# 🍀 CA Clover Phase D / Windows復元環境の検査手順
**Draft PR #131。レビュー専用。本番Supabaseは操作しない。**

## 現在の検証範囲

2026年10月11日に管理者が非公開Windowsの `C:\CA-Clover-Restore-Test` 内で実施した
DB/Auth/Storage復元、418件SHA-256、484件バックアップ元のハッシュ検査、
98件の外部キー、3件のシーケンス修復・照合はPASS済み。
画像デコード3件、Google OAuth、Secrets、Edge実行、Cronの全機能は未確認。
**アプリ全体の完全復旧は未PASS。**

Phase Dの読み取り専用SQLは、復元されたDBでデータの参照整合性を確認する。
GitHub Actionsは架空のスキーマ・人物・メダルでSQLの構文と出力を検査する。
**復元された実バックアップデータをPublic GitHubやActionsへ送らない。**

## 管理者がWindowsに戻ったときの手順（現時点での実行依頼ではない）

1. Docker Desktopで「復元テスト用」のみが起動していることを確認する。
2. PowerShellで以下のコマンドを実行する。**固定されたコンテナ名は変更しない。**
3. 失敗した場合は中断し、本番コンテナ名や本番DB URLに置き換えない。

```powershell
cd C:\CA-Clover-Restore-Test
$Audit = Join-Path $PWD 'phase-d-restored-local-readonly.sql'
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/Kaityo1221/ca-clover/safety/ca-master-phase-d-isolated-qa-20261012/supabase/review/phase-d-restored-local-readonly.sql' -OutFile $Audit
Get-Content -Raw $Audit | docker exec -i supabase_db_CA-Clover-Restore-Test psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres
```

SQLは `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;`
として実行される。DBコンテナ内からUnixソケットで接続しない場合、
冒頭の安全検査がSQLエラーとなり停止する。
`-X` によって既存の個人用 `psqlrc` 設定も読み込まない。

### 期待する出力

| 区分 | 期待値 | 判断 |
| --- | --- | --- |
| Auth users / Google identities / profiles | 6 / 6 / 6 | バックアップ時点と一致ならPASS |
| Identity / medals / medal designs | 6 / 13 / 13 | 同上 |
| Storage metadata | 418 | メタデータのみ。実体のSHA-256は別の既存PASS記録 |
| Identityの参照切れ | 0 | 1以上ならSTOP |
| Primaryの重複 | 0 | 1以上ならSTOP |
| 資格のあるPrimary Identityの自拠点メダル欠落 | 0 | 1以上ならSTOPし原因を確認 |
| 未検証外部キー | 0 | 1以上ならSTOP |
| FK数 | 98 | 既存復元時の記録から変化ならREVIEW |
| 通常Campfire同期 | enabled | 0ならREVIEW |
| 緊急停止日時 | 2099年設定が有効 | 有効でなければSTOP |
| Identity保護FK | 現状CASCADEの可能性あり | 本番適用前にRESTRICTが別途必要。**現状がCASCADEでも復元の失敗ではない** |
| CAマスター専用ゲートと承認済み件数 | 未適用 / 未設定の可能性あり | 現段階では正常なSTOP状態。勝手に設定しない |

これらは読み取り検査であり、危険なCAマスター同期コードを実行しない。

## 情報公開・取扱い

- 出力は件数と判定のみ。UUID、メール、トークン、画像を表示しない。
- 実バックアップ、restoreログ、パスワード、Secret、個別ハッシュやIdentityの一覧は
  GitHub・CI・PRコメント・会話へ貼り付けない。
- 異常時は **STOP + 原状保持**。その場でFK/Identity/メダルの書換えを行わない。
- 旧 `sync-ca-master` v4を含む本番Edgeを動かすテストをしない。

## Phase Dの未完了部分

- 復元DBへのこの読み取り専用検査の実行：**2026-10-12 JSTにPASS（下記記録参照）**
- 現在の本番デプロイに対応するEdge/Cron/Secrets/RLS/Authの隔離E2E
- 失敗時の部分コミット、本人Identity、交換メダル履歴の実DB差分検証
- 同期前に人間が確認したCAマスターCSV基準件数の作成と監査方法
- 画像デコードが未解決の3ファイルの原因分類

**本番SQL・Cron・Edge・2099停止解除・PRマージは一切承認されていない。**


## Phase D 実データ検査結果（2026-10-12 JST / 管理者実行）

**環境:** Windows上の復元テスト用Docker PostgreSQL。Production接続なし。  
**方法:** `phase-d-restored-local-readonly.sql` を `psql -X -v ON_ERROR_STOP=1` でUnixソケットから実行。書込なし・read-only transaction COMMIT。  
**判定:** 12検査項目PASS。**復元DBのデータ整合性検査に限ったPASS**であり、完全なアプリ復旧のGOでも、本番同期復帰の許可でもない。

| 項目 | 実測 | 判定 |
| --- | ---: | --- |
| Auth users | 6 | PASS |
| Google identities | 6 | PASS |
| profiles | 6 | PASS |
| user_ca_identities | 6 | PASS |
| medal collections | 13 | PASS |
| medal designs | 13 | PASS |
| Storage metadata | 418 | PASS |
| foreign keys | 98 | PASS |
| 未検証FK | 0 | PASS |
| 参照先不明のCA Identity | 0 | PASS |
| Primary重複ユーザー | 0 | PASS |
| 資格のあるPrimary Identityの自拠点メダル欠落 | 0 | PASS |

補助実測（復元時点）: CA 200件、Communities 155件、CA-Communityリンク 196件、Primary Identity 6件、Community memberships 6件。

- 復元DBの `sync_automation_state.enabled=true`：**PASS（設定値確認のみ。Cron実稼働の確認ではない）**。
- `last_ca_master_at` は未来の2099停止値として検出：**PASS（復元DB内のみ。実本番の状態を再検証したわけではない）**。
- Identity複合FK `ON DELETE CASCADE`：**既存の未保護状態、同期復帰STOP**。
- 専用 `ca_master_sync_enabled` カラム：**NOT_APPLIED（復元時点では想定内）**。
- `ca-master-verified-baseline`：**0件、未承認**。CA 200件というDB総数をCSVの確認済み基準行数と誤認しないこと。

**次の未完了項目:** OAuth / Secrets / Edge Functions / Cron・通知・RLSの隔離フルE2E、
部分書込時の実データ差分試験、確認済みCSV基準件数の独立承認、画像デコード未解決3件。

**本番変更ゼロ。2099停止解除ゼロ。Draft PR未マージ。**


## CAマスターCSVとの個別照合（次の読み取り専用検査）

実シートの200件と復元DBの200件は合計が一致しても、個々のCA/Communityの
対応が同じとは限らない。Sheet現物の匿名集計と行番号は
`phase-d-live-ca-master-source-snapshot-20261012.md` に記録済み。

`scripts/phase-d-compare-ca-master-local.ps1` は、実CSVを一時ファイルに
ダウンロードして復元済みローカルDocker PostgreSQLを **READ ONLY** で
読み取り、照合結果の件数のみを表示する。CA名、ユーザーID、Community
UUID、認証情報は標準出力に出さない。一時CSV以外の既存ファイルを変更・削除しない。

PowerShellから実行する場合（**本番SQLもサービスへの同期も実行しない**）：

```powershell
cd C:\CA-Clover-Restore-Test
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/Kaityo1221/ca-clover/safety/ca-master-phase-d-isolated-qa-20261012/scripts/phase-d-compare-ca-master-local.ps1' -OutFile '.\phase-d-compare-ca-master-local.ps1'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\phase-d-compare-ca-master-local.ps1'
```

Google側CSVの直接ダウンロードにアクセス制限があるときは、
ブラウザで対象の `gid=633821294` タブのみをCSVとしてローカル保存し、
`-CsvPath 'C:\...\file.csv'` を指定する（古いタブを使わない）。
取得に失敗した場合は安全に中断。URLや秘密を変更して迂回しない。

検査の評価：
- `sheet_ca_missing_in_db` / `db_ca_missing_in_sheet`：CAキーの差
- `sheet_ids_not_mapped_in_db`：現行+履歴IDの対応が見つからない数
- `sheet_pairs_not_mapped_to_db_links`：シートのCA-ID組が既存DBリンクにない数
- `db_current_pairs_not_in_sheet`：DBリンクが現行シートにない数
- `result=REVIEW_REQUIRED_SYNC_STOP`：欠損・名称矛盾・割当不一致等があり要確認
- `result=KEYS_MATCH_BUT_PREFLIGHT_STILL_REQUIRED`：全安全条件の合格を意味しない

本スクリプトは`community_campfire_ids`の履歴別名を参照するが、
同一CAの安全な拠点異動として認められるか否かの自動判断はしない。
匿名集計後の個別修正・同期ゲートの解放には別の明示承認が必要。
