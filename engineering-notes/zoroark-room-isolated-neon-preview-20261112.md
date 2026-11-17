# 🍀 ゾロアーク ルーム作成：隔離Neon接続

状態：実装済・フロント/Backend隔離、公開NG（ゲスト入室なし）。

## 接続先
- Supabase本番は **Authで本人確認＋CAロールを読み取るだけ**。DBへの試験書込・Edgeデプロイは行わない。
- Neonプロジェクト `ca-clover-test` の `ca_clover_test` DBに隔離領域 `zoroark_isolated` を作成済み。
- Vercel Preview (branch `feature/zoroark-room-create-ui-isolated-20261112`) の同一オリジン API `/api/zoroark/rooms` を経由する。
- DBへの接続権限は公開ブラウザでなくVercelサーバー環境変数のみ。接続文字列を `NEXT_PUBLIC_` に入れない。

## 必要なVercel環境設定（Preview／指定ブランチ限定）
1. Vercelの `kaityo1222/ca-clover` プロジェクトに、正しいVercelアカウントでアクセス。
2. Environment Variablesに `ZOROARK_ROOM_CREATE_ENABLED` = `true` を追加。Previewだけで使い、Productionには設定しない。
3. `ZOROARK_NEON_DATABASE_URL` を追加。値はNeon Consoleで **ca-clover-test / ca_clover_test** の接続文字列を取得し、シークレットとして保存。チャットやGitHubに貼らない。
4. 設定後、Previewを再デプロイする。Vercelが自動設定する `VERCEL_ENV=preview` も必須。
5. Chrome / SafariでGMとしてログイン→ルーム作成→ルームIDと招待期限が表示されることを確認。

## 安全ガード
- 上記2変数のどちらかが欠ければHTTP 503と明瞭な未接続メッセージ。
- Productionでは設定が入ってもAPIは503で停止。GitHub PagesにはAPIを載せない。
- リクエストのOriginは接続先と一致必須。サーバーでJWTをSupabase Authに再検証、profile.role ca/adminのみ許可。
- 依存DB名が `ca_clover_test` 以外なら書き込む前に503で停止。SQLパラメータ化、ゲーム招待資格はハッシュのみDB保存。
- 最大3件の同時作成制限はDB関数でadvisory lockを使って原子的に実行。
- 「ルーム作成成功」でもQR入室・一般ゲスト参加は無効（`joinEnabled:false`）。

## 既知の制約
- 現在のChatGPT-Vercel接続はこのVercelプロジェクトに 403 Forbidden。こちらから環境変数を登録できない。
- Neoｎの接続先をGitHub/Vercel公開変数に貼り付けて回避してはいけない。
- Vercel環境変数を設定し、実CAログインから本物のHTTP接続に成功するまでは、本番公開・マージNO-GO。