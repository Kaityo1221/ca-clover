# CA Clover｜CAマスター同期 安全復旧・本番適用手順（レビュー案）
**2026-10-10 / PR #119 → #120 → #121 → #127 + #118**  
**現在の判定：本番適用 STOP。承認のないデプロイ・本番SQL実行・手動同期は禁止。**

## 0. 保護したいもの
- `public.user_ca_identities` の本人紐付け・主担当フラグ。
- `public.community_memberships` の登録先。
- `public.stamp_collections` の既得メダルと取得デザイン。
- `public.community_ca_members` の本人紐付け対象となる複合キー。
- `sync-campfire-auto` 本番v10の Community アイコン同期・申請通知・通常15分Cron。

現時点の本番仮停止：`sync_automation_state.id=1.last_ca_master_at='2099-01-01T00:00:00Z'`。自動CAマスター実行だけを抑止しており、**手動ADMIN経路の安全性は保証しない**。通常Cronの `enabled=true` は維持する。

## 1. 未マージPRの依存関係
- [#119](https://github.com/Kaityo1221/ca-clover/pull/119)：本番稼働 `sync-campfire-auto` v10の**完全ソース保存**（元のpagesコードでは本番に存在するアイコン同期・申請通知が欠けていた）。
- [#120](https://github.com/Kaityo1221/ca-clover/pull/120)：CAマスター専用の `ca_master_sync_enabled` スイッチと手動/自動/API本体の閉鎖。
- [#121](https://github.com/Kaityo1221/ca-clover/pull/121)：Identityを消さない差分同期＋リンク原子更新RPC＋無料DB検証。
- [#127](https://github.com/Kaityo1221/ca-clover/pull/127)：10分期限付き排他ロック、**ロック失効時に自動再開しない**、途中失敗時の専用同期停止・監査。
- [#118](https://github.com/Kaityo1221/ca-clover/pull/118)：CA地図未掲載者のADMIN資格確認後、実トリガーで自拠点メダル発行。別系列の #116 に依存。#117は #121 へ取り込んだ元案で**単独適用しない**。

※ 各PRは現在Draftである前提。適用直前に差分、依存する基底ブランチ、実機状況、Edge本番版を再照合する。

## 2. 本番前に必要な証拠
1. 無料PostgreSQLで専用OFFゲート・FK RESTRICT・リンク更新の一括ロールバック・期限切れの自動停止をPASS。
2. Deno型チェック・通常ビルドをPASS。
3. 仮データ上で事故復旧を確認。**実際の本番と同じDDL・RLS・デザイントリガーでの全面検証は別途必要**。
4. CAマスターCSVに欠損/重複ID/解決不能Communityが含まれる場合の破壊的更新がないことを確認。
5. 複数PostgREST呼出しをまたぐメタデータ更新の「途中失敗」は今も**原子的ではない**。停止後にADMINが差分を確認して修復する手順を承認。
6. 全承認経路、手動同期ボタン、Cron direct/API経路が閉じられることを確認。
7. ユーザーの**本番適用への明示承認**。

## 3. 本番リリース直前：読み取り専用スナップショット
**公開GitHubへ個人情報を保存しない。** 管理用の非公開保存先に、少なくとも次を復元可能な形式で確保する：
- `profiles`、`community_memberships`、`user_ca_identities`、`stamp_collections`、`community_ca_members`、`ca_members`、`communities`、`community_campfire_ids`。
- Primary Identityと自拠点メダルの**個別IDペア**。単純な件数一致だけでは本人入れ替わりを発見できない。
- 実稼働する全対象Edge Functionのバージョン/ソース、Cron定義/最終状態、DB関数/トリガー/FK定義。
- 最初の本番同期前後で、削除された本人紐付け・既存メダル・Community membership = **すべて0件**を確認。

確認用SQLは **SELECTのみ**：
```sql
select enabled,last_ca_master_at
  from public.sync_automation_state where id=1;

select count(*) as identities,
       count(*) filter(where is_primary) as primaries
  from public.user_ca_identities;
select count(*) as medals from public.stamp_collections;
select count(*) as memberships from public.community_memberships;
select count(*) as ca_links from public.community_ca_members;

select count(*) as orphan_identities
from public.user_ca_identities i
left join public.community_ca_members l
  on l.community_id=i.community_id and l.ca_member_id=i.ca_member_id
where l.id is null;
```

## 4. 承認後のみ：本番投入の順番
**4A. 保護ゲートを先に準備。** 仮停止2099を残し、`sync_automation_state.ca_master_sync_enabled boolean NOT NULL DEFAULT false` を追加して**OFFを確認**。通常Cron `enabled` は変えない。

**4B. FKの連鎖削除を塞ぐ。** `user_ca_identities(community_id,ca_member_id)` の FK `ON DELETE CASCADE` を `ON DELETE RESTRICT` に変更。既存ユーザーを消す方向のロールバックは厳禁。各外部キーの関連処理が正常か事前点検。

**4C. 保護用RPCを投入。** `internal_begin_ca_master_lease` / `internal_check_ca_master_lease` / `internal_finish_ca_master_lease` と `internal_reconcile_ca_master_links` を**サービスロールのみ**へ許可。リンク更新RPCはCAマスター専用フラグ・所有者・FK安全性を毎回検証。

**4D. Edgeを順序・依存関係を確認しながら投入。** まず `sync-ca-master` / `sync-ca-master-admin` の停止ゲートを確認して手動・直接呼出しを遮断。 `sync-campfire-auto` は**本番v10を基準にした保存版**へゲートだけ追加（アイコン同期と申請通知を消さない）。全Edgeのソースハッシュと設定を記録。

**4E. 閉鎖状態で確認。** ゲートOFFのまま、認証済みリクエストが423/409（停止・実行中）に到達する設計を確認し、DBへの書き込み・CAマスター取得がないことを保証。誤って実際の同期を開始しない。

**4F. 最終承認後に限定的な初回同期。** マスターの欠損/衝突をread-onlyで確認し、ADMINが明示的に専用ゲートONを承認したときに**一度だけ**実行。正常/部分/失敗と監査ログを照合し、Identity・メダル・紐付けのスナップショット差分を検査。確認までCron側の仮停止2099を維持する。

**4G. 自動同期の復帰。** 初回同期が正常かつ無破壊で、CA/Community差分を確認した後、**別途承認を得て**2099仮停止の取扱いを確定。旧v4 Edgeへ戻すのは危険。

## 5. 異常終了・部分失敗の復旧
- Edgeがエラーを捕捉し、メタデータ書込を始めていた場合：CAマスター専用フラグOFF + `sync_runs` の `CA_MASTER_WRITE_INTERRUPTED` 監査。**所有者確認できない場合はロックを残す**。
- Edgeプロセス自体が終了した場合：ロックは残る。次の起動時、10分を超えて失効していればDB側が**専用フラグをOFFに変更して拒否する**。勝手に次の同期を走らせない。
- 通常のMeetup/Communityアイコン収集は継続する。
- 管理者は監査ログ、同期前スナップショット、現在のIdentity、link/Community/CA情報を比較し、部分更新を特定。危険な個別DELETEやIdentityの再発行は禁止。
- 監査・照合・修復にPASSし、別途承認された後にのみ、**失効ロックを手動リセットして専用ゲートを再開**する。
- エラー時は安全停止を維持する。ロールバックのために旧 `sync-ca-master` v4やCASCADE FKに戻さない。

## 6. 確認後のメダル機能
#118を本番統合する際は、ADMINの資格確認・本人主催Meetup・Scopely ID一致を必須とし、既存の自拠点メダル取得権を再発行しない。無料QAは実 `stamp_ensure_own_medal` 関数まで確認済。ただし、デザイントリガー・実RLS・実Campfire連携は別途検証。10/16以降の対人QR交換試験は分離。

### 最終判定表
- **無料DB/CI PASS**：コードの構文、模擬トランザクション、個別安全条件。
- **本番適用 GO**：本番相当DDL/RLS/失敗試験、復旧計画、バックアップ、独立レビュー、ユーザー明示承認がそろった場合のみ。
- **それ以外**：Draft保持・自動同期停止・本番データ維持。
