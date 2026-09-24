# SuzukiPM限定演出 実機エラー記録 / iOS Safari再発防止ノート

記録日: 2026-09-24
対象: CA Clover / GitHub Pages版 `pages`
基準実装: `720c718411eabda112833af0b3bbc07433bd48e5`

## 目的

SuzukiPM限定「龍の儀式＋焼き印」演出の実機調整で発生した不具合を、将来のCA Clover・Webアプリ・iPhone向け演出実装へ再利用できる形で残す。

この演出はSuzukiPMだけに限定し、通常CAへ副作用を出さないことを前提とする。

---

## 最終完成フロー

龍盾
→ 台詞
→ 1回目タップ: 遠い足音
→ 2回目タップ: 近い足音
→ 3回目タップ: 龍の咆哮
→ 全面炎 + 炎音
→ 焼き印
→ 焦げた公式3Dメダル
→ 「煤をお掃除」
→ ブラシ演出
→ 通常の公式3Dメダル

---

## 発生したエラーと原因・対策

### 1. 龍の紋章が最初に表示されない

症状:
- 初回の儀式開始時に正式な龍盾画像が出ない。
- 2回目以降は表示されるケースがあった。

原因候補:
- 画像の読み込みタイミングとDOM生成タイミングが競合。
- キャッシュ済み時と未キャッシュ時で挙動が変わる。

対策:
- SuzukiPM演出開始時のみ正式画像を読み込む。
- `load` / `error` を明示的に監視。
- `img.complete` と `naturalWidth` も確認し、キャッシュ済み画像にも対応。
- 読み込み失敗時のみフォールバックを出す。

再発防止ルール:
- 大きめ画像は「DOMを作ったら勝手に出る」前提にしない。
- `load / error / complete` の3経路を用意する。

---

### 2. 炎動画が見えない / 表示が弱い

症状:
- 動画ファイル自体は存在するが実機で見えない、または小さく見える。

原因:
- iPhone Safariの動画再生条件とレイアウトの組み合わせ。
- 横長動画を縦画面へそのまま置いていた。

対策:
- `muted`, `defaultMuted`, `playsInline`, `autoplay`, `loop` を明示。
- `load()` と `canplay` 後の `play()` を併用。
- `object-fit: cover` で全面表示。
- `src` を破棄する終了処理を追加。

再発防止ルール:
- Safariの動画は「autoplay属性だけ」で信用しない。
- 再生開始と終了処理をコードで管理する。

---

### 3. Safariで「問題が繰り返し起きました」が出る

症状:
- 演出を繰り返すとSafariタブが落ちる。

問題になった実装:
- `String.prototype.toLowerCase` のような標準Prototypeへのモンキーパッチ。
- ページ全体を監視する広すぎるMutationObserver。
- cleanup時に別UIを擬似クリックする処理。
- disabled状態の既存ボタンを強制的に再有効化する処理。
- 追加の偽メダル、偽煤レイヤー、余分なWebGL演出。
- media / timer / animation / overlayの解放不足。

対策:
- SuzukiPM処理を独立した状態機械へ分離。
- `idle / burned / cleaning / clean_complete` を明示。
- timeout, RAF, Web Animations, overlay, video, audioを終了時に必ず解放。
- 公式3Dメダルだけを使い、偽メダル・偽煤を廃止。
- renderer bridgeで必要部分だけ再描画。

再発防止ルール:
- グローバルPrototypeは変更しない。
- UIを直すために「別ボタンを勝手にクリック」しない。
- 一時演出は必ず `start / stop / reset` のライフサイクルを持たせる。
- iPhone SafariではGPU・WebGL・動画・音声を積みっぱなしにしない。

---

### 4. 足音は鳴るが咆哮が鳴らない

症状:
- 1回目・2回目の足音は鳴る。
- 3回目タップの咆哮だけ鳴らない。

原因:
- HTML AudioではSafariのユーザー操作制限に引っかかるケースがある。
- 咆哮再生時にユーザー操作との紐付きが弱くなっていた。

対策:
- 咆哮だけpersistent Web Audio方式へ変更。
- SuzukiPM演出開始時にAudioContextを準備。
- MP3をfetch → decodeAudioDataで事前デコード。
- 3回目タップ時にBufferSourceを生成して再生。

再発防止ルール:
- 重要な効果音はiOS Safariで「HTML Audioが鳴ったから全部鳴る」と考えない。
- ユーザー操作直後に確実に鳴らしたい音はWeb Audioを優先する。

---

### 5. 連打すると咆哮が出ないまま炎へ進む

症状:
- 3回を高速でタップすると、咆哮が再生される前に炎演出へ進む。

原因:
- 「3回目タップから500ms後に炎」という固定タイマーだった。
- 咆哮のバッファ準備完了を待たずに次フェーズへ遷移していた。

対策:
- `roar_wait` フェーズを追加。
- 咆哮が実際に再生開始したことを確認してから `roar` へ遷移。
- その後700ms経過してから炎へ進む。
- 咆哮開始に失敗した場合は `tap_wait` に戻し、3回目だけやり直せるようにした。

再発防止ルール:
- 音声・動画・通信など非同期処理を「固定時間」で次工程につながない。
- 実際の成功イベントをゲートにする。

---

### 6. 龍盾が出た直後に連打するとSafariがズームする

症状:
- 3回タップ受付開始前に連打すると、iPhone Safariのダブルタップズームが発動。

原因:
- `tap_wait` 以前はタッチイベントを飲み込んでいなかった。
- Safariのブラウザジェスチャーが生きていた。

対策:
- SuzukiPM演出の全画面rootに `touch-action:none`。
- `touchstart / touchmove / touchend` を `passive:false` で制御。
- `gesturestart / gesturechange / gestureend` もpreventDefault。
- 受付前のタップは完全に破棄。
- `tap_wait` の時だけ `ritualTap()` を実行。
- clickとの二重発火も時間ガードで防止。

再発防止ルール:
- フルスクリーン演出ではブラウザ標準ジェスチャーを先に設計する。
- 「まだ操作を受け付けない時間」も入力を明示的に処理する。

---

### 7. 炎音が咆哮に埋もれて目立たない

症状:
- 炎音自体は鳴っているが、咆哮の余韻に埋もれる。

原因:
- 単純なgainだけで再生していた。
- 炎素材の中低域と存在感が弱かった。

対策:
- 炎音専用のWeb Audioチェーンを追加。
- lowshelfで低域を増強。
- peaking EQで存在感を追加。
- lowpassで高域を整理。
- compressorで密度を上げる。
- 立ち上がりだけ短く強調するgain envelopeを追加。

再発防止ルール:
- 複数効果音を重ねる場合は単純な音量調整だけでなく、周波数帯と時間軸を分ける。

---

### 8. 1周目は咆哮が鳴るが2周目以降は鳴らない

症状:
- 1回目の演出は正常。
- モーダルを閉じて2回目の儀式を始めると咆哮が消える。

原因:
- iOS SafariでAudioContextが再生後に `suspended / interrupted` 相当になることがある。
- `suspended` の時だけresumeする設計では不十分。
- Promise経由で再生開始すると、ユーザー操作との結び付きが弱くなるケースがある。
- AudioContextを作り直した場合、古いAudioBufferをそのまま扱わない方が安全。

対策:
- `state !== "running"` なら毎回resumeを試す。
- 1回目・2回目のタップでもAudioContextを再アンロック。
- 3回目タップ時、バッファ準備済みならPromiseを挟まず同期的にBufferSourceを開始。
- AudioContextを作り直した時はroar/fire bufferを破棄して再デコード。

再発防止ルール:
- iOS SafariのAudioContextは「一度runningになったから以後もrunning」と考えない。
- 2周目・3周目テストを必須にする。

---

### 9. cleanup後の状態漏れ / 再オープン問題

想定リスク:
- お掃除完了後の状態が次回も残る。
- SuzukiPM → 通常CA → SuzukiPMで状態が混ざる。

対策:
- モーダルclose時にSuzuki専用stateを `idle` に戻す。
- 通常CAではSuzuki burn処理を常にfalse。
- rendererへ渡すburn状態を明示的なoptionにする。

再発防止ルール:
- 見た目から状態を推測しない。
- `phase` やbooleanを単一ソースとして管理する。

---

### 10. 2回目以降に音が出なくなる初期問題

症状:
- 初回は音が鳴るが、再実行時に音が消える。

原因:
- audio element / source / contextの再利用と解放のバランスが不安定。

対策:
- HTML Audioを使う足音は毎回currentTimeを0へ戻す。
- 終了時はpause、src解除、loadで解放。
- Web AudioはSourceNodeを毎回新規作成。
- AudioBufferだけ再利用し、Contextが変わったら再デコード。

再発防止ルール:
- AudioBufferSourceNodeは一度しかstartできない。
- 「再生オブジェクト」と「デコード済みデータ」を分けて管理する。

---

## 今回廃止して正解だったもの

- fake soot overlay
- fake medal
- SuzukiPM用に追加する余計なWebGL
- `String.prototype` の書き換え
- ページ全体MutationObserver
- cleanup時の擬似クリック
- disabledボタンの強制再有効化
- テキスト内容からburn状態を推測する処理

---

## iPhone Safari向けメディア演出チェックリスト

実装前:
- [ ] 音声はHTML AudioかWeb Audioかを用途別に決める
- [ ] ユーザー操作が必要な再生ポイントを洗い出す
- [ ] 2周目・3周目も再生する設計にする
- [ ] 動画に `muted / playsinline / autoplay` を明示
- [ ] 全画面演出のズーム・スクロール・ジェスチャー方針を決める

実装中:
- [ ] 非同期処理を固定タイマーだけで次フェーズへつながない
- [ ] `phase` を明示して二重実行を防ぐ
- [ ] audio/video/source/timer/RAF/animationを停止できる関数を用意
- [ ] 通常ユーザーへの分岐を最上流で切る
- [ ] 大きい画像・動画・音声は対象ユーザーだけ読み込む

実機テスト:
- [ ] 初回
- [ ] 2周目
- [ ] 3周目
- [ ] 高速連打
- [ ] 演出途中で閉じる
- [ ] background → foreground復帰
- [ ] 通常CA → SuzukiPM → 通常CA
- [ ] Safariズーム発生なし
- [ ] 音が欠けない
- [ ] 「問題が繰り返し起きました」が出ない

---

## 今後の開発での共通方針

1. iPhone Safariでは、見た目より先にresource lifecycleを設計する。
2. 音声は「初回だけ成功」では合格にしない。
3. タップ・ダブルタップ・ピンチ・スクロールを含めて入力設計する。
4. 状態遷移はDOMや文字列から推測せず、明示的なstate machineで管理する。
5. 一時限定演出は通常機能から完全分離し、後から削除できる形にする。
6. 既存公式UIや公式3Dモデルを優先し、偽物のレイヤーを足して解決しない。
7. 実機で問題が出た時は、機能をまとめて追加せず1要素ずつ戻す。
8. Safari対策では、再現確認 → 最小修正 → 再実機確認を繰り返す。

---

## 完了時点

最終実機確認:
- 龍盾表示 OK
- 足音2回 OK
- 咆哮 OK
- 高速連打でも咆哮後に炎へ遷移 OK
- 炎音 OK
- ダブルタップズーム防止 OK
- 2周目以降の咆哮 OK
- 焦げメダル / お掃除 / 通常メダル復帰 OK

この記録を、今後のCA Clover・Campsite系・iPhone向け演出実装の再発防止チェックリストとして使用する。
