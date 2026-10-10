# CA Clover リリース候補 #128 / 85%到達点の検証記録
2026-10-10 20:00 JST / Draftのみ、正式本番適用は **STOP**

## 目的
実稼働中の先行公開6アカウント・本人Identity6件・メダル13枚を保護するために、
実メダルのデザイン記録、CAマスターの書込途中停止、閲覧権限を追加検証。

## 今回追加した実テストと結果
| 区分 | テスト実体 | 確認内容 |
|---|---|---|
| 本番由来デザインSQL | `supabase/review/qa-production-medal-design-functions.review.sql` | 本番からread-only取得した `stamp_prepare_collection_design`, `stamp_grant_acquisition_design`, `stamp_auto_own_medal_after_role` を使い捨てDBで実行 |
| メダルDB結合 | `scripts/ci/unlisted-ca-medal-rpc-postgres.sql` | CA承認→自拠点メダル→取得アイコンの固定→新アイコンが公開されても旧取得デザイン保持。下流デザインINSERTを意図的に失敗させ、全承認更新がロールバックされること |
| Edge失敗注入 | `scripts/test-ca-master-failure-injection.mjs` | 停止成功、監査SQLエラー、監査通信例外、ロック所有者不一致、停止SQLエラー、停止通信例外の6ケース。停止を確認できなければ実行ロックを保持 |
| RLSアクセス隔離 | `scripts/ci/release-candidate-rls-postgres.sql` | 本番で読み取った `private.is_admin` と3つのRLS SELECTポリシー式を、合成CA2名＋管理者1名で試験。一般CAは自分のIdentity・メダルのみ、同期状態不可。匿名は閲覧権限なし。管理者のみ全件閲覧 |
| 依存統合 | `scripts/test-release-candidate-contract.mjs` | アイコン同期/申請通知/CAマスター停止/排他/未掲載CA手動資格承認/メダルの契約条件 |
| 型/ビルド | `.github/workflows/ci.yml` | Deno Edge4本の型チェックと通常ビルド |

**確認済みGitHub Actions**:
- Disposable PostgreSQL `Release candidate / Master + Medal PostgreSQL QA` run **#38046814105 PASS** (追加4区分含む)。
- `CI` run **#38046814103 PASS**（Deno、Nodeテスト、ビルドすべて成功）。

全SQLは匿名の合成UUIDを使う使い捨てPostgreSQL環境で `BEGIN; … ROLLBACK`。
Supabase本番プロジェクトにDB更新・同期・Edge deployなし。

## 本番データのread-only確認
- `public.sync_automation_state.enabled = true`（通常Campfire Cronは継続）
- `last_ca_master_at = 2099-01-01`（CAマスター自動同期は緊急停止）
- profiles **6**, memberships **6**, primary identities **6**, medals **13**,
  orphan_identity_links **0**。
- 本番のIdentity複合FKはなお `ON DELETE CASCADE`（**本番適用前の重大STOP**）。
- 本番に専用 `ca_master_sync_enabled` とlease列、レビュー用各RPCは未導入。
- 本番SQL read-onlyの確認だけで「本番と完全同じ」という意味ではない。

## 85%は計画上の概算。残る本番GOの条件
1. 独立バックアップ（個別IDレベルで比較できる復元可能な記録）。秘密・本人情報をpublic GitHubへ出さない。
2. 本番相当のDB全面スキーマ（制約、RLS、メダルデザイントリガー、関数）で実権限による統合リハーサル。
3. 実Supabase Edge→PostgREST の**複数HTTPリクエストをまたぐ部分書込失敗**のE2E試験。今回のNode障害注入は単体モックであり、完全な実通信試験ではない。
4. すべての管理者/自動Cron/Edge直呼び経路が専用ゲートOFFで遮断されること。
5. 統合PRの差分と、稼働中 `sync-campfire-auto` v10, `community-claim` v14が正確に保存されていることの再レビュー。
6. FK `ON DELETE RESTRICT` とゲートOFF先行、RPC、Edge順に慎重な切替。終了後に本人紐付けとメダルの個別ID差分を照合。
7. 正式本番適用の**ユーザーによる明示承認**。一括マージ・自動再開禁止。旧Edge v4を再デプロイしない。

### 判定
- **統合無料QA：PASS**
- **本番の本人情報・メダルの保全：read-only件数確認PASS**
- **完全な本番相当E2E：未完了**
- **本番デプロイ：STOP**。PR #128はDraftを維持。
