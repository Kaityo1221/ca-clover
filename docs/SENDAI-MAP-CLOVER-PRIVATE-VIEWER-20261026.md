# 仙台作戦MAP / CA Clover期間限定閲覧

- ステータス: Draft・未本番反映。CA Clover既存機能、DBスキーマ、既存Cronに変更なし。
- 期間: 2026年11月9日 23:59 JSTまで（11月10日00:00でAPI拒否/画面非表示）。
- 対象: profiles.role が admin または ca のログイン済みユーザーのみ。pending/未認証は403/401。
- 方式: CA Cloverのホーム上部でプライベートJSONを認証API経由で取得し、別オリジンのSimulator閲覧専用iframeへpostMessage。送信先/受信元のoriginとsourceを双方で検査。
- Simulatorの元の編集機能は維持。?cloverViewer=1 のときだけ会議再生モードを強制し編集モードへ戻せず、ローカル保存も無効。公開データはCloverからの正規messageでのみ読み込む。
- API: GET /api/sendai-map、Authorization: Bearer <Clover access token>。Supabase Authでトークン照合、DB profiles.roleをサーバーで再検証。レスポンス no-store、個人CA名簿 caRoster を削除。
- 作戦JSONの原本は**非公開**のSupabase Storage bucketに置き、service_roleでサーバーのみから取得する。公開Bucket/リポジトリ/publicには置かない。署名付きURLも渡さない。
- 環境変数 (CA Clover、サーバーのみ): SENDAI_MAP_PRIVATE_BUCKET, SENDAI_MAP_PRIVATE_OBJECT。既存のNEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEYを利用。キーを新規公開しない。
- 受入前にSimulatorのJSON保存からエクスポートした作戦データを確認し、CA名簿、連絡先、内部運営メモなどを削除した公開専用JSONを作成し、私有bucketへアップロード。保存後にAPIが200になることをADMIN/CAで確認する。
- 非公開Bucketの storage.objects を anon / authenticated が直接 SELECTできるポリシーは付けない。Bucketのpublicはfalse。
- 安全審査: 未ログイン401、pending403、admin/ca200、期限超過410、URL直打ちで漏れなし、クロスオリジン不正message拒否、ブラウザ再生、現行Clover動作不変。
- 競合作業: CA Clover/Backend Phase E進行中につきDraft PRのみ。mainマージ・本番反映・Supabase本番バケット作成は別途安全審査後。
