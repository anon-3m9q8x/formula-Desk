# Formula Desk

Excel・Google スプレッドシート向けの表編集と数式提案をブラウザ上で行うサイトです。

[Formula Desk を開く](https://formula-desk-jp.neatsaffron.chatgpt.site)

## ローカルで開く

リポジトリのルートで次のコマンドを実行し、ブラウザで http://localhost:8000 を開いてください。

```sh
python3 -m http.server 8000 --directory dist
```

## 表の取り込みテスト

```sh
node tests/import-positions.cjs
```
