# BPMExtension

`https://accounts.booth.pm/library`、`https://accounts.booth.pm/library/gifts`にある商品情報を取得してjsonに纏めるだけ

## 出力形式
```json
[
  {
    "itemName": "商品タイトル",
    "authorName": "作者名",
    "itemUrl": "商品ページURL",
    "imageUrl": "商品画像URL",
    "fileName": "ファイル名",
    "downloadUrl": "ダウンロードリンク"
  },
  {
    "itemName": "商品タイトル",
    "authorName": "作者名",
    "itemUrl": "商品ページURL", 
    "imageUrl": "商品画像URL",
    "fileName": "ファイル名2",
    "downloadUrl": "ダウンロードリンク2"
  },
  {
    "itemName": "商品タイトル2",
    "authorName": "作者名2",
    "itemUrl": "商品ページURL2",
    "imageUrl": "商品画像URL2",
    "fileName": "ファイル名3",
    "downloadUrl": "ダウンロードリンク3"
  }
]
```
