# ゾロアークお題カタログ隔離開発（2026-11-15）
状態：**NO-GO・隔離PRのみ・SQL未適用**

## 現状
- GitHub Pagesのお題メモは iPhone の localStorage。採用候補でも本番ゲームに反映されない。
- 正式出題は Next.js の `PAIRS` 42組。これはそのまま保持する。
- 新候補は `a,b,common,difference,level` が必須。足りない古いメモを無検証で公開しない。

## 隔離実装
- `GET/POST /api/zoroark/catalog` は **ADMIN実JWT + 現在のprofiles.role=admin** を要求。
- APIは `ZOROARK_CATALOG_MANAGEMENT_ENABLED=true` かつ **Vercel Preview** のみ利用可能。
- 申請 → 承認 → 公開（独立フラグ `ZOROARK_CATALOG_PUBLISH_ENABLED`）→ 停止（retire）の順。
- 状態はサーバーDBを正本にする。公開操作だけではなく、ゲームの実読取フラグもONで初めて `activeInGame=true`。
- `POST /api/zoroark/round` は `ZOROARK_CATALOG_RUNTIME_ENABLED=true` をPreviewで明示設定した場合だけ、正式42組に公開候補を追加。読取エラー時は出題せず fail closed。
- 本番は無条件に従来の42組（機能フラグがPreview環境に限定）。
- ログにJWTやお題を残さず、公開済み候補のみCAが閲覧可能。全候補はADMINに限定。

## 重要な未実施事項
1. 未適用SQLは **非公開Backend PR #84** の隔離候補フォルダにのみ保存。公開FrontendにはSQLを置かない。実DBへの適用、権限変更、Vercel環境変数変更、マージ／公開は禁止。
2. PreviewでSupabase隔離Auth/RLS、実HTTP、失効・権限変更、原子監査ログ、同時公開競合、重複の実試験を完了する。
3. UIには不足している「違い」「難易度」入力、サーバー登録、版番号と反映状態表示が必要。別の隔離Pages PRで連携する。
4. iPhone内の既存8件はAPIに存在しない。必要ならご本人の端末から限定的な移管操作が必要。
5. 本番GOは画面・バックエンド・SQL・設定を別々に確認してから明示承認する。

**事前に許可されていない本番DB、Neon、Supabase、Vercel、本番GitHub Pagesには一切書き込まない。**
