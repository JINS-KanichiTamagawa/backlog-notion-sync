import dotenv from 'dotenv';
import { BacklogClient } from './backlog-client';
import { NotionClient } from './notion-client';
import { SyncService } from './sync-service';

dotenv.config();

async function main() {
  console.log('Backlog → Notion 同期を開始します...');

  const backlogDomain = process.env.BACKLOG_DOMAIN;
  const backlogApiKey = process.env.BACKLOG_API_KEY;
  const backlogProjectKey = process.env.BACKLOG_PROJECT_KEY;
  const notionToken = process.env.NOTION_TOKEN;
  const notionParentPageId = process.env.NOTION_PARENT_PAGE_ID;

  if (!backlogDomain || !backlogApiKey || !backlogProjectKey || !notionToken || !notionParentPageId) {
    console.error('環境変数が設定されていません。.envファイルを確認してください。');
    process.exit(1);
  }

  try {
    const backlogClient = new BacklogClient(backlogDomain, backlogApiKey);
    const notionClient = new NotionClient(notionToken);
    const syncService = new SyncService(backlogClient, notionClient);

    await syncService.sync(backlogProjectKey, notionParentPageId);

    console.log('同期が完了しました。');
  } catch (error) {
    console.error('同期中にエラーが発生しました:', error);
    process.exit(1);
  }
}

main();

