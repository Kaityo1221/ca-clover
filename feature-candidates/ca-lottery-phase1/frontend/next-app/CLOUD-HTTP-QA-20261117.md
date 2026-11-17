# CA Lottery Next.js 隔離クラウドHTTP試験（2026-11-17）

- Frontend branch: `feature/ca-lottery-draw-isolated-20261117` (Draft PR #324; Phase1 PR #321の403ガード修正を継承)
- **実Next.js dev server / localhost限定 / 模擬API**で、UI表示、正規Originの`POST /api/rooms`転送、Cookie転送、`POST /api/login`転送、不正Originの403、不正Hostの403を確認：**6/6 PASS**。
- `node --test route-guard.test.mjs` も6/6 PASS。
- 不正Hostの検証はNode HTTPクライアントの生リクエストを使った（Node fetchのHostヘッダー上書きを避けるため）。
- 抽選Backend側は別の使い捨てクラウドPostgreSQLで単体2/2、実DB 6/6 PASS。
- このNext試験の転送先は**模擬API**であり、実GoTrue、実CA認証、参加証Cookieの実バックエンド保存、iPhone HTTPS QR・復帰・CA名簿更新・URLコピーは**未実施**。
- 工程①・②：**PARTIAL**、本番**NO-GO**、PRマージ禁止。本番・本番DB・GitHub Pagesに変更なし。
