# システム構成図・使用技術一覧

## システム概要

BacklogのドキュメントをNotionに自動同期するシステムです。GitHub Actionsを使用して定期実行されます。

## システムアーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Schedule: 毎時0分 (UTC) / 毎時9分 (JST)              │  │
│  │  Trigger: workflow_dispatch (手動実行も可能)           │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Job: sync (ubuntu-latest)                            │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  1. Checkout repository                        │  │  │
│  │  │  2. Setup Node.js (v20)                       │  │  │
│  │  │  3. Install dependencies (npm ci)             │  │  │
│  │  │  4. Build (TypeScript → JavaScript)           │  │  │
│  │  │  5. Sync Backlog to Notion                    │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Sync Service                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  SyncService                                          │  │
│  │  - ドキュメントツリー取得                              │  │
│  │  - 差分検出（更新日時比較）                            │  │
│  │  - 階層構造の維持                                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
┌──────────────────────┐        ┌──────────────────────┐
│   Backlog API        │        │   Notion API         │
│                      │        │                      │
│  - ドキュメント取得   │        │  - ページ作成         │
│  - ツリー構造取得     │        │  - ページ更新         │
│  - Markdown取得      │        │  - Markdown変換       │
└──────────────────────┘        └──────────────────────┘
         │                                    │
         ▼                                    ▼
┌──────────────────────┐        ┌──────────────────────┐
│   Backlog            │        │   Notion              │
│   (jins.backlog.jp)  │        │   (JINS Workspace)    │
│                      │        │                      │
│  - DJ36_MES          │        │  - 加工工程管理        │
│  - ドキュメント       │        │  - Backlog→Notion Sync│
└──────────────────────┘        └──────────────────────┘
```

## データフロー

```
1. GitHub Actions トリガー
   ↓
2. Backlog API からドキュメントツリー取得
   ↓
3. Notion API から既存ページ構造取得
   ↓
4. 差分検出（更新日時比較）
   ↓
5. 新規/更新ページをNotionに同期
   ├─ 新規: ページ作成 → Markdown変換 → ブロック追加
   └─ 更新: 既存ブロック削除 → Markdown変換 → ブロック追加
   ↓
6. 階層構造の維持（親子関係を維持）
   ↓
7. 完了
```

## 使用技術一覧

### 実行環境
- **GitHub Actions**: CI/CDプラットフォーム
  - Runner: `ubuntu-latest`
  - Node.js: `v20`
  - 実行頻度: 毎時0分（UTC）/ 毎時9分（JST）

### プログラミング言語・フレームワーク
- **TypeScript**: `^5.3.3`
  - 型安全性を確保
  - ES2020ターゲット
- **Node.js**: `v20`
  - 実行環境

### 主要ライブラリ
- **@notionhq/client**: `^2.2.15`
  - Notion API公式クライアント
  - ページ作成・更新・ブロック操作
- **dotenv**: `^16.4.5`
  - 環境変数管理（ローカル開発用）

### 開発ツール
- **ts-node**: `^10.9.2`
  - TypeScript直接実行（開発用）
- **@types/node**: `^20.11.0`
  - Node.js型定義

### 外部API
- **Backlog API v2**
  - エンドポイント: `https://jins.backlog.jp/api/v2`
  - 認証: API Key
  - 使用エンドポイント:
    - `GET /projects/{projectKey}`: プロジェクト情報取得
    - `GET /documents`: ドキュメント一覧取得
    - `GET /documents/{documentId}`: ドキュメント詳細取得
- **Notion API**
  - エンドポイント: `https://api.notion.com/v1`
  - 認証: Bearer Token
  - 使用エンドポイント:
    - `GET /pages/{page_id}`: ページ取得
    - `POST /pages`: ページ作成
    - `GET /blocks/{block_id}/children`: ブロック一覧取得
    - `POST /blocks/{block_id}/children`: ブロック追加
    - `DELETE /blocks/{block_id}`: ブロック削除

### データ形式
- **Markdown**: Backlogドキュメント形式
- **Notion Blocks**: Notion APIのブロック形式
- **JSON**: API通信形式

## 主要コンポーネント

### 1. BacklogClient (`src/backlog-client.ts`)
- **責務**: Backlog APIとの通信
- **主要メソッド**:
  - `getProject(projectKey)`: プロジェクト情報取得
  - `getDocumentTree(projectKey)`: ドキュメントツリー取得（階層構造）
  - `getDocument(documentId)`: ドキュメント詳細取得
  - `buildTreeFromFlatList()`: フラットリストからツリー構築（フォールバック）

### 2. NotionClient (`src/notion-client.ts`)
- **責務**: Notion APIとの通信
- **主要メソッド**:
  - `getChildPages(parentPageId)`: 子ページ一覧取得
  - `createChildPage(parentPageId, title)`: 子ページ作成
  - `updatePageContent(pageId, markdownContent)`: ページ内容更新
  - `convertMarkdownToNotionBlocks(markdown)`: Markdown→Notion Blocks変換
  - `deleteExistingBlocks(blockId)`: 既存ブロック削除

### 3. SyncService (`src/sync-service.ts`)
- **責務**: 同期ロジックの実装
- **主要メソッド**:
  - `sync(backlogProjectKey, notionParentPageId)`: メイン同期処理
  - `buildNotionPageMap()`: Notionページ構造をマップ化
  - `syncTree()`: ドキュメントツリーを再帰的に同期
  - `getOrCreateFolderPage()`: フォルダページの取得/作成

### 4. index.ts (`src/index.ts`)
- **責務**: エントリーポイント
- **処理フロー**:
  1. 環境変数読み込み
  2. クライアント初期化
  3. 同期実行

## 設定・認証情報

### GitHub Secrets（5つ）
- `BACKLOG_DOMAIN`: Backlogドメイン
- `BACKLOG_API_KEY`: Backlog APIキー
- `BACKLOG_PROJECT_KEY`: Backlogプロジェクトキー
- `NOTION_TOKEN`: Notion APIトークン
- `NOTION_PARENT_PAGE_ID`: Notion親ページID

### 環境変数（ローカル開発用）
- `.env`ファイルに上記と同じ変数を設定

## 同期ロジック

### 差分検出
- Backlogの`updated`とNotionの`last_edited_time`を比較
- Backlogの方が新しい場合のみ更新

### 階層構造の維持
- Backlogのフォルダ構造をNotionの親子ページ構造として再現
- パスベースのマッピングでページを追跡

### Markdown変換
- BacklogのMarkdown形式をNotion Blocks形式に変換
- 対応形式:
  - 見出し（#、##、###）
  - 箇条書き（-）
  - 段落

## 実行時間・パフォーマンス

- **平均実行時間**: 約45秒
- **タイムアウト**: 10分
- **実行頻度**: 毎時1回

## エラーハンドリング

- 環境変数未設定時のエラーメッセージ
- APIエラー時のログ出力
- 失敗時のログアップロード（GitHub Actions）

## 今後の拡張可能性

- Markdownパーサーの強化（表、コードブロック、リンクなど）
- 双方向同期（Notion → Backlog）
- 差分通知機能
- 同期履歴の記録

