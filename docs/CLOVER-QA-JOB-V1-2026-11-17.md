# 🍀 Clover QAジョブ Ver.1 構築記録（2026-11-17）

## 会長の理想
スマホからChatGPTへ開発を指示し、隔離環境で試験・再試験・証跡確認を進める。十分な証拠を確認した後、会長が対象差分を指定して明示的に本番GOした場合だけ反映する。

本書は [次世代CA Clover構想](NEXT-GENERATION-CA-CLOVER-VISION-AND-DEV-REQUIREMENTS-2026-11-16.md) に従う。**現行本番・Neon移行はNO-GO**。

## 今回の実装範囲

- `.github/workflows/clover-qa-v1.yml` に独立したGitHub Actionsジョブを追加する。
- 初期版は既存の `npm test`・`npm run build`・公開/非公開境界チェックを再利用し、新しいDBや外部サービス接続は行わない。
- Actionsのジョブ概要（スマホで閲覧可能）と14日保持のJSON/Markdown証跡を作成する。
- 試験が失敗・未実施・依存導入失敗のときは、必ずNO-GOとする。
- ドキュメント/ジョブ自体のPR更新で試運転できる。通常は手動 `workflow_dispatch`。**GitHub仕様上、手動起動には本ワークフローがデフォルトブランチに存在する必要がある**ため、Draft PR段階ではPRトリガーで検証する。PRをマージする許可は今回ない。

## 絶対的な禁止事項

- Secrets、Supabase/Neon DB接続情報、実Discord OAuth・Webhookをこのジョブへ渡さない。
- 本番DB、Auth、Storage、Cloudflare/Vercel、Cron、既存Campsite AI資産に触れない。
- 自動PRマージ、main/pages変更、本番デプロイ、課金・新リソース作成を行わない。
- 公開GitHubの成果物に個人情報・秘密値・DBダンプを保存しない。

## Phase 2以降の設計課題（未実装）

1. 対象コミットと隔離Neon DB/Authブランチを検証する環境プリフライト。誤接続に対する負の試験がPASSするまで接続禁止。
2. Google・Discord・Campfireはまず完全に模擬した安全な試験を追加し、実OAuthは別環境・別承認で確認する。
3. Frontend／非公開Backend両リポジトリの整合性。秘密のコードやテストデータを公開側へ置かない。
4. 影響範囲に応じた軽量・重量テスト選択、実ブラウザE2E、修正→再試験のループ。
5. Cloudflare Freeによるジョブ状況表示や通知は必要性・利用枠・既存アカウントの資産分離を確認後に検討。
6. 本番GOは承認対象のコミット・環境・証跡・復旧方法と紐づけ、試験ジョブへ常設の本番変更権限を与えない。

## Ver.1の受入条件

- 開発用Draft PRでワークフローが起動し、既存CIテスト・ビルドの結果を表示できる。
- `clover-qa-v1-report` アーティファクトが保存され、PASS/NO-GO・未実施の範囲が明確。
- 本番変更0、秘密情報利用0、外部デプロイ0。
- 実動作未確認の段階でPASSを宣言しない。

**現状:** 構築用Draft PRの提案。実行結果はActionsで確認するまで未検証。
