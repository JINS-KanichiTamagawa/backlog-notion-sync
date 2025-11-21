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

    // Backlogに存在しないNotionページを検出して削除
    await this.deleteOrphanedPages(backlogTree, notionParentPageId);

    console.log('同期が完了しました。');
  }

  /**
   * Notionのページ構造をマップに構築（再帰的）
   */
  private async buildNotionPageMap(parentPageId: string, prefix: string = ''): Promise<void> {
    try {
      const pages = await this.notionClient.getChildPages(parentPageId);
      
      for (const page of pages) {
        const fullPath = prefix ? `${prefix}/${page.title}` : page.title;
        this.notionPageMap.set(fullPath, page);
        
        // 子ページも再帰的に取得
        await this.buildNotionPageMap(page.id, fullPath);
      }
    } catch (error: any) {
      // 親ページが見つからない場合はスキップ
      if (error.code === 'object_not_found') {
        console.warn(`親ページが見つかりません（スキップ）: ${parentPageId}`);
        return;
      }
      throw error;
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
      const forceUpdatePaths = ['ステータス定義'];
      const forceUpdate = forceUpdatePaths.some(path => currentPath.endsWith(path));

      if (node.type === 'folder') {
        // フォルダの場合
        console.log(`フォルダ処理: ${currentPath}`);
        
        // Notionでフォルダページを取得または作成
        let folderPageId = await this.getOrCreateFolderPage(notionParentPageId, node.title, currentPath);
        
        // フォルダページ自体のコンテンツを更新（Backlog側にコンテンツがある場合）
        // フォルダとして扱っているが、実態はドキュメントである可能性があるため
        try {
          const doc = await this.backlogClient.getDocument(node.id);
          // console.log(`フォルダ「${node.title}」のコンテンツ長: ${doc.content ? doc.content.length : 0}`);
          if (doc.content && doc.content.trim().length > 0) {
            console.log(`フォルダページのコンテンツ更新: ${currentPath}`);
            // コンテンツがある場合のみ更新（子ページは維持される）
            await this.notionClient.updatePageContent(folderPageId, doc.content);
          }
        } catch (error) {
          // コンテンツ取得に失敗した場合（純粋なフォルダなど）は無視
          // console.log(`フォルダコンテンツ取得スキップ: ${node.title}`);
        }

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

          if (forceUpdate || backlogUpdated > notionUpdated) {
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

  /**
   * Backlogに存在しないNotionページを検出して削除
   */
  private async deleteOrphanedPages(
    backlogTree: BacklogDocumentTreeNode[],
    notionParentPageId: string
  ): Promise<void> {
    // Backlogに存在するすべてのページのパスを収集
    const backlogPaths = new Set<string>();
    const collectPaths = (nodes: BacklogDocumentTreeNode[], prefix: string = '') => {
      for (const node of nodes) {
        const currentPath = prefix ? `${prefix}/${node.title}` : node.title;
        backlogPaths.add(currentPath);
        if (node.children && node.children.length > 0) {
          collectPaths(node.children, currentPath);
        }
      }
    };
    collectPaths(backlogTree);

    // Notionに存在するがBacklogに存在しないページを検出
    const orphanedPages: { path: string; page: NotionPage }[] = [];
    for (const [path, page] of this.notionPageMap.entries()) {
      if (!backlogPaths.has(path)) {
        orphanedPages.push({ path, page });
      }
    }

    if (orphanedPages.length > 0) {
      console.log(`\nBacklogに存在しないNotionページを検出: ${orphanedPages.length}件`);
      for (const { path, page } of orphanedPages) {
        console.log(`  削除対象: ${path}`);
        try {
          await this.notionClient.deletePage(page.id);
          console.log(`  ✓ ${path} を削除しました。`);
        } catch (error: any) {
          console.warn(`  ✗ ${path} の削除に失敗: ${error.message}`);
        }
      }
    } else {
      console.log('\n削除対象のページはありません。');
    }
  }
}

