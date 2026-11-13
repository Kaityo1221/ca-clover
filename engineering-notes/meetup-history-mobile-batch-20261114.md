# Meetup履歴スマホUI / 複数名簿ZIP（隔離候補・本番NO-GO）

## 対象とデザイン

基点は pages `09e274d45dfee1d5b3d3a64f37bae7cf8abe2a04`。提供画像のパーツ配置を参考に、**現行の色味を維持**。上部のRSVP/Check-in、履歴一覧/CSV選択、表示件数、横スクロールのカテゴリ、絞り込み結果、左側の日付と右側のタイトル・公式イベント名・場所・参加率を配置した。統計・分析タブと新たな期間フィルタは追加しない。既存の概要・個別名簿CSV・他のCommunity機能を維持。

25/50/100/全件、6分類＋すべて、報酬ありの公式名優先・報酬なしのタイトル分類は最新pagesのモジュールをそのまま使用。

## CSV選択と一括出力

- DありCAまたはadminだけにCSV選択タブを表示。CAは所属も照合。APIでの最終認可は既存Backend RPCが行う。
- CSVタブに入ると**表示中のみ全件選択**。個別解除・全選択・全解除。25件表示なら25件を選択するが、20件以下にするまで出力不可。表示件数・カテゴリ・Communityの変更で選択と保持データを破棄。
- 1回20件、1ステージ最大10件。Backendは単一処理を直列実行し、開始間隔15秒。並列取得なし。個別CSVと一括CSVは共通の排他・待機管理を使用。
- 現行3列CSVのBOM・CRLF・式文字防御をそのまま保持。CSV合計8,000,000バイトを取得中とZIP生成時に検証する。ZIP STORE形式（無圧縮）なので外部ライブラリ・CDN・外部アップロード不要。
- ステージ成功時だけ次段階へ進む。失敗・429は自動再試行せず停止。受信確認済みCSVのみ保持し、再試行は残りのIDから。通信自体が失われた場合の未受信ステージは、サーバー監査・制限の下で再取得される可能性がある。サーバー側の永続キャッシュは作らない。
- **現行制限の15秒間隔・1時間12回を変更しない**。20件を同一時間枠に取得できるとは表示しない。429では保守的に最大1時間待機してから手動再試行。
- 保持は端末メモリだけ・最大70分・利用者とセッションに固定。中止、期限、画面移動、pagehide、認証/権限失敗で破棄。ZIP保存前にも権限再照合。

## 接続と安全

`docs/meetup-batch-config.mjs` の接続先は空。リリース未検証のAPIを本番から呼ばない。合成プレビューだけが合成接続先を返す。

独立Backend候補は private repo の `feature-candidates/meetup-roster-batch/`。本番 `meetup-roster` v4 を読み取り取得して固定し、変更なしで再利用する。既存DB/RPC/監査・Auth・Campfireソースのロジックを置換しない。新規DBスキーマやマイグレーションは不要。

## ローカル検証

| 対象 | 結果 |
|---|---|
| Frontendの履歴/分類/参加率/個別CSV/一括CSV | Node 72件PASS |
| 独立Backend + 固定した実ハンドラー境界 | Node 24件PASS |
| 実PostgreSQL 17.11・ネットワークなし使い捨てDB | 既存RPC定義の19項目PASS |
| Chromium / WebKit・320/375/390/430px | 30項目PASS |
| 保存した20件ZIP | 両ブラウザの20ファイル・BOM・3列・CRC32をJSZipで独立検証PASS |
| Edge入口 | Deno型検査PASS |
| 公開/非公開境界・差分空白検査 | PASS |

ブラウザ試験は実Pages HTMLと実モジュールを使い、SDKとHTTPは合成。実Campfire・実SupabaseログインへのE2Eではない。PostgreSQL試験は本番から読み取った5関数を合成テーブルで実行し、実Auth/RLS全体の代用とはしない。

再現：`node --test scripts/ci/test-meetup-batch.mjs scripts/ci/test-meetup-history-*.mjs scripts/ci/test-meetup-metrics.mjs scripts/test-meetup-roster-pages.mjs`。ブラウザは `PLAYWRIGHT_RUNTIME` にPlaywright 1.62.1のnode_modulesを指定して `node scripts/ci/test-meetup-mobile-browser.mjs`。プレビューは `node scripts/ci/serve-meetup-mobile-preview.mjs`。

## 競合と残り

最新pagesをそのまま継承。他案件のPR/ブランチを変更しない。旧PR #245/#244/#239/#227 は最新pagesに対して競合があり、今回候補との `git merge-tree` でも `docs/index.html` 等の競合を確認。これらを一緒にマージしない。#172は初回APIがmergeable unknownで、未解決として記録。

本番公開はNO-GO。残りは実D/admin/権限なしアカウント、実APIの全件性・負荷・監査、実iPhone Safari保存、隔離ホストでの実Auth/DB/HTTP統合、リリース時の最新競合再確認と明示GO。一括接続の有効化・本番マージ・DB/Edge/Cron/Vercel変更は禁止のまま。

2026-11-14 ユーザーが「隔離ブランチの自動プレビュー停止だけ許可し、Draft PRを作成」と明示許可。`vercel.json` はこの隔離ブランチ名だけ deploymentEnabled=false にする。既存の本番/他ブランチの設定は変更しない。本番GOやデプロイ許可として扱わない。
