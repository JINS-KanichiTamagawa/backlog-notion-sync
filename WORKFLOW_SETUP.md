# GitHub Actions ワークフローの追加手順

プッシュは成功しましたが、Personal Access Tokenに`workflow`スコープがないため、ワークフローファイルをGitHub上で手動で作成する必要があります。

## 方法1: GitHub Web UIで作成（推奨）

1. GitHubリポジトリのページ（https://github.com/JINS-KanichiTamagawa/backlog-notion-sync）にアクセス
2. 「Add file」→「Create new file」をクリック
3. ファイル名を `.github/workflows/backlog-to-notion.yml` と入力
4. 以下の内容をコピー＆ペースト：

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

5. 「Commit new file」をクリック

## 方法2: GitHub CLIを使用（オプション）

GitHub CLIがインストールされている場合：

```bash
cd /Users/20885/Desktop/tamagawa_local/backlog-notion-sync
gh workflow create .github/workflows/backlog-to-notion.yml
```

## 次のステップ

ワークフローファイルを作成したら：

1. **GitHub Secretsの設定**
   - Settings → Secrets and variables → Actions
   - 以下の5つのシークレットを追加：
     - `BACKLOG_DOMAIN`: `jins.backlog.jp`
     - `BACKLOG_API_KEY`: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
     - `BACKLOG_PROJECT_KEY`: `DJ36_MES`
     - `NOTION_TOKEN`: `ntn_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
     - `NOTION_PARENT_PAGE_ID`: `2b286bc1-86eb-8069-8ebb-d3f702f06d70`

2. **動作確認**
   - Actionsタブで「Backlog → Notion Sync」を選択
   - 「Run workflow」ボタンで手動実行してテスト

