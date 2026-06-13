# 🍳 レシピナビ for Even G2

[Even Realities G2](https://www.evenrealities.com/) スマートグラス用のレシピナビゲーションアプリです。

調理中、濡れた手でスマホを触らなくても、グラスのHUD（576×288・緑単色）にレシピの手順が1ステップずつ表示されます。テンプルのタッチパッドで操作し、「15分煮る」のような手順では下スワイプでカウントダウンタイマーが視界に出ます。

## 操作方法（グラス側）

| ジェスチャー | 動作 |
|---|---|
| タップ | 次の手順へ |
| 上スワイプ | 前の手順へ戻る |
| 下スワイプ | タイマー開始 / 停止（手順に「5分」「30秒」等があるとき） |
| 2回タップ | アプリ終了 |

画面は3段構成です: ヘッダー（手順番号・レシピ名・タイマー残り時間）、ボディ（手順テキスト）、フッター（操作ヒント）。

## アーキテクチャ

Even G2のアプリは**コードがスマホ上で動き、グラスは表示と入力を担当**します（BLE接続）。本アプリは [Even Hub SDK](https://www.npmjs.com/package/@evenrealities/even_hub_sdk) を使ったWebアプリ（TypeScript + Vite）です。

```
index.html / src/main.ts     コンパニオン（スマホ）画面: レシピ管理・URL取り込み・ナビ開始・ミラー表示
preview.html / src/preview.ts ブラウザ単体で動くG2画面プレビュー（実機不要の動作確認用）
src/glasses.ts               グラス側セッション: コンテナ配置・ページ送り・タイマー
src/pages.ts                 レシピ→グラス画面ページ変換（pretextで実機と同じ行折り返し計算）
src/duration.ts              手順テキストからの時間抽出（「1時間30分」「10〜15分」等に対応）
src/recipes.ts               レシピ型・カテゴリ集約・localStorage保存
src/builtin-recipes.ts       プリインストール100レシピのデータ
src/import.ts                レシピサイトURL取り込み（JSON-LD / 白ごはん.com / microdata）
app.json                     Even Hubマニフェスト
```

ポイント:

- **ページ送り方式**: G2はスクロールできないため、[`@evenrealities/pretext`](https://www.npmjs.com/package/@evenrealities/pretext)（実機LVGLと同じグリフ幅）で事前にページ分割し、`textContainerUpgrade` でちらつきなく切り替えます。
- **タイマー**: 手順テキストから時間表現を正規表現で抽出し、スマホ側で1秒ごとにヘッダーを更新します。
- **レシピ管理**: 組み込み**100レシピ**（和食・煮物／焼き物と炒め物／揚げ物／ご飯もの・丼／中華／洋食／イタリアン・パスタ／麺類／鍋・スープ／副菜・サラダ／デザートの11カテゴリ）に加え、コンパニオン画面から自分のレシピを追加できます（localStorage保存）。手順には分量（「醤油大さじ3」等）を明記済み。コンパニオン画面はカテゴリ別の折りたたみ表示＋料理名・材料での検索に対応。
- **URL取り込み**: レシピサイトのURLを貼るだけで材料と手順を自動抽出してフォームに反映します（`src/import.ts`）。対応形式は ①JSON-LD（schema.org/Recipe。クックパッド・クラシル等の主要サイト）、②白ごはん.comのHTML構造、③microdata。WebViewのCORS制限で直接取得できないサイトは公開CORSプロキシ（allorigins / corsproxy.io）へフォールバックします（プロキシにはURLのみが渡ります）。

## 開発

```bash
npm install
npm run dev          # http://localhost:5173
```

### 実機なしで試す（ブラウザプレビュー）

`http://localhost:5173/preview.html` を開くと、グラス画面の再現とジェスチャーボタン（キーボード操作可）でアプリ全体を動かせます。実機と同じ `RecipeSession` ロジックがそのまま動きます。

### 公式シミュレーター

```bash
npm run dev
npm run simulate     # evenhub-simulator http://localhost:5173
```

### 実機（G2）で試す

```bash
npm run dev
npx evenhub qr --url http://<このマシンのIP>:5173
```

G2とペアリング済みのスマホのEven Hubコンパニオンアプリで QRコードを読み取ります。

### テスト・ビルド・パッケージ

```bash
npm test             # vitest（時間抽出・ページ分割の単体テスト）
npm run build        # 型チェック + ビルド
npm run pack         # .ehpk を生成（Even Hub開発者ポータルへ提出用）
```
