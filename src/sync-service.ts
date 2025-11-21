import { BacklogClient, BacklogDocument, BacklogDocumentTreeNode } from './backlog-client';
import { NotionClient, NotionPage } from './notion-client';

export class SyncService {
  private backlogClient: BacklogClient;
  private notionClient: NotionClient;
  private notionPageMap: Map<string, NotionPage> = new Map();

  constructor(backlogClient: BacklogClient, notionClient: NotionClient) {
    this.backlogClient = backlogClient;
    this.notionClient = notionClient;
  }

  /**
   * BacklogとNotionを同期（階層構造を維持）
   */
  async sync(backlogProjectKey: string, notionParentPageId: string): Promise<void> {
    console.log('Backlogからドキュメントツリーを取得中...');
    const backlogTree = await this.backlogClient.getDocumentTree(backlogProjectKey);
    console.log(`ドキュメントツリーを取得しました。`);

    console.log('Notionから既存のページ構造を取得中...');
    await this.buildNotionPageMap(notionParentPageId);
    console.log(`${this.notionPageMap.size}件のページを取得しました。`);

    // 階層構造を再帰的に同期
    await this.syncTree(backlogTree, notionParentPageId);

    console.log('同期が完了しました。');
  }

  /**
   * Notionのページ構造をマップに構築（再帰的）
   */
  private async buildNotionPageMap(parentPageId: string, prefix: string = ''): Promise<void> {
    const pages = await this.notionClient.getChildPages(parentPageId);
    
    for (const page of pages) {
      const fullPath = prefix ? `${prefix}/${page.title}` : page.title;
      this.notionPageMap.set(fullPath, page);
      
      // 子ページも再帰的に取得
      await this.buildNotionPageMap(page.id, fullPath);
    }
  }

  /**
   * ドキュメントツリーを再帰的に同期
   */
  private async syncTree(
    backlogTree: BacklogDocumentTreeNode[],
    notionParentPageId: string,
    pathPrefix: string = ''
  ): Promise<void> {
    for (const node of backlogTree) {
      const currentPath = pathPrefix ? `${pathPrefix}/${node.title}` : node.title;

      if (node.type === 'folder') {
        // フォルダの場合
        console.log(`フォルダ処理: ${currentPath}`);
        
        // Notionでフォルダページを取得または作成
        let folderPageId = await this.getOrCreateFolderPage(notionParentPageId, node.title, currentPath);
        
        // 子要素を再帰的に同期
        if (node.children && node.children.length > 0) {
          await this.syncTree(node.children, folderPageId, currentPath);
        }
      } else {
        // ドキュメントの場合
        const notionPage = this.notionPageMap.get(currentPath);
        
        if (!notionPage) {
          // Notionに存在しない → 新規作成
          console.log(`新規作成: ${currentPath}`);
          const doc = await this.backlogClient.getDocument(node.id);
          const pageId = await this.notionClient.createChildPage(notionParentPageId, node.title);
          await this.notionClient.updatePageContent(pageId, doc.content);
          console.log(`✓ ${currentPath} を作成しました。`);
        } else {
          // Notionに存在する → 更新日時を比較
          const backlogUpdated = node.updated ? new Date(node.updated) : new Date(0);
          const notionUpdated = new Date(notionPage.lastEditedTime);

          if (backlogUpdated > notionUpdated) {
            // Backlogの方が新しい → 更新
            console.log(`更新: ${currentPath}`);
            const doc = await this.backlogClient.getDocument(node.id);
            await this.notionClient.updatePageContent(notionPage.id, doc.content);
            console.log(`✓ ${currentPath} を更新しました。`);
          } else {
            console.log(`スキップ: ${currentPath} (変更なし)`);
          }
        }
      }
    }
  }

  /**
   * フォルダページを取得または作成
   */
  private async getOrCreateFolderPage(
    parentPageId: string,
    folderName: string,
    fullPath: string
  ): Promise<string> {
    const notionPage = this.notionPageMap.get(fullPath);
    
    if (notionPage) {
      return notionPage.id;
    }

    // フォルダページを作成
    console.log(`フォルダ作成: ${fullPath}`);
    const pageId = await this.notionClient.createChildPage(parentPageId, folderName);
    console.log(`✓ ${fullPath} を作成しました。`);
    
    return pageId;
  }
}

