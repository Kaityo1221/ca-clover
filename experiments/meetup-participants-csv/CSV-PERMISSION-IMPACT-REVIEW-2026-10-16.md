# CSV_EXPORT 付与・解除：影響範囲調査（読み取り専用）

調査日: 2026-10-16 JST
対象: `Kaityo1221/ca-clover` / `main` commit `36c04fd3ccbc58c4398c09c39cdb9c8f30e59ba7`
試作ブランチ: `feature/meetup-csv-safe-20261016` / Draft PR #150
判定: **設計・模擬試作は継続可。実権限更新、実名簿取得、監査保存は高リスク領域のためSTOP / 個別GO待ち。**

## Phase Eの厳格保全

`AGENTS.md` と `docs/PHASE-E-FREEZE-AND-DEV-GUARD-2026-10-16.md` を確認。
STEP 45で **Phase E = PAUSED / STOP_UNPROVEN**。総合PASSではない。
バックアップ、証拠、復元SQL、隔離Docker、本番Supabase、CAマスター保護、Cron、pg_net、Storage、シークレットには触れない。
この調査は公開GitHubリポジトリの`main`にあるコードの**読み取りのみ**。書込みはこの試作フォルダ内の設計記録だけ。

## 既存実装で確認できたこと

### 1. `user_permissions` には新権限コードを保存できる形式がある

`supabase/migrations/20260921210000_stamp_rally_permissions_and_collection.sql`

- `user_id` + `permission_code` が複合PK。権限はアカウント単位。
- `permission_code` は `^[A-Z][A-Z0-9_]{0,31}$` 形式。**`CSV_EXPORT` は適合**。既存SQL定義の形式制約を変更する必要は見当たらない。
- `granted_at` / `granted_by` カラムがある。存在する権限の付与者・付与日時は保持できる。ただし取り消しで行を削除するとこの情報は残らない。
- RLSは有効。本人/ADMINに対してSELECTのみ。anon/authenticatedには全権限剥奪後にSELECTだけGRANT。実際の付与はサービスロールを使う既存ADMIN Edge関数で行う設計。
- `private.has_permission(p_permission_code)` は存在するが、CSV出力には**認証済み本人の現在の権限+Community所属**のサーバー側照合が別途必要。
- これは**リポジトリ内マイグレーションの静的確認**であり、本番DBのスキーマ・RLS適用状況は未照合。本番SQL実行は禁止されたまま。

### 2. ADMIN管理APIはS権限のみ許可している

`supabase/functions/admin-manage/index.ts`

- `action=set_permission` はADMINロールを本人認証した後、`permissionCode!=="S"` で拒否する。
- 権限ONはサービスロールの`user_permissions.upsert`、OFFは`delete`。行ごとに`granted_at`, `granted_by`を保持。
- `pending`への付与禁止は現時点ではS権限に限った設計メッセージ。
- `action=set_role` で`pending`へ戻した際、**S権限だけ削除する**。実装前に`CSV_EXPORT`も削除できるようにする必要がある。
- **高リスク・STOP**: 改修には`supabase/functions/admin-manage/index.ts`の変更・Edge配備レビューが必要。既存S機能・承認処理の回帰検査が必須。

### 3. ADMINのユーザー一覧は既存UIを流用可能

`src/app/admin/accounts/page.tsx`

- `profiles`を取得、`user_permissions`で`S`権限のあるユーザー集合を取得。
- Sの切替は`supabase.functions.invoke("admin-manage",{ action:"set_permission" })`を利用。
- 同じ画面に **CSV権限ボタン** を追加するだけで、独立した管理メニューは不要。
- `CSV_EXPORT` 用ユーザー集合を別管理。Sを触らずにON/OFFできる仕様とする。
- 通信失敗時は成功表示を出さず、再取得で状態を照合。付与・解除にADMIN検証が必須。

### 4. 既存の認証フックを再利用できる可能性

`src/lib/use-auth-profile.ts`

- 既に本人の`user_permissions.permission_code`一覧を取得している。
- `hasPermission(code)`を提供し、ロールがADMINなら真と判断する。
- **フック変更なしで** `hasPermission("CSV_EXPORT")` を画面表示条件に使える見込み。ただしロード中・権限取得失敗時は必ず非表示。
- **注意**: クライアントUIのボタン表示だけでは機密データの取得許可にはならない。実APIで再検証必須。

### 5. Community所属とMeetupの対応関係は既存DBを参照できる

`supabase/schema.sql` / `src/app/community/[id]/page.tsx`

- `community_memberships(user_id,community_id)`は本人のCommunity割り当て。
- `meetups.id`、`meetups.community_id`で対象MeetupとCommunityをサーバーで照合できる設計。
- Meetup一覧は既存のRLSを通じた閲覧だが、**参加者名簿のCSV権限判定は別契約**。
- CAは追加`CSV_EXPORT`権限と、自分の所属Communityの両方が必要。ADMINは本人の管理者ロールの検証を必須とする。
- `src/app/community/[id]/page.tsx`改修は本番UIへの影響があるため個別レビューが必要。既存詳細モーダル、期間切替、アクティビティ表示は維持する。

## 本番化で触る必要がある箇所の候補と停止判断

| ファイル・領域 | 予定変更 | 区分 |
|---|---|---|
| `src/app/admin/accounts/page.tsx` | 既存Sとは別のCSV権限ON/OFF | 既存画面の改修。UI回帰レビュー |
| `src/app/community/[id]/page.tsx` | 権限ON+Community所属に限りCSVボタン表示 | 既存画面の改修。UI回帰レビュー |
| `src/lib/use-auth-profile.ts` | **原則変更不要**。既存`hasPermission`を利用 | 認証変更を避ける |
| `supabase/functions/admin-manage/index.ts` | `CSV_EXPORT`を許可リストへ追加。pending移行時の解除も拡張 | **STOP / Edge事前GO** |
| `user_permissions` | 既存テーブル・形式制約を利用できる見込み | **新権限コード用のDB変更は不要の可能性が高い**。実配備未検証 |
| 新規CSV出力API | サーバー本人認証、CSV権限、所属Community、用途、監査記録、完全取得、CSV返却 | **STOP / API・Campfire個別GO** |
| 新規出力監査テーブル・RLS | 出力者、対象Meetup、目的、日時、件数、状態を記録 | **STOP / DB・RLS個別GO** |
| 既存 `S`権限、Cron、CAマスター同期、Campfire既存取得処理 | **変更しない** | 保全対象 |
| Phase E成果物・バックアップ・Docker等 | **一切操作しない** | 絶対保全 |

## 実装後に必要な回帰テスト（計画のみ）

1. CSV未付与CAにはCSVボタンが現れない。URL直打ちやAPI直呼びでも403。
2. 権限付与されたCAは本人のCommunity内のみ。別CommunityのmeetupIdを偽装しても403。
3. ADMINがCSV権限を付与・解除しても既存S権限には変化なし。
4. 権限解除後、開いている古い画面から出力要求してもサーバーが拒否する。
5. アカウントを`pending`に戻した後はCSV権限を利用できない。
6. 目的未申告・「その他」の補足空欄・同意なしでは生成禁止。
7. 監査ログ作成失敗・状態記録失敗・Campfire部分取得・通信失敗ではCSV返却禁止。
8. 監査ログには参加者username、参加者ID一覧、トークン、CSV本文を保存しない。
9. iPhone Safariで管理画面とMy CommunityのUI崩れなし。既存のMeetup詳細/Stamp Rallyを回帰検査。

## 次のPO承認ゲート

1. **ADMIN管理API**: 既存`admin-manage`に`CSV_EXPORT`だけを追加し、pending復帰時の解除を拡張してよいか。
2. **本番監査ログ**: 新規監査テーブルと必要最小限のRLS/サーバー保存APIを別作業で作ってよいか。
3. **実Campfire取得**: 明細APIと利用条件・全件性を調査してよいか（実通信に触れる前に別途GO）。

いずれも保護領域。これらのGOが出ても、**mainへのマージと本番デプロイは別途明示GO**が必要。DBやEdgeを試す場合も本番環境とPhase Eの隔離環境は使わない。
