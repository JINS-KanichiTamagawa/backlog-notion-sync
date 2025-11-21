# GitHub Actions ワークフローの作成手順

Personal Access Tokenに`workflow`スコープがないため、GitHub Web UIでワークフローファイルを作成する必要があります。

## 手順

### 1. GitHubリポジトリを開く

以下のURLにアクセス：
https://github.com/JINS-KanichiTamagawa/backlog-notion-sync

### 2. ワークフローファイルを作成

1. 「Add file」→「Create new file」をクリック
2. ファイル名を入力：`.github/workflows/backlog-to-notion.yml`
   - 注意：`.github`フォルダと`workflows`フォルダは自動的に作成されます
3. 以下の内容をコピー＆ペースト：

```yaml
name: Backlog → Notion Sync

on:
  schedule:
    # 毎時0分に実行（UTC時間）
    # 日本時間では9時、10時、11時...（UTC+9）
    - cron: '0 * * * *'
  workflow_dispatch: # 手動実行も可能

jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Sync Backlog to Notion
        env:
          BACKLOG_DOMAIN: ${{ secrets.BACKLOG_DOMAIN }}
          BACKLOG_API_KEY: ${{ secrets.BACKLOG_API_KEY }}
          BACKLOG_PROJECT_KEY: ${{ secrets.BACKLOG_PROJECT_KEY }}
          NOTION_TOKEN: ${{ secrets.NOTION_TOKEN }}
          NOTION_PARENT_PAGE_ID: ${{ secrets.NOTION_PARENT_PAGE_ID }}
        run: npm start
      
      - name: Upload logs (on failure)
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: sync-logs
          path: |
            *.log
            dist/
```

4. 「Commit new file」をクリック

### 3. GitHub Secretsの設定

1. リポジトリの「Settings」→「Secrets and variables」→「Actions」を開く
2. 「New repository secret」をクリック
3. 以下の5つのシークレットを追加：

| Name | Value |
|------|-------|
| `BACKLOG_DOMAIN` | `jins.backlog.jp` |
| `BACKLOG_API_KEY` | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `BACKLOG_PROJECT_KEY` | `DJ36_MES` |
| `NOTION_TOKEN` | `ntn_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `NOTION_PARENT_PAGE_ID` | `2b286bc1-86eb-8069-8ebb-d3f702f06d70` |

### 4. 動作確認

1. 「Actions」タブを開く
2. 「Backlog → Notion Sync」ワークフローを選択
3. 「Run workflow」ボタンをクリック
4. 「Run workflow」をクリックして実行
5. 実行ログを確認

## 完了後の確認

- ワークフローファイルが作成されていること
- 5つのシークレットが設定されていること
- 手動実行が成功すること
- 自動実行が毎時0分（UTC）に開始されること

