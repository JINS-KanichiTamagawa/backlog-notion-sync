# GitHubへのプッシュ手順

## 1. GitHubでリポジトリを作成

1. GitHubにログイン
2. 右上の「+」→「New repository」をクリック
3. リポジトリ名を入力（例: `backlog-notion-sync`）
4. 説明を入力（任意）
5. PublicまたはPrivateを選択
6. **「Initialize this repository with a README」はチェックしない**（既にREADMEがあるため）
7. 「Create repository」をクリック

## 2. リモートリポジトリを追加してプッシュ

GitHubでリポジトリを作成したら、以下のコマンドを実行してください：

```bash
cd /Users/20885/Desktop/tamagawa_local/backlog-notion-sync

# リモートリポジトリを追加（YOUR_USERNAMEとYOUR_REPO_NAMEを実際の値に置き換える）
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# メインブランチにプッシュ
git push -u origin main
```

## 3. GitHub Secretsの設定

1. GitHubリポジトリのページで「Settings」をクリック
2. 左サイドバーで「Secrets and variables」→「Actions」をクリック
3. 「New repository secret」をクリック
4. 以下の5つのシークレットを追加：

### シークレット一覧

| Name | Value | 説明 |
|------|-------|------|
| `BACKLOG_DOMAIN` | `jins.backlog.jp` | Backlogのドメイン（`https://`は不要） |
| `BACKLOG_API_KEY` | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | BacklogのAPIキー |
| `BACKLOG_PROJECT_KEY` | `DJ36_MES` | Backlogのプロジェクトキー |
| `NOTION_TOKEN` | `ntn_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | NotionのAPIトークン |
| `NOTION_PARENT_PAGE_ID` | `2b286bc1-86eb-8069-8ebb-d3f702f06d70` | Notionの親ページID |

## 4. 動作確認

1. GitHubリポジトリのページで「Actions」タブをクリック
2. 左サイドバーで「Backlog → Notion Sync」を選択
3. 「Run workflow」ボタンをクリック
4. 「Run workflow」をクリックして実行
5. 実行が完了するまで待つ（約1-2分）
6. 実行ログを確認して、エラーがないか確認

## 5. 自動実行の確認

ワークフローは毎時0分（UTC時間）に自動実行されます。
- UTC時間: 毎時0分
- 日本時間（JST）: 毎時9分（UTC+9）

実行履歴は「Actions」タブで確認できます。

