# GitHub Actions セットアップ手順

このドキュメントでは、Backlog → Notion 同期ツールをGitHub Actionsで自動実行するための設定手順を説明します。

## 前提条件

- GitHubアカウントを持っていること
- このリポジトリをGitHubにプッシュしていること

## セットアップ手順

### 1. GitHubリポジトリにプッシュ

まず、このプロジェクトをGitHubリポジトリにプッシュします。

```bash
# GitHubでリポジトリを作成後
cd /Users/20885/Desktop/tamagawa_local/backlog-notion-sync
git init
git add .
git commit -m "Initial commit: Backlog → Notion sync tool"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

### 2. GitHub Secretsの設定

GitHubリポジトリのSettings → Secrets and variables → Actionsで、以下のシークレットを設定します。

#### 必要なシークレット

1. **`BACKLOG_DOMAIN`**
   - 値: `jins.backlog.jp`（ドメイン部分のみ、`https://`は不要）

2. **`BACKLOG_API_KEY`**
   - 値: BacklogのAPIキー（例: `NrZFs6Ib4kSyxJdPRjedM81VwmNsM28n94P0R5SKq9N1Q6mgXPfJAcUyYEOjNLAG`）
   - 取得方法: Backlogの「個人設定」→「API」から生成

3. **`BACKLOG_PROJECT_KEY`**
   - 値: プロジェクトキー（例: `DJ36_MES`）

4. **`NOTION_TOKEN`**
   - 値: NotionのAPIトークン（`ntn_`で始まる文字列）
   - 取得方法: Notionの「Settings & members」→「Connections」→「Develop or manage integrations」から作成

5. **`NOTION_PARENT_PAGE_ID`**
   - 値: Notionの親ページID（例: `2b286bc1-86eb-8069-8ebb-d3f702f06d70`）
   - 取得方法: NotionページのURLから取得（`https://www.notion.so/ページ名-2b286bc1-86eb-8069-8ebb-d3f702f06d70`の最後の部分）

#### シークレットの設定方法

1. GitHubリポジトリのページで「Settings」をクリック
2. 左サイドバーで「Secrets and variables」→「Actions」をクリック
3. 「New repository secret」をクリック
4. Nameにシークレット名、Secretに値を入力して「Add secret」をクリック
5. 上記5つのシークレットをすべて追加

### 3. ワークフローの確認

`.github/workflows/backlog-to-notion.yml`が正しく配置されていることを確認します。

```bash
ls -la .github/workflows/
```

### 4. 手動実行でテスト

1. GitHubリポジトリのページで「Actions」タブをクリック
2. 左サイドバーで「Backlog → Notion Sync」を選択
3. 「Run workflow」ボタンをクリック
4. 「Run workflow」をクリックして実行
5. 実行ログを確認して、エラーがないか確認

### 5. 定期実行の確認

ワークフローは毎時0分（UTC時間）に自動実行されます。
- UTC時間: 毎時0分
- 日本時間（JST）: 毎時9分（UTC+9）

実行履歴は「Actions」タブで確認できます。

## トラブルシューティング

### エラーが発生する場合

1. **シークレットが正しく設定されているか確認**
   - Settings → Secrets and variables → Actionsで確認

2. **実行ログを確認**
   - Actionsタブで実行履歴を開き、ログを確認

3. **環境変数の値が正しいか確認**
   - `BACKLOG_DOMAIN`: ドメインのみ（`https://`や末尾の`/`は不要）
   - `NOTION_PARENT_PAGE_ID`: ハイフンを含む32文字のID

### よくあるエラー

- **`Required parameter 'NOTION_TOKEN' is missing`**
  - シークレット名が`NOTION_TOKEN`になっているか確認

- **`HTTP 400: Unauthorized`**
  - APIキーまたはトークンが正しいか確認

- **`HTTP 404: Page not found`**
  - `NOTION_PARENT_PAGE_ID`が正しいか確認
  - ページが削除されていないか確認

## 実行頻度の変更

実行頻度を変更する場合は、`.github/workflows/backlog-to-notion.yml`の`cron`設定を変更します。

```yaml
schedule:
  - cron: '0 * * * *'  # 毎時0分
  - cron: '0 */6 * * *'  # 6時間ごと
  - cron: '0 0 * * *'  # 毎日0時
```

cron式の詳細は[GitHub Actionsのドキュメント](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)を参照してください。

