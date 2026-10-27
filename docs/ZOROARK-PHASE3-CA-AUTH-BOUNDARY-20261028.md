# CA Clover 🍀 ミニゲーム「ゾロアークを探せ！」 Phase 3（隔離UI案）

日付: 2026-10-28 JST

## 現在の判定

**UI統合試作：作業ブランチのみ。CA限定機能としての本番リリース：NO-GO。**

- リポジトリ: `Kaityo1221/ca-clover`
- ブランチ: `feat/zoroark-local-gm-ui-20261028`（`main` から分岐）
- 変更対象（すべて新規追加）:
  - `src/app/mini-games/page.tsx`
  - `src/app/mini-games/zoroark/page.tsx`
  - `src/components/zoroark-local-game.tsx`
  - `src/lib/zoroark-game.ts`
  - `scripts/test-zoroark-engine.ts`
  - 本文書
- 本番変更禁止: `main`、現行PR（特にADMIN #181）、Backend #18/#21、認証フック、DB/RLS/Policy、Edge、Secrets、GitHub Pages設定、Vercel、Phase E保全領域。
- 既存の `useAuthProfile` を読み取りで利用し、`admin` / `ca` を画面上の起動対象とする。
- `pending`、未ログイン、権限未取得、取得エラーはfail-closedで非表示。
- ページは `/mini-games` および `/mini-games/zoroark` に追加。HOMEナビにはまだ登録していない（既存編集PRとの競合回避）。
- ゲームはブラウザ内で動作し、DB書込、データ取得、第三者通話、秘密通信はしない。一般参加者はGMの端末でお題確認。
- お題42組、初級12/中級15/上級15、6組の直近回避、トーク補助、指差し投票、発表演出。
- 最新の公開単体デモは引き続き認証なし。**このデモURLをCA限定サービスとして配布しない**。

## セキュリティ上の重要な限界

**ReactでGM画面を隠すだけではCA限定のセキュリティ境界にならない。** 公開Next.jsバンドルのソースからゲームを複製でき、ブラウザ側コードは改変できる。CSSの非表示・画面遷移ガード・localStorageフラグ・クエリパラメーター等では「CA以外はGMできない」を保証できない。

現行版は**CA Cloverの認証と同じUIを利用するプレビュー**にすぎない。未承認者がサーバーにGM権限を行使できない状態を作るため、下記が必要。

## Phase 3B 安全設計（未実装・実施前に個別GO）

1. 新しい専用Edge Functionなどを検討。全GM用のゲーム開始操作にJWT検証（サーバーで `auth.getUser` 等）とロール確認を毎回適用する。
2. DBの `profiles.role` が `ca` または `admin` で、承認／失効の扱いが既存仕様と整合していることを調査。クライアントの `role` 申告やユーザーID申告を信用しない。
3. サーバーだけがお題ペア・少数派位置を決める。ゲーム中はGMトークンに紐づく必要最小限だけ配布し、投票まで多数派と少数派を本人以外に見せない設計が必要。
4. エンドポイントを未ログイン・pending・期限切れJWT・権限失効・異なるユーザー・再試行・アクセス集中でテスト。
5. サーバー側権限検証が導入・通過するまで、現地版の**本番導入はNO-GO**。公開デモを認証済み用画面として扱わない。
6. セッションやサービスロールキーをURL、HTML、localStorage独自キー、ログへ出さない。既存OAuth/Google認証を利用し、認証フックそのものは変更しない。

## ゲーム仕様の確定内容

- GMはCA Cloverに承認されたCA（ADMINも許可）であり、プレイヤー本人ではない。
- ゲームの参加者にはCA Cloverアカウント不要。GMの端末だけを回す。
- 少数派は1人、本人に少数派とは知らせない。ポケモン名の発言は禁止、ブラフ・嘘は許可。
- 進行方式は順番に2周またはフリートーク。最後は指差し投票、同票最多は決選投票。
- お題画像の使用権を確認するまで公式画像の無断収録は行わず、初期版はテキストお題。
- 遠隔対応は後工程とし、このPRに含めない。

## 完了条件と確認手順

- `node --experimental-strip-types scripts/test-zoroark-engine.ts` がPASS
- `npm run test:auth-routing` と `npm run build` の既存回帰確認
- 識別した新規ファイルのみのdiffであること。
- iPhone SafariでUIの未ログイン/承認待ち/CA/ADMIN/通信エラー分岐確認。
- セッション失効時はゲームを画面から消す。権限読み込みエラーでゲームを始めない。
- 上記の検証ができてもサーバー側認可がなければ、最終判定は**本番NO-GO**のまま。

## 運用・安全上の判断

`AGENTS.md` と `docs/PHASE-E-FREEZE-AND-DEV-GUARD-2026-10-16.md` の認証/DB高リスク停止規則を優先。Phase 3Bを勝手に開発・配備しない。既存の工程⑤/⑥と同一PRにまとめず、ユーザー承認後に別計画にする。
