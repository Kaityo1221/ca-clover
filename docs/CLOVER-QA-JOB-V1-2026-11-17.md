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

## Phase ③ 本番誤接続を防ぐ安全ガード（2026-11-17追加）

- `scripts/ci/clover-qa-preflight.mjs` で本番接続情報・外部サービス資格情報を示す環境変数が注入されていた場合、テスト実行前に拒否する。検出時はキー名・値をログに表示しない。
- `scripts/ci/test-clover-qa-preflight.mjs` で合成した接続先・認証情報による拒否試験を行う。正常ケースと、DB/Neon/Supabase/Discord/Google/Vercel/実行環境の不正ケースを確認する。
- ガード試験とプリフライトの両方がPASSしなければ、依存インストール・既存テスト・ビルドを開始しない。どの段階で失敗してもNO-GOで終了する。
- 既存の隔離PostgreSQLテストはネットワークを無効にした一時クラスタを利用する。ガードは**追加の防御層**であり、ネットワーク全体の遮断や既存試験全コードの副作用不存在の証明ではない。
- Neon、本番Supabase、Cloudflare、Vercelの実資産には接続しない。将来のNeon分岐試験を追加するときは接続先の署名・プロジェクトID・権限等を別途検証する。
- 自動Preview停止設定はVercel側で更新したが、次回GitHub更新で本当に抑止されるか、独立した履歴照合が必要。

**完了判定:** GitHub Actionsの新コミットにおけるガード・既存テスト・ビルド・レポートの全PASSを確認するまで、Phase ③の総合PASSとは呼ばない。PRはDraft、NO-GOを維持。

## Phase ④ Neon QA環境の読み取り調査・接続メタデータガード（2026-11-17）

Neonの既存プロジェクトを読み取りで調査したところ、`ca-clover-test`（project id `still-hill-22136867`）がある。これは**候補**であり、実行権限・個人情報の不存在・安全性まで認証したものではない。別途 `ca-clover-zoroark-prod` が存在するため、プロジェクト名の曖昧照合は禁止する。アンテナショップ関連の別プロジェクトも対象外。

`ca-clover-test` の既存ブランチの `init_source` は確認した範囲で `parent-data`。Auth/個人情報を継承した可能性を排除できないので、**既存ブランチの無条件複製は行わない**。

- `scripts/ci/clover-neon-qa-gate.mjs` は接続せず、対象プロジェクトの厳密一致、QAブランチ命名規則、非default、schema-only、synthetic fixture/Auth、外部副作用遮断宣言、24時間期限をチェックする。
- `scripts/ci/test-clover-neon-qa-gate.mjs` は正常1件と拒否13件を合成データだけで検証。実DBへの接続はゼロ。
- Actions実行前半にメタデータテストを追加し、FAILの場合は依存導入・試験・ビルドを実行しない。
- **このメタデータガードは偽造できる入力の形式検査であり、認証されたNeon APIで実ブランチ属性を照合する工程の代わりではない。** 現時点でNeonブランチ作成、接続情報取得、スキーマ抽出、Auth有効化、実SQL実行、データ複製は未実施。
- 次段階では、schema-onlyブランチ（現行Neonドキュメント上Beta）のAuth初期化可否や行データ0件、ID/対象ブランチのサーバー照合、独立した最小権限と外向き通信制御を検証してから実DBテストを許可する。
- 既存の本番認証やSupabase接続を変更しない。GitHub Actionsの既存Secretを注入せず、接続情報をGitHubにコミットしない。QA用作成API権限は最終的にPR由来の任意コードと分離する。

**Phase ④はメタデータ事前検証の実装中であり、Neon DB実連携完了ではない。** PR #325はDraft／本番NO-GO維持。

## 工程④追加調査と停止条件（2026-11-17）

- 直前のNeonメタデータガードを含むGitHub Actions #44058117281 はPASS。既存CI #44058117310 はこの記録更新時に別途確認。
- Neon接続の読み取り調査で、対象プロジェクト `ca-clover-test` の default branch `main` は **Neon Auth未有効**と判明。無断でAuthを有効化しない。
- 現在接続されているNeonブランチ作成ツールは **通常のparent-dataブランチのみ**。schema-onlyを指定できないため、通常作成で代用しない。
- 追加検証 `validateServerBranch` は、Neon APIから返されたはずの実サーバーメタデータに対して、QA専用プロジェクトとブランチ名、非default・非protected、親なし、schema-only初期化、有効期限24時間以内を要求する。**今は合成レスポンスでの単体試験のみ**。実Neon APIの schema-only 応答における `init_source` 値は未検証のため、実際の形式に合わせた調整を要する可能性がある。
- **実DB側の受入条件**：Neon側の正式なschema-only作成手段、初期行0件、テスト専用認証ユーザー、外部OAuth/通知無効、ブランチID実照合、後片付け、無料枠と費用、認証・機微情報の非継承。すべて検証するまでは実行しない。
- GitHub Actionsのサービス資格情報を勝手に注入しない。PRが改ざんできるコードとブランチ作成資格情報を同一ジョブに置かない。
- 本番Neon `ca-clover-zoroark-prod`、現行Supabase、他サービスの本番資産へは接続・書込みしない。

**判定：Phase ④は『事前ガード実装済み、実Neon接続とAuth試験は未実施』。本番NO-GO。**
