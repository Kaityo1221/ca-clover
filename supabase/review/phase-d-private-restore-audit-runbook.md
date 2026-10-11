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

- 復元DBへのこの読み取り専用検査の実行
- 現在の本番デプロイに対応するEdge/Cron/Secrets/RLS/Authの隔離E2E
- 失敗時の部分コミット、本人Identity、交換メダル履歴の実DB差分検証
- 同期前に人間が確認したCAマスターCSV基準件数の作成と監査方法
- 画像デコードが未解決の3ファイルの原因分類

**本番SQL・Cron・Edge・2099停止解除・PRマージは一切承認されていない。**
