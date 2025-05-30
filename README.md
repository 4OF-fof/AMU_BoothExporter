# BPMExtension

`https://accounts.booth.pm/library`、`https://accounts.booth.pm/library/gifts`にある商品情報を取得してjsonに纏めるだけ

## 出力形式
```json
{
  "lastUpdated": "yyyy/MM/dd HH:mm:ss",
  "authors": {
    "作者名1": [
      {
        "packageName": "商品タイトル",
        "itemUrl": "商品ページURL",
        "imageUrl": "商品画像URL",
        "files": [
          {
            "fileName": "ファイル名",
            "downloadLink": "ダウンロードリンク"
          },
          {
            "fileName": "ファイル名2",
            "downloadLink": "ダウンロードリンク2"
          },
        ]
      },
      {
        "packageName": "商品タイトル2",
      },
    ],
    "作者名2": [
    ]
  }
}
```
