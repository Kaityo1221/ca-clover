# 通常CA登録 工程②：隔離接続候補（2026-11-14）

**DRAFT / NO-GO。実Google・Discord認証は未完了。** Frontend #293/#294 と Backend #73/#74 を継承。ジャック氏の別ロールは対象外。

## 今回の実装

- 対象 `feature/claim-discord-apac-ui-isolated-20261114` の Vercel Preview だけ、login/account/my から本番Pagesへの転送を停止。同じOriginに戻す。
- 環境種別はVercelのビルド情報から公開値を生成。共有された公開変数の `production` 表示を信用しない。
- ブラウザーとサーバーの両方で専用Supabase refを必須化し、URL・ref・鍵の種類を検査。本番と別用途Campsiteのプロジェクト、任意ホスト、URL内の認証情報・パス・クエリを拒否。
- サーバーとブラウザーの隔離refを一致させる。legacy JWT鍵のproject ref / roleも検査。新形式のopaque鍵はproject refを復号できないため、実接続確認が別途必要。
- このPreviewだけNextの `/api/*` を503で停止。登録は専用Supabaseを直接使い、既存の別機能の接続fallbackに到達させない。
- Discord callbackへno-referrer/no-storeを設定。Vercelの認証保護は変更しない。

## 接続調査

既存OAuth LabはNeon Authを使用し、通常CA登録が必要とするSupabase `auth.sessions` は存在しない。既存NeonのUUID/認証結果をSupabaseの本人証明へ流用しない。旧Labの所有者資格情報の交換待ちは、この実装で解消したとは扱わない。

`ca-clover` のSupabase URL・公開鍵・サービスキーはProduction/Preview共通であり、対象ブランチ専用の隔離設定はない。`ca-clover-preview` にも隔離Supabase設定はない。アクセス可能なSupabaseは本番と別用途Campsiteの2件で、今回の登録QAに使わない。

既存callbackは接続済みVercelツールの認証付き取得では200だった。共有用アクセスの取得成功は、一般テスターのDiscordコールバック成功の証明ではない。保護を弱めず、同じブラウザーで認証→Discord→callbackの継続を別途確認する。

## 検証と残課題

接続拒否・クライアント生成前停止・対象Previewだけの同一Originルート・API遮断を50件以上の合成検査で確認。Backendの申請/承認APIも接続作成前に専用projectを強制する。実認証PASSへの読み替え禁止。

専用の無料Supabase Auth/DB/Edgeが確保され、両方のref・URL・鍵・Google redirect・Discord redirectが一致するまで実アカウントによるログインを行わない。新規有料リソース、既存DBへのSQL、Edge/Cron/Pages/本番Vercel設定変更、マージ、本番デプロイ、既存Docker操作は行っていない。

Backend候補の `scripts/claim-isolated-preflight.mjs` は環境変数から接続を検査し、`--live` 指定時だけ読み取りプローブを行う。設定不足はBLOCKED、危険な接続はFAILで通信前に停止。service key / Discord secretの送信やOAuth code交換は行わない。接続検査PASSでも実OAuthは未試験と表示する。

必要なPreview専用変数：`NEXT_PUBLIC_CA_CLOVER_ISOLATED_SUPABASE_REF` と `CA_CLOVER_ISOLATED_SUPABASE_REF`、専用の `NEXT_PUBLIC_SUPABASE_URL` / 公開鍵 / `SUPABASE_SERVICE_ROLE_KEY`。値を本番共通変数へ書き込まない。これらの設定はまだ行っていない。
