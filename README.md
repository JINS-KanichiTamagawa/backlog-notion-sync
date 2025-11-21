# Backlog → Notion 同期ツール

BacklogのドキュメントをNotionに自動同期するNode.jsツールです。

## 機能

- Backlogからドキュメント一覧を取得
- Notionの親ページ配下の子ページ一覧を取得
- 差分を検出（BacklogにあってNotionにない、または更新日時が異なる）
- 差分があれば子ページを作成/更新
- Markdown形式のコンテンツをNotion Blocksに変換
- 階層構造を維持（フォルダ構造を反映）

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example`を`.env`にコピーして、実際の値を設定してください。

```bash
cp .env.example .env
```

`.env`ファイルを編集：
- `BACKLOG_DOMAIN`: Backlogのドメイン（例: `jins.backlog.jp`）
- `BACKLOG_API_KEY`: BacklogのAPIキー（Backlogの設定画面から取得）
- `BACKLOG_PROJECT_KEY`: プロジェクトキー（例: `DJ36_MES`）
- `NOTION_TOKEN`: NotionのAPIトークン（`ntn_`で始まる文字列）
- `NOTION_PARENT_PAGE_ID`: Notionの親ページID（例: `2b286bc1-86eb-8069-8ebb-d3f702f06d70`）

**注意**: `.env`ファイルは`.gitignore`に含まれているため、Gitにコミットされません。

### 3. ビルド

```bash
npm run build
```

### 4. 実行

```bash
npm start
```

または開発モードで実行：

```bash
npm run dev
```

## 定期実行の設定

### macOS (launchd)

`~/Library/LaunchAgents/com.backlog-notion-sync.plist`を作成：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.backlog-notion-sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/20885/Desktop/tamagawa_local/backlog-notion-sync/dist/index.js</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>2</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/Users/20885/Desktop/tamagawa_local/backlog-notion-sync/sync.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/20885/Desktop/tamagawa_local/backlog-notion-sync/sync-error.log</string>
</dict>
</plist>
```

ロード：

```bash
launchctl load ~/Library/LaunchAgents/com.backlog-notion-sync.plist
```

### GitHub Actions

`.github/workflows/backlog-to-notion.yml`が用意されています：
- 毎時0分（UTC時間）に自動実行
- 手動実行も可能（`workflow_dispatch`）

#### セットアップ手順

詳細なセットアップ手順は [`GITHUB_ACTIONS_SETUP.md`](./GITHUB_ACTIONS_SETUP.md) を参照してください。

**簡単な手順：**

1. GitHubリポジトリにプッシュ
2. Settings → Secrets and variables → Actionsで以下のシークレットを設定：
   - `BACKLOG_DOMAIN`: Backlogのドメイン（例: `jins.backlog.jp`）
   - `BACKLOG_API_KEY`: BacklogのAPIキー
   - `BACKLOG_PROJECT_KEY`: プロジェクトキー（例: `DJ36_MES`）
   - `NOTION_TOKEN`: NotionのAPIトークン
   - `NOTION_PARENT_PAGE_ID`: Notionの親ページID
3. Actionsタブで手動実行してテスト
4. 自動実行は毎時0分（UTC）に開始されます

## ログ

実行ログは`sync.log`に出力されます。

