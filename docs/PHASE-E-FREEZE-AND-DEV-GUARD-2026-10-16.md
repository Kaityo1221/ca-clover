# CA Clover | Phase E 一時凍結・開発の変更防止記録

記録日: 2026-10-16 JST
状態: **Phase E = PAUSED / STOP_UNPROVEN**。通常開発は条件付きで再開可能。
この文書は運用上の変更防止ガイドであり、Phase EのPASS証明ではない。

## 現在地
- Phase EはSTEP 45（PC再開用の手順作成）で一時停止。
- STEP 38の新規隔離環境では、拡張所属51オブジェクトの所有者差異0、全84 COPY対象と6シーケンスの一致などを検証。STEP 39〜45はオフライン監査器、証拠連鎖、試験と再開手順を整備した。
- **総合判定はSTOP_UNPROVENのまま**。2026-10-15バックアップ同時点の独立Baseline、pg_init_privsの3件（pg_stat_statements_reset / pg_stat_statements / pg_stat_statements_info）、Storage実ファイル、Auth・Edge実配備・秘密設定、隔離アプリ動作、既存コンテナの完全な不変性は未証明。
- 個別テストのPASSをPhase E総合PASSに読み替えない。新しいsnapshotで過去の独立Baselineを代用しない。

## 絶対に保全する対象：通常開発で操作しない
- 既存Phase Eバックアップ、ダンプ、globals、ハッシュ・manifest、証拠ログ、STEP 37〜45の監査成果物。**上書き・削除・改変・整理・差し替えは禁止**。
- 既存の隔離Dockerコンテナ、DB、ボリューム、ネットワーク、私的証拠フォルダ。通常開発からdocker exec/cp/start/stop/restart/rm、DB操作をしない。
- 復元・保護専用スクリプト（存在する場合、例：scripts/recovery/**、Phase E専用SQL・PS1・監査コード）を変更しない。
- 検証環境の安全ガードを緩めない。Cron停止、pg_net通信の隔離、CAマスター保護・同期停止、ネットワーク隔離、RLS/ACL/FK等の保護条件を解除しない。
- 本番Supabaseを復元テストの対象にしない。Phase E再開と無関係な作業で本番への管理SQLや秘密取得を行わない。

## 通常開発を再開してよい範囲
- 独立ブランチでのUI、見た目、表示位置、フロントエンド限定の改善。
- 例：メダル表示調整、My Community UI、参加者CSVダウンロードの画面だけの作業。
- CSVの参加者明細取得やAPI処理を追加する場合は**API/権限/性能/認証への影響確認が必要**。画面作業と同一視しない。
- 本番デプロイは独立したレビュー・実機テスト・ユーザー承認を要する。

## STOPして事前調査・個別GOを求める領域
次を直接変更するか、依存関係で影響する場合は、変更・マージ・本番反映の前に停止して影響範囲を報告する。
- supabase/migrations/**、supabase/schema.sql、SQL、ロール、所有者、GRANT/REVOKE、RLS、Policy、FK、トリガー、DB関数、CAマスター保護。
- supabase/functions/** や共有コードの変更、とりわけsync-ca-master*、sync-campfire*、meetup-detail、admin-manage、community-claim*、メダル・交換・Cron・pg_net・認証関連の処理。
- Supabase Auth、JWT、サービスロール、Secrets、Vault、Storage実ファイルやバケット/ポリシー、Edge Functionsのデプロイ、Campfire取得フロー、CAマスター同期。
- .github/workflows/**、ホスティング/デプロイ構成、環境変数、API/DB接続先。
高リスク箇所は永久に改修禁止という意味ではなく、**Phase Eから切り離した別ブランチで影響調査と明示的なGOを経てから改修可能**。

## 新規機能・PRの共通チェック
1. ベースcommit、作業ブランチ、変更許可範囲、DB変更可否を記録。
2. diffと依存先を確認し、Phase Eの保全対象・高リスク領域に触れるならSTOPして具体的な影響を提示。
3. Phase Eの修正と通常開発を同じPRに混ぜない。「ついで」の変更も禁止。
4. 対象機能のテストと該当する認証/My Community/メダル/交換/Campfire取得等の回帰確認を実施。
5. 本番反映は個別に承認を得る。Phase Eの状態から本番反映OKを推論しない。
6. 影響が不明なら自己判断で範囲拡大せず停止する。

## Phase E再開条件
- ユーザーの**明示的な再開指示**があるまで既存のバックアップ・コンテナ・証拠には操作しない。
- 再開時はSTEP 45手順と既存私的証拠の**読み取り専用**確認から始め、無条件で復元をやり直さない。
- 同時点独立Baselineが確認できなければ未証明のままとする。新バックアップと新snapshotの取得は別計画で承認する。
- 本番設定、CAマスター保護、cron/pg_net安全条件、既存隔離環境を変更する前には個別GOが必要。

この公開文書には**接続情報・秘密値・生SQL・私的ログ・ユーザーPCの絶対パスを載せない**。実際の変更阻止はブランチ保護・レビュー設定等で別途強制する必要がある。

**要約：Phase Eは一時凍結。通常開発は別ブランチで継続可能。ただし保全対象を壊さない。**
