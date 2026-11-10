# 🍀 Issue #58 第2弾: Frontend CI重複実行の削減 (2026-11-10)

## 原因と測定基準
既存の2本のGitHub Actions (`CI`, `Public/Private Boundary CI`) が同一PRで並走し、それぞれ別runnerで依存インストール、公開/非公開境界確認、認証ルーティング試験、Next.jsビルドを繰り返していた。

2026-11-10の直近PR 10組の観測では、それぞれのジョブの経過時間は概ね28〜42秒であった（ワークフロー開始〜更新の経過時間。GitHub課金対象runner分数と同一ではない）。
これらのジョブは並列なので、統合しても待ち時間が同じ割合で短くなるとは限らない。主な改善は重複runner処理・消費計算資源の削減。

## 対応
- `CI / build`: 引き続き境界検査、`npm test`（認証ルーティングを含む全テスト）、`npm run build`を必須として保持。PRごとのconcurrencyで古いPR実行のみキャンセル。main pushはキャンセルしない。
- `Public/Private Boundary CI / boundary`: 独立した安全境界チェックの名称・ジョブを残し、`verify-public-boundary.mjs`のみを純粋Nodeで実行。2回目のnpm install、認証ルーティング、ビルドを除く。
- 両workflowに最小`contents: read`権限、checkoutで`persist-credentials: false`を設定。
- `New CA isolated demo Pages`は対象外。Pagesデプロイ、認証/API/DB/Edge等の本番設定を変えない。

## 検証ゲート（合否が揃うまでNO-GO）
1. 同じDraft PRの新しいコミットで`CI / build`と`Public/Private Boundary CI / boundary`が共にSUCCESS。
2. CIログでauth routing、MAP、Zoroark、Buildの必須試験が引き続き実行されていることを確認。
3. Boundary独立ジョブで`PUBLIC_BOUNDARY_PASS`を確認。
4. 同一コミットのbaseline同等PRと比較し、重複ジョブの経過時間を実測。Actions合計runner分数はジョブ開始/終了も確認。
5. PRはDraft、会長の別途明示GOまでmainマージ禁止。

## 影響・切り戻し
変更は`.github/workflows/ci.yml`と`.github/workflows/public-boundary-ci.yml`のみ。
CIの機能網羅性が落ちた場合は即NO-GOとしてPRを撤回。マージ承認後に予期しない挙動が出た場合は当該2ファイルを以前のmain状態へrevertする。
既存の個別機能PRは変更しない。
