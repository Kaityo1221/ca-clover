# CA Clover｜本番リリース前リハーサル・残課題
2026-10-10 / 統合Draft PR #128 / 推定開発・検証進捗90%

**判定: Synthetic QA PASS / Production GO = STOP。**
この手順書は本番実施の許可ではない。本番へのDDL、DML、Edgeデプロイ、
CAマスター手動同期、2099年仮停止解除、pagesマージは実施していない。

## 1. 今回改善した事故防止
- CSVの未解決Community / 同一Community IDの名称競合 / 同名に複数ID / 同一CAソースキーの役割・状態矛盾を、**CAやCommunityの最初のDB書込みより前に拒否**。
- 同一CAの複数CommunityでCA属性が一致する場合、`source_key` を1件にまとめ、複数行UPsertエラーを回避する。
- CSVが不正な場合、CAマスター専用フラグだけを停止し、理由を同期監査へ記録。停止をDBで確認できなければ期限付き排他ロックを保持し、次回起動時に自動停止へ移行。
- すでに本人Identityに紐付く旧CAリンクが残る場合、誤って正常終了扱いにせず、専用同期停止と管理者レビューを要求。
- 共通スケジューラ `enabled` は止めず、通常のMeetup/アイコン収集を保護。

## 2. 合成テスト（本番では実行しない）
- `scripts/test-ca-master-source-preflight.mjs`：正常、同一CA複数Community、空CSV、Community未解決、名称-ID競合、CA属性の不整合を含む12ケース。CA書込より前に全検査する順序も検証。
- `scripts/ci/ca-master-multi-transaction-recovery-postgres.sql`：使い捨てDBで**3つの個別コミット済みトランザクション**を再現。CA属性更新の確定、次のCommunity書込失敗、CAマスター専用停止、Identityとメダル保持、ADMINによるCA属性修復を検証。
- `scripts/test-ca-master-failure-injection.mjs`：REST停止・監査の異常6ケース＋事前検査エラー時の監査とロック保全。
- `scripts/ci/unlisted-ca-medal-rpc-postgres.sql`：本番由来のメダル付与・取得デザイントリガーを実行し、保存失敗時の全承認ロールバックを検証。
- `scripts/ci/release-candidate-rls-postgres.sql`：通常CA・ADMIN・匿名のRLS権限を合成DBで検証。

**限界:** 複数のCOMMITを再現しても、これは実際のEdge Functionから
PostgRESTへHTTPリクエストを送るフルE2E試験ではない。
本番相当スキーマを丸ごと復元したテストでもない。
同時更新、ネットワーク切断やタイムアウトの実挙動も未完了。

## 3. 本番Edgeのソース照合（read-only）
- 実稼働 `sync-campfire-auto` v10 は保存用PR #119のmain fileと**完全一致**。
- 統合版ではv10にCAマスター専用ゲートの条件を加えたのみ（比較上3行追加、旧条件1行置換）。アイコン更新と申請通知は残っている。
- 実稼働 `community-claim` v14 は保存用PR #116のmain fileと**完全一致**。
- 統合版では元のv14から**39行追加のみ**。未掲載CAの新しい本人確認後メダル付与処理を feature flag で分離。
- **対策追加:** 本番v14との差分だった `isPasscodeRewardEligible` 2行は、Community申請専用 `getAnonymousClaimEvent()` でのみ除外。申請の3つの匿名Meetup確認経路を切り替え、一般Meetupと公開Activityクエリは維持。`scripts/test-claim-graphql-compat.ts` の**本番v14フィールド集合との一致テスト（外部通信なし）**で確認する。クエリ形式の比較はローカルで完結し、Campfire実ネットワーク応答の動作確認は別途残る。
- 同関数の `_shared/campfire/types.ts` は稼働中バンドル取得結果が空ファイルなのに対しGitHub側は型定義あり。TypeScript型は通常実行時に消去されるが、ソース差分として再確認が必要。

## 4. バックアップと照合
`supabase/review/release-private-data-fingerprints.READONLY.sql` は
主要5テーブルの件数とレコード内容の非可逆フィンガープリントを出す**照合用**。
本番でREAD ONLY検証済み。値はパブリックRepo/CIに出さない。

**重要：ハッシュや件数はバックアップではない。**
本番適用の明示承認後、切替より前に、個人データを含む全必要テーブル、
RLS、トリガー、外部キー、関数、実稼働EdgeコードとCron設定について、
復元可能な独立バックアップを非公開・暗号化領域に用意する。
復元テストとオブジェクト単位の照合を実施し、
件数だけでなく本人Identityの組合せとメダル所有者を確認する。
資格情報、個人名、アカウントIDの実値をpublic GitHubへ貼らない。

## 5. 本番移行 GO条件（すべて必要）
- [ ] 管理者による復元可能な非公開バックアップ確保と復元試験
- [ ] 本番相当の完全スキーマ / RLS / トリガー / EdgeからHTTPを使った障害E2E
- [ ] `community-claim` の共有GraphQLクエリ差分（2行）を解決
- [ ] 処理するCAマスターCSVの実件数・未解決Community・同名異IDをread-onlyで事前分析し、全件検査が通ると確認
- [ ] 全管理者・Cron・Edge直呼出し経路に専用ゲートOFFを入れ、危険な旧sync-ca-master v4を動かせないこと
- [ ] 専用ゲートfalse先行、Identity複合FKをCASCADE→RESTRICTへ変更、ロックRPC・差分RPC配置、Edge配備の順でレビュー
- [ ] 機能停止した状態で本人紐付けとメダルの同一性を比較
- [ ] 初回の限定同期・自動再開は別々に明示承認する
- [ ] 切替失敗時の復旧担当とロールバック停止条件を再確認

PR #128および依存PRはDraft・未マージを維持。
現在の本番 `last_ca_master_at=2099` は変えない。
