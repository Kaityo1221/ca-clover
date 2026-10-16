# CA Clover Meetup参加者CSV | Phase E凍結下の独立試作

**2026-10-16 JST / SAFE-FRONTEND + OFFLINE-FIXTURE ONLY / 本番未接続**

## 必須の運用ルール

- 開発の基準: `AGENTS.md`、`docs/PHASE-E-FREEZE-AND-DEV-GUARD-2026-10-16.md`（このブランチの親は 2026-10-16 main `36c04fd3ccbc58c4398c09c39cdb9c8f30e59ba7`）。
- Phase Eは**STEP 45でPAUSED / STOP_UNPROVEN**。復元PASSとは判断しない。Phase Eの成果物・監査証拠・バックアップ・隔離Dockerには一切アクセスも操作もしない。
- 別ブランチ`feature/meetup-csv-safe-20261016`。従来の試作PR #149から**`.github/workflows/`の変更を除外し、実行部品だけを移した**。
- このブランチで変更できるのは`experiments/meetup-participants-csv/`以下の架空データ試作のみ。変更を拡げる場合は STOP / 影響調査 / PO判断。
- `src/`、`supabase/`、`.github/workflows/`、`docs/`、`scripts/recovery/`やCI・ホスティング設定、DB/RLS/Policy/FK、認証、Edge、Cron、Campfire取得クライアント、CAマスター保護は**変更禁止**。
- mainマージ・本番デプロイ禁止。ユーザーの明示的なGO後に別工程として判断。

## できていること（モック・オフラインのみ）

| 対象 | ファイル | 内容 |
|---|---|---|
| Excel CSV生成 | `csv-core.mjs` | UTF-8 BOM、参加表明・チェックイン・username、CSV式注入防御、現地日付、欠損時停止 |
| ページ分割 | `member-pages.mjs` | 注入された模擬fetch関数でcursor処理、欠損/重複/件数不一致で停止 |
| 診断 | `api-diagnostic-contract.mjs` | 模擬データのPASS/PARTIAL/STOP。実データの全件性は未証明 |
| 出力フロー | `export-coordinator.mjs` | 認可・取得を模擬したオンデマンド処理。負荷枠は**任意**であり、全体共有制限は初期要件にしない |
| 利用者向けエラー | `export-failure.mjs` | 個人名やトークンを出さない日本語エラー |
| UI | `preview.html`、`preview.mjs` | 現行My Communityのlime色・行区切りを再現した独立モック、仮データCSV |
| テスト | `*.test.mjs`、`browser-smoke.mjs` | 単体47ケース相当、架空データのPlaywright操作試験 |

### ローカルテスト手順（Node.js 22）

リポジトリ直下:

```sh
node --test experiments/meetup-participants-csv/*.test.mjs
```

UIプレビューをローカルで見る場合:

```sh
python -m http.server 8765
```

ブラウザ: `http://127.0.0.1:8765/experiments/meetup-participants-csv/preview.html`

Playwrightを明示的にセットアップしたローカル環境であれば `node experiments/meetup-participants-csv/browser-smoke.mjs` で、320/375/390/430/768px、44pxタップ領域、詳細/CSV操作の分離、3種のエラー、ネットワーク通信ゼロを確認できる。**このブランチのために新しいGitHub Actionsワークフローは作らない**。

## UI統合の参考のみ（変更禁止）

- 既存デザイン: `src/app/globals.css`
- 既存Meetup履歴・概要: `src/app/community/[id]/page.tsx`
- 既存の1/3/6/12か月・全期間、グラフ、詳細、コピー、Campfireリンクを保持。
- 表示文言は「参加表明」「チェックイン」。CSVは44px以上の独立ボタン。
- 本番画面には現時点で接続していない。


## 運用規模に関するPO判断（2026-10-16）

- **CA登録者300人は目標総数であり、同時利用300人ではない**。
- 各CAが必要時にMeetup 1件をCSV出力する低頻度利用を想定。参加者の明細を常時取得・蓄積しない。
- 初期版で**全体共有の同時実行管理・待機キュー・新規DBテーブル・分散ロックを実装しない**。
- 誤操作対策は、CSV押下中のボタンdisabled、結果取得後の解除、通信エラー時の停止、429時の再試行案内、ページ上限を最低限とする。
- 将来、実測により負荷問題が明らかになった場合は再評価する。その際にDBやEdgeなどの保護対象に影響する変更が必要なら、着手前にPOへ報告して判断を待つ。
- 既存の300件同時要求テストは**任意の過負荷シミュレーション**として残すが、本番への分散負荷制御実装を要求するものではない。

## STOP / 個別承認が必要な作業

1. **実参加者名の取得**: Campfire API GraphQL、認証、トークン、利用条件および識別子への影響。**STOP、別途GOが必要**。
2. **実ユーザーによるCSVダウンロード**: サーバー側の本人確認・担当Community/イベント照合、新規API/Edge Functionsの変更が必要。**STOP**。
3. **負荷対策の方針**: 300人は将来のCA登録総数であり、同時接続想定ではない。**300件同時処理のための専用キュー・共有ロック・DB/RLS追加は初期要件から除外**。必要なのはCSVボタンの連打防止、対象1件だけのオンデマンド取得、ページ取得上限、タイムアウト、429などへの安全なエラー表示。既存Campfire取得系やAPIに手を入れるなら別途STOP。
4. **全参加者が取得済みという根拠**: rsvpStatuses全件の独立した確認がない場合はPARTIAL扱いで、本番CSVを生成しない。
5. **画面への実組み込み・CI変更**: 対象の最新コードとの再照合、差分監査、必要ならPO判断を先に実施。

## 完了判定

この独立試作の完了は**CSV本番機能の完成を意味しない**。実データ取得・権限/利用条件・回帰テスト・ユーザー実機確認・本番GOは別ゲート。

**このフォルダ内には実トークン、実参加者名簿、PC固有パス、バックアップ、Phase E証拠を持ち込まない。**
