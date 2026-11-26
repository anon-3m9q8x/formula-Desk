# Formula Desk

Excel・Google スプレッドシート向けの表編集と数式提案をブラウザ上で行うサイトです。

[Formula Desk を開く](https://formula-desk-92c3.onrender.com)

## ローカルで開く

リポジトリのルートで次のコマンドを実行し、ブラウザで http://localhost:8000 を開いてください。

```sh
python3 -m http.server 8000 --directory dist
```

## 表の取り込みテスト

```sh
node tests/import-positions.cjs
```

## 数式エンジンと関数アシスタントのテスト

```sh
node tests/engine.cjs           # 数式エンジン(構文解析・静的検証・実行)
node tests/assistant-eval.cjs   # 正解付き評価セットで関数アシスタントの正答率を測定
```

関数アシスタントは、要望文を構造化 → ルールで数式を生成 → 静的検証 → エンジンで実行して、数式を使わずに計算した期待値と照合 → エッジケース検証、の順に確認し、すべて通った数式だけを「検証済み」と表示します。
