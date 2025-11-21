# GitHub Secrets 設定手順

現在、GitHub Secretsが設定されていないため、ワークフローの実行が失敗しています。
以下の手順でシークレットを設定してください。

## 設定手順

1. **GitHubリポジトリのSettingsを開く**
   - https://github.com/JINS-KanichiTamagawa/backlog-notion-sync
   - 「Settings」タブをクリック

2. **Secrets and variables → Actionsを開く**
   - 左サイドバーで「Secrets and variables」→「Actions」をクリック

3. **シークレットを追加**
   - 「New repository secret」をクリック
   - 以下の5つのシークレットを順番に追加：

### シークレット一覧

| Name | Value | 説明 |
|------|-------|------|
| `BACKLOG_DOMAIN` | `jins.backlog.jp` | Backlogのドメイン（`https://`は不要） |
| `BACKLOG_API_KEY` | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | BacklogのAPIキー |
| `BACKLOG_PROJECT_KEY` | `DJ36_MES` | Backlogのプロジェクトキー |
| `NOTION_TOKEN` | `ntn_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | NotionのAPIトークン |
| `NOTION_PARENT_PAGE_ID` | `2b286bc1-86eb-8069-8ebb-d3f702f06d70` | Notionの親ページID |

## 各シークレットの追加方法

1. 「New repository secret」をクリック
2. **Name**にシークレット名を入力（例: `BACKLOG_DOMAIN`）
3. **Secret**に値を入力（例: `jins.backlog.jp`）
4. 「Add secret」をクリック
5. 上記5つすべてを追加

## 設定後の確認

1. 「Secrets and variables」→「Actions」ページで、5つのシークレットが表示されていることを確認
2. 「Actions」タブに移動
3. 「Backlog → Notion Sync」ワークフローを選択
4. 「Run workflow」ボタンで手動実行
5. 実行ログを確認して、エラーがないか確認

## 注意事項

- シークレットの値は一度設定すると表示できません（セキュリティのため）
- 値を間違えた場合は、シークレットを削除して再作成してください
- シークレット名は大文字小文字を区別します（正確に入力してください）

