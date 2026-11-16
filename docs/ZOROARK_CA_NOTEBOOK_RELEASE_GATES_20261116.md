# 🍀 CA Clover「ゾロアークを探せ！」CAネタ帳 公開前安全判定（2026-11-16）

**PRODUCTION = NO-GO。以下すべてがPASSするまで、本番マージ・設定変更・DB migration・公開は禁止。**

## 統合差分の正本と依存関係
1. Pages #317: 「遊び方を選ぶ」右側の📚 ネタ帳ボタン位置。削除・移動禁止。
2. Pages #319: CA投稿画面、会長審査画面、#313由来の端末内ネタ帳・正式42組管理。#317へ積み上げ。
3. API #312: 既存42組の停止と追加お題の公開候補を同じround APIで統合した隔離コード。
4. API #318: #312上で本人投稿・編集・会長審査の新規 /api/zoroark/notebook を追加。
5. Backend #84: 新規お題の候補カタログRLS/版管理の基本SQL。
6. Backend #88: #84に重ねるCA投稿・本人編集・ADMIN審査・論理削除・監査拡張。
7. Backend #86: 正式42組の停止・復元RLSと独立DB gate（#88とは別の依存）。

## 変更禁止区域
- GitHub Pages `pages`、現行公開コミット `b129585fa5771dfb93aa0d9296055ae73cd3dda7`
- Vercel Production、Supabase Production、Neon Production、Edge/Cron
- 正式42組の元お題、既存ゲームの手渡し連続プレイ
- iPhone localStorage `ca-zoroark-admin-ideas-v1`, `ca-zoroark-official42-drafts-v1`, `ca-zoroark-notebook-trash-v1`

## 隔離環境の設定（実行GOとは別）
- ブラウザ: localhost からのみ、起動前の `window.CA_CLOVER_ZOROARK_QA={url,publishableKey}` を認識。公開Pages上ではQA設定を無視する。
- API: development + `ZOROARK_CATALOG_LOCAL_TEST=true` またはPreview、かつ `ZOROARK_NOTEBOOK_API_ENABLED=true`。
- `ZOROARK_NOTEBOOK_ISOLATED_SUPABASE_URL` と `ZOROARK_NOTEBOOK_ISOLATED_PUBLISHABLE_KEY` 必須。`NEXT_PUBLIC_SUPABASE_URL` / publishable key と一致させる。
- 既知の本番Supabase IDは拒否し、認証DBとゲームのカタログDBを隔離環境で一致させる。
- DBの `zoroark_topic_notebook_control.writes_enabled` は初期OFF。公開は独立して `zoroark_topic_catalog_control.publish_enabled` のDBゲートと API `ZOROARK_CATALOG_PUBLISH_ENABLED` で制御。
- 正式42組の出題停止は `zoroark_private.official_control.writes_enabled` とAPI `ZOROARK_OFFICIAL_WRITE_ENABLED` の二重ゲート。
- 開発者の端末ブラウザには本番の認証JWTを入れてQAに接続しない。

## 現時点の証跡
- Backend #88のNeon専用合成DB：43ステップPASS＋追加20ステップPASS。SQL適用・RLS・本人編集・権限剥奪・監査・論理削除を確認。
- DBゲート最終OFF。正式42組カタログ基本値42件。
- API #318 / Pages #319: Vercel Previewビルド成功済み（統合途中のコミット。最新HEADの最終CIは要再確認）。
- JS静的パーサーおよびノートブック画面静的検査コードを追加。
- 本番マージなし。

## 最優先残作業（未PASS）
1. **実GoTrue署名JWTとPostgREST実API**: 2名のCA＋ADMIN＋pendingで実認証を行い、CA投稿→本人編集→会長採用→公開→game roundの候補選出→停止→再開を連結。欠損/不正JWT、他人のID、ロール剥奪、再送、通信断、同時編集競合も確認。
2. **QA PagesとQA Next APIの接続**: localhost QA設定と実Authの一致を確認。localhost固定のコードを本番へ向けて変更してよいのは全試験PASSと新たな公開承認の後のみ。
3. **正式42組**: #86のDB状態を同一QA認証DB上で確認、#313由来の管理UIで停止→実次回ゲームから除外→復元。**42組の本文編集は現時点では端末内の下書きのみで、サーバーへの承認・反映機能は未完成**。
4. **iPhone Safari / Android / PC**: 320/390/430px、キーボード・画面読み上げ・ボタン位置・既存手渡し連続プレイ、異なる端末の同一投稿表示。
5. **データ保護**: 正式42組不変、既存8件やiPhone下書き/非採用/削除済みJSONのバックアップ→復元、重複/取り違えなし。操作ログを記録。
6. **CI**: JS／TS／Next build／API contract／SQL静的／実SQL認証／ブラウザ隔離総合試験を全PASS。GitHub Actions枠とCIログを確認。
7. **運用監査**: 接続先、環境フラグ、パブリッシュ版、ロールバック、バックアップの実施履歴を記録し独立レビュー。

## ロールバック要点（本番へは適用しない）
- QAテストの終了時は投稿 DB gate OFF、候補公開 DB gate OFF、正式42組 write gate OFF、API write flag OFF。
- **重要: 正式42組の停止レコードが存在する場合、読取フラグ `ZOROARK_OFFICIAL_CONTROL_ENABLED` を安易にOFFにすると停止したお題が新ラウンドで再出題され得る。先にwrite gateをOFF、read gateは影響判定後に扱う。**
- 公開候補はUIのローカル状態ではなく、DBの `published` とランタイム出題APIが一致していることを検証。
- SQLの無断DELETE、元の42組・iPhone下書きの上書き、公開前の本番DB切替は禁止。

## 公開判定
現時点で未達条件があるため **NO-GO継続**。
