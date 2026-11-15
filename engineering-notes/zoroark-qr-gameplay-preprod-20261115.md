# CA Clover「ゾロアークを探せ！」QRゲーム本編 改善②・本番直前引継ぎ

更新: 2026-11-15 JST  
**本番判定: NO-GO / Vercel公開は今回の対象外。**  
Frontend PR [#303](https://github.com/Kaityo1221/ca-clover/pull/303) / Backend PR [#85](https://github.com/Kaityo1221/ca-clover-backend-private/pull/85)。

## 変更範囲

- 元Front #288、Backend #71の既存QRロビー/CA本人認証/ゲストCookieに積んだ**独立Draft**。元PR、`pages`、`main`、本番DBは編集しない。
- CA/ADMIN本人だけがGMとして入室承認、試合開始、トーク終了、投票集計、結果発表、終了を操作。
- ログイン不要の一般参加者は、自分のHttpOnlyセッションで自分の役職・お題を取得。秘密は本人が開くまで非表示。参加者本人の画面を離れると再び隠す。
- 質問カードは12種類から選択、1人最大5回。投票は1人1票、自己投票禁止、同票は決選投票、結果公開時にのみ全員の秘密を公開。
- 初期人数6人、3分、ミミッキュOFF。ルーム内の`mode`は既存DB/API互換のため維持。新規QR作成画面から旧シンプル/マニュアル選択を取り下げ、ミミッキュ任意選択に変更。
- GM・ゲストの画面は10秒間隔で状態を自動更新。手動更新もでき、通信エラー時に最後の表示状態を不用意に破棄しない。
- 最新の対面手渡し（GMあり／なし、指差し投票、本人役職表示）と別系統。**QR方式は専任GMありのみ**。リモート番号入室は引き続き準備中。

## API・プライバシー境界

- `/api/zoroark/game/gm`: Supabase Authの`getUser`で本人を検証、現在の`profiles.role`を再取得。さらにDB内でGM本人のルーム所有権を確認。全操作POSTかつ同一Origin/CSRF、2048 byte制限。
- `/api/zoroark/game/guest`: `__Host-zg_guest` と `__Host-zg_device` の二つのCookieを要求。セッション/端末ハッシュをDB側で照合。参加者の指定ID/指定役職/任意roomIdを信頼しない。
- 別のゲストの役職とお題は試合中どのGET/POSTにも含めない。GMにも結果発表前には渡さない。DBロールはRPCのEXECUTEだけ許しテーブル直接アクセス不可。
- 正式42組は既存の認証付き `/api/zoroark/round` をサーバー側から呼んで取得。新しい問題集を作らない。別端末へのQR招待自体は既存ロビー基盤を再利用。
- `ZOROARK_GAMEPLAY_ENABLED=true` と既存runtimeConfig（Vercel環境、ブランチ、接続先、DB名、SQL role、TLS）両方が一致する場合のみ有効。**フラグはデフォルトOFF、Vercelの本番設定には未追加。**
- 新規開発ブランチは`vercel.json`の`deploymentEnabled=false`。新規Vercelデプロイは要求・実施しない。

## 実DB・CI証跡

- QAブランチ `br-young-truth-beh0eutw`（専用Neon `silent-sea-07101633`、DB`zoroark_prod`、target=preview）。40件超の移行SQLを適用し、実Postgres17で構文を確認。
- ロール/プロンプト秘匿、4人試合の開始→質問→投票→結果→終了、同票からの決選投票、終了後のセッション遮断が実DB PASS。
- 同時試合開始4リクエスト: 成功1、拒否3、DB作成ルーム用ゲーム1。並列同一投票12件: 成功1、残り11を拒否、実DBの票1。
- `zoroark_runtime_guest`と`zoroark_runtime_gm`のロールテーブル直接参照、およびゲスト→GM RPC呼出しは42501で拒否。
- Front CI（8テスト、TypeScript、Next build、境界試験）は動作確認済み。Chromium/WebKitともに390×844のゲスト模擬試験（秘密・質問・投票・結果）PASS、Actions run 43672638686。最新UI修正後のCIは個別確認が必要であり、実機Safari試験とは区別する。
- Backend GitHub Actionsはランナーが割り当たる前に失敗（ジョブのsteps空、ログが取得不可）。**CI PASSと扱わない**。同一SQLはNeon子ブランチで実動作確認。
- 本番リハーサル専用Neon子ブランチ `br-long-unit-bej0x7iu` でproductionターゲットガード版のSQLを適用PASS。RLS 4/4、GM/guest直接SELECT権限なし、各RPCの許可を確認。**本番mainではない。**
- QA SQL `20261115_gameplay_preprod.sql` と本番候補 `20261115_gameplay_production_candidate.sql` はコメントと環境ガード以外で完全一致。差分検査スクリプトをBackend PRに配置。

## 本番の直前で止める条件

1. **実CAログイン→ルーム作成→別iPhone/AndroidゲストのQR参加→GM承認→お題・質問・投票・再投票→結果**の実環境E2Eは未確認。Vercel公開は今回省略なので代替試験の限界を明示する。
2. Front #288と本線`pages`、Backend #71と`main`の差分と競合を再確認。統合前には最新の対面・メダル・名簿・写真・Meetup機能の回帰テスト。
3. DBマイグレーション実行前にNeonの`project_id`、`branch_id`、`database_name`、`deployment_identity.target`の4つを再確認。本番候補SQLは**現時点未適用**。
4. 本番反映のGOが出るまでFrontend/Backend PRをDraftのまま保持し、`ZOROARK_GAMEPLAY_ENABLED`をOFF。本番Pages、Neon main、Supabase Auth/Edge/Cron、Vercel本番、既存ユーザーデータには触れない。
5. 本番反映時はDB候補適用後もフラグOFFで読取検証し、アプリの本番環境整合を検証してからゲートを開く。障害時はフラグをOFFに戻し新規入室・ゲーム開始を閉じる。データを消す自動SQL rollbackは設けない。

**残りの主なゲート**: 最新HEADのCI確認、Backend CI環境障害解消、実CA Auth/QR別端末E2E、最終統合競合確認、ユーザーの個別公開GO。Vercel公開は依頼により省略。
