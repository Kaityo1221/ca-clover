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
| テスト | `*.test.mjs`、`browser-smoke.mjs` | CSVの単体テスト＋権限表示の単体テスト、架空データのPlaywright操作試験 |

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
- 誤操作対策は、CSV押下時の確認ダイアログ、最終確認後のオンデマンド生成、取得中ボタンdisabled、結果取得後の解除、通信エラー時の停止、429時の再試行案内、ページ上限を最低限とする。
- 将来、実測により負荷問題が明らかになった場合は再評価する。その際にDBやEdgeなどの保護対象に影響する変更が必要なら、着手前にPOへ報告して判断を待つ。
- 既存の300件同時要求テストは**任意の過負荷シミュレーション**として残すが、本番への分散負荷制御実装を要求するものではない。

## CSV出力の確認ステップ（PO合意：2026-10-16）

参加者名簿を誤タップで簡単に取得できないようにする。初期版のUXは **「CSVボタン → 対象Meetupと扱いの注意を確認 → 生成してダウンロード」**。

- Meetup一覧を開くとき、または「CSV」ボタンを押しただけでは参加者明細取得やCSV生成を開始しない。カードに表示する参加表明・チェックインの人数は既存集計値で表示する。
- CSVボタンは確認ダイアログだけを開く。対象Meetupの名称・日時と、アカウント名を含むデータの扱いに関する注意を表示する。
- **「生成してダウンロード」** を本人が押したときだけ1件のCSV生成処理を開始する。「キャンセル」やEscで閉じた場合は生成せず、処理対象を破棄する。
- 生成中は再押下不可。終了・失敗時にボタンを復帰させる。不完全取得・429・タイムアウト時はダウンロードしない。
- 確認ダイアログは誤操作防止のUXであり、**アクセス権限の代わりにはならない**。本番では担当CA/許可管理者の認可確認が必須。権限確認実装とCampfire通信は別途STOP/PO承認待ち。
- 模擬データのUIは `preview.html` と `preview.mjs`、確認・キャンセル・Esc・正常CSV・エラー処理の自動テスト定義は `browser-smoke.mjs`。実ブラウザの再実行とユーザーiPhone Safariでの確認は別途必要。

## ADMINでのCSV権限付与（PO指示・2026-10-16）

**初期状態では、一般CAにCSVボタンを表示しない。**

- 許可条件：明示的な `D` 権限 + 自分に割り当てられたCommunityのMeetup。権限未取得時、未割当Community、未承認アカウントは非表示。ADMINは本人確認済みの管理者として扱う。
- 管理方法：既存のADMIN「👥 CAアカウント」に、S（Stamp Rally）とは独立のD権限ON/OFFを設ける。新たな管理メニューは増やさない。
- `preview.html` では通常CA（非表示）・権限ありCA（表示）・他Community（非表示）・pending（非表示）・ADMIN（表示）を**デモ選択**で確認可能。
- `admin-csv-permissions-preview.html` は架空のCAだけの管理画面モック。付与・解除を試せるが**DBにも本番権限にも保存しない**。
- `csv-permission.mjs` は**画面上の表示だけ**を判定する純粋関数。**本番CSV APIではサーバー側で権限と所属Communityを再検証することが必須**。
- CSV確認画面の目的は「ミニゲーム利用」「出欠確認と照合のため」「イベント運営」「その他」。補足情報は通常任意、「その他」の場合だけ必須。取扱い同意も必要。
- 本番の権限設定には既存 `supabase/functions/admin-manage/index.ts`（現行Sのみ受理）、`user_permissions`のコード制約確認、`src/app/admin/accounts/page.tsx`の変更が必要。**Phase EルールによりSTOP／個別GO待ち**。
- 監査ログは別途DB/RLSとサーバー側保存が必要。ログを保存できない場合はCSV出力しない設計。

詳しい監査・権限・変更候補は `CSV-AUDIT-DESIGN-v1.md` を参照。
公開GitHubソースの読み取り専用影響調査は `CSV-PERMISSION-IMPACT-REVIEW-2026-10-16.md` 参照。既存権限テーブルの`D`形式は許容される見込み。ただし実DB未確認、ADMIN Edgeの変更はSTOP。


## 独立モックの確認場所と検証状況（2026-10-16）

ローカルサーバー `python -m http.server 8765` をリポジトリ直下で起動すると、以下を表示できる。

- CA側: `http://127.0.0.1:8765/experiments/meetup-participants-csv/preview.html`。初期の通常CAはCSVボタン非表示。デモ用の権限選択で「D権限あり」「他Community」「pending」「ADMIN」を切り替えられる。
- ADMIN側: `http://127.0.0.1:8765/experiments/meetup-participants-csv/admin-csv-permissions-preview.html`。架空CAへの付与・解除のみ。**実アカウントへの操作ではない**。
- `csv-permission.mjs`/`.test.mjs`: ブラウザ上の表示可否のみを模擬。サーバー側の認可処理ではない。
- `csv-purpose.mjs`/`.test.mjs`: 目的4択＋任意補足（その他の場合だけ必須）＋取り扱い同意を検証。サーバー側の入力検証ではない。
- テスト: 独立JavaScript評価で純粋ロジック**60/60 PASS**、架空DOM操作の模擬で**23/23 PASS**。Node `--test` と実Chromiumの再実行結果ではない。GitHub Actionsの既存CIとは別。

## STOP / 個別承認が必要な作業

1. **実参加者名の取得**: Campfire API GraphQL、認証、トークン、利用条件および識別子への影響。**STOP、別途GOが必要**。
2. **実ユーザーによるCSVダウンロード**: サーバー側の本人確認・担当Community/イベント照合、新規API/Edge Functionsの変更が必要。**STOP**。
3. **負荷対策の方針**: 300人は将来のCA登録総数であり、同時接続想定ではない。**300件同時処理のための専用キュー・共有ロック・DB/RLS追加は初期要件から除外**。必要なのはCSVボタンの連打防止、対象1件だけのオンデマンド取得、ページ取得上限、タイムアウト、429などへの安全なエラー表示。既存Campfire取得系やAPIに手を入れるなら別途STOP。
4. **全参加者が取得済みという根拠**: rsvpStatuses全件の独立した確認がない場合はPARTIAL扱いで、本番CSVを生成しない。
5. **画面への実組み込み・CI変更**: 対象の最新コードとの再照合、差分監査、必要ならPO判断を先に実施。

## 完了判定

この独立試作の完了は**CSV本番機能の完成を意味しない**。実データ取得・権限/利用条件・回帰テスト・ユーザー実機確認・本番GOは別ゲート。

**このフォルダ内には実トークン、実参加者名簿、PC固有パス、バックアップ、Phase E証拠を持ち込まない。**
