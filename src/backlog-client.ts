import https from 'https';

export interface BacklogDocument {
  id: string;
  title: string;
  content: string;
  updated: string;
  created: string;
  parentId?: string; // 親フォルダのID（階層構造用）
}

export interface BacklogDocumentTreeNode {
  id: string;
  title: string;
  type: 'document' | 'folder';
  updated?: string;
  created?: string;
  children?: BacklogDocumentTreeNode[];
  parentId?: string; // 親フォルダのID
}

export class BacklogClient {
  private domain: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(domain: string, apiKey: string) {
    this.domain = domain;
    this.apiKey = apiKey;
    this.baseUrl = `https://${domain}/api/v2`;
  }

  /**
   * プロジェクトのドキュメントツリーを取得（階層構造を含む）
   */
  async getDocumentTree(projectKey: string): Promise<BacklogDocumentTreeNode[]> {
    // Backlog API v2では、ドキュメントツリーを取得するエンドポイントを試す
    // プロジェクトIDを取得
    const project = await this.getProject(projectKey);
    const projectId = project.id;
    
    // まずツリーエンドポイントを試す
    const treeUrl = `${this.baseUrl}/projects/${projectId}/documents/tree?apiKey=${this.apiKey}`;
    
    try {
      const response = await this.request(treeUrl);
      if (Array.isArray(response)) {
        return this.parseDocumentTree(response);
      }
    } catch (error: any) {
      // 404エラーの場合はツリーエンドポイントが存在しない
      if (error.message && error.message.includes('404')) {
        console.log('ドキュメントツリーエンドポイントが見つかりません。フラットな一覧から構築します。');
      } else {
        console.warn('ドキュメントツリーの取得に失敗しました:', error.message);
      }
    }
    
    // フォールバック: フラットな一覧を取得して階層構造を構築
    return await this.buildTreeFromFlatList(projectKey);
  }

  /**
   * プロジェクト情報を取得
   */
  private async getProject(projectKey: string): Promise<any> {
    const url = `${this.baseUrl}/projects/${projectKey}?apiKey=${this.apiKey}`;
    return await this.request(url);
  }

  /**
   * ドキュメントツリーをパース
   */
  private parseDocumentTree(tree: any): BacklogDocumentTreeNode[] {
    if (!Array.isArray(tree)) {
      return [];
    }

    return tree.map((node: any) => {
      const result: BacklogDocumentTreeNode = {
        id: node.id,
        title: node.title || node.name,
        type: node.type === 'folder' || node.children ? 'folder' : 'document',
        updated: node.updated,
        created: node.created,
      };

      if (node.children && Array.isArray(node.children)) {
        result.children = this.parseDocumentTree(node.children);
      }

      return result;
    });
  }

  /**
   * フラットな一覧から階層構造を構築
   * Backlogのドキュメントはタイトルに階層情報が含まれている可能性がある
   * 例: "仕様/ステータス定義" → "仕様"フォルダ配下の"ステータス定義"ドキュメント
   */
  private async buildTreeFromFlatList(projectKey: string): Promise<BacklogDocumentTreeNode[]> {
    // プロジェクトIDを取得
    const project = await this.getProject(projectKey);
    const projectId = project.id;
    
    // Backlog API v2では、ドキュメント一覧は `/api/v2/documents?projectId[]={project_id}&offset=0` を使う
    // offsetパラメータが必須
    const url = `${this.baseUrl}/documents?projectId[]=${projectId}&offset=0&apiKey=${this.apiKey}`;
    let response: any;
    
    try {
      response = await this.request(url);
      // レスポンスが配列でない場合、配列プロパティを確認
      if (!Array.isArray(response)) {
        // ページネーション対応: すべてのドキュメントを取得
        const allDocuments: any[] = [];
        let offset = 0;
        let hasMore = true;
        
        while (hasMore) {
          const pageUrl = `${this.baseUrl}/documents?projectId[]=${projectId}&offset=${offset}&apiKey=${this.apiKey}`;
          const pageResponse = await this.request(pageUrl);
          
          if (Array.isArray(pageResponse)) {
            allDocuments.push(...pageResponse);
            hasMore = pageResponse.length > 0;
            offset += pageResponse.length;
          } else if (pageResponse && Array.isArray(pageResponse)) {
            allDocuments.push(...pageResponse);
            hasMore = false;
          } else {
            hasMore = false;
          }
        }
        
        response = allDocuments;
      }
    } catch (error: any) {
      console.error('ドキュメント一覧の取得に失敗しました:', error.message);
      return [];
    }
    
    const documents = Array.isArray(response) ? response : [];
    
    console.log(`取得したドキュメント数: ${documents.length}`);

    // 各ドキュメントの詳細を取得して階層情報を確認
    const documentsWithDetails: any[] = [];
    for (const doc of documents) {
      try {
        const detail = await this.getDocumentDetail(doc.id);
        documentsWithDetails.push({
          ...doc,
          ...detail,
        });
      } catch (error: any) {
        console.warn(`ドキュメント ${doc.id} の詳細取得に失敗:`, error.message);
        documentsWithDetails.push(doc);
      }
    }

    // デバッグ: 最初の数件のドキュメントの詳細を確認
    console.log('ドキュメント詳細のサンプル:');
    for (let i = 0; i < Math.min(3, documentsWithDetails.length); i++) {
      const doc = documentsWithDetails[i];
      console.log(`- ${doc.title}: json=${doc.json ? 'あり' : 'なし'}, plain=${doc.plain ? 'あり' : 'なし'}`);
      if (doc.json) {
        console.log(`  json構造:`, JSON.stringify(doc.json, null, 2).substring(0, 500));
      }
    }

    // 階層構造を構築
    // Backlogのドキュメントは`json`フィールドに階層情報が含まれている可能性がある
    // または、ドキュメントIDの親子関係から構築する必要がある
    
    // まず、フォルダ（childlistを持つドキュメント）を特定
    const folders = new Map<string, BacklogDocumentTreeNode>();
    const documentsMap = new Map<string, BacklogDocumentTreeNode>();
    
    for (const doc of documentsWithDetails) {
      if (!doc.title || doc.title.trim() === '') {
        continue;
      }

      // jsonフィールドにchildlistがある場合はフォルダ
      const isFolder = doc.json && doc.json.content && 
        doc.json.content.some((item: any) => item.type === 'childlist');
      
      const node: BacklogDocumentTreeNode = {
        id: doc.id,
        title: doc.title,
        type: isFolder ? 'folder' : 'document',
        updated: doc.updated,
        created: doc.created,
        children: [],
      };

      if (isFolder) {
        folders.set(doc.id, node);
      } else {
        documentsMap.set(doc.id, node);
      }
    }

    // フォルダとドキュメントを階層構造に組み立て
    // 実際のBacklog APIでは、ドキュメントの親子関係が別の方法で管理されている可能性がある
    // ここでは、タイトルから階層を推測する（例: "FIX済み仕様"がフォルダで、その配下にドキュメントがある）
    
    // フォルダ名のリスト（ユーザーが指定したフォルダ名）
    // 「FIX済み仕様」は親ページを作成せず、その子ページをルートに配置
    const folderNames = ['プランニング', 'テスト'];
    const rootNodes: BacklogDocumentTreeNode[] = [];
    const folderNodes = new Map<string, BacklogDocumentTreeNode>();
    const allNodes = new Map<string, BacklogDocumentTreeNode>();

    // まず、すべてのノードを作成
    for (const doc of documentsWithDetails) {
      if (!doc.title || doc.title.trim() === '') {
        continue;
      }

      // jsonフィールドにchildlistがある場合はフォルダ
      const isFolder = doc.json && doc.json.content && 
        doc.json.content.some((item: any) => item.type === 'childlist');

      const node: BacklogDocumentTreeNode = {
        id: doc.id,
        title: doc.title,
        type: isFolder ? 'folder' : 'document',
        updated: doc.updated,
        created: doc.created,
        children: [],
      };

      allNodes.set(doc.id, node);

      // フォルダ名と一致する場合はフォルダとして扱う（FIX済み仕様は除外）
      if (folderNames.includes(doc.title)) {
        node.type = 'folder';
        folderNodes.set(doc.id, node);
        rootNodes.push(node);
      }
    }

    // フォルダ配下のドキュメントを特定
    // Backlog APIでは、ドキュメントの親子関係が別の方法で管理されている可能性がある
    // ここでは、フォルダのchildlistから子ドキュメントを取得する方法を試す
    
    // 各フォルダのchildlistを確認して子ドキュメントを取得
    // Backlog APIでは、フォルダのchildlistに子ドキュメントのIDが含まれていない可能性がある
    // そのため、別の方法で親子関係を特定する必要がある
    
    // 実際のBacklogのドキュメント構造では、フォルダ配下のドキュメントは
    // フォルダの詳細を取得した際に、childlistのcontentに含まれている可能性がある
    // しかし、現在のAPIレスポンスには子ドキュメントのIDが含まれていない
    
    // 代替案: フォルダ名に基づいてドキュメントを分類する
    // 実際のBacklogでは、ドキュメントのタイトルや他の情報から親子関係を推測する必要がある
    
    // フォルダ以外のドキュメントを適切なフォルダに割り当て
    // Backlog APIでは、ドキュメントの親子関係が別の方法で管理されている可能性がある
    // ここでは、フォルダ名に基づいてドキュメントを分類する（簡易的な実装）
    // 実際のBacklogでは、ドキュメントのタイトルや他の情報から親子関係を推測する必要がある
    
    // 「FIX済み仕様」の子ページをルートに直接配置
    const fixSpecDocuments = [
      'FIX済み仕様',
      'ステータス定義',
      'システム名称について',
      '現行運用におけるS番号Z番号とは？',
      'プロセスセンターコード、住所情報',
      'マニュアル作成',
      '議事メモNotebookLMパス',
      '開発PLタスク',
    ];

    // フォルダ名とドキュメントの対応関係を定義（実際のBacklogの構造に応じて調整が必要）
    const folderDocumentMapping: { [key: string]: string[] } = {
      'プランニング': [
        '20251107-SP2プランニング',
        '20251002 プランニング',
        '開発PLタスク',
        '議事メモNotebookLMパス',
      ],
      'テスト': [
        'テスト資料',
        'テスト（バルテス様）',
        'テスト進行キックオフ',
      ],
    };

    // 「FIX済み仕様」の子ページをルートに追加
    for (const docName of fixSpecDocuments) {
      const doc = documentsWithDetails.find(d => d.title === docName);
      if (doc && allNodes.has(doc.id)) {
        const node = allNodes.get(doc.id)!;
        if (node.type === 'document') {
          rootNodes.push(node);
        }
      }
    }

    // フォルダ配下のドキュメントを割り当て
    for (const [folderId, folderNode] of folderNodes.entries()) {
      const folderName = folderNode.title;
      const childDocNames = folderDocumentMapping[folderName] || [];
      
      for (const docName of childDocNames) {
        const childDoc = documentsWithDetails.find(d => d.title === docName);
        if (childDoc && allNodes.has(childDoc.id)) {
          const childNode = allNodes.get(childDoc.id)!;
          if (childNode.type === 'document') {
            if (!folderNode.children) {
              folderNode.children = [];
            }
            folderNode.children.push(childNode);
          }
        }
      }
    }

    // フォルダに割り当てられていない、かつFIX済み仕様の子でもないドキュメントをルートに追加
    const assignedDocIds = new Set<string>();
    for (const folderNode of folderNodes.values()) {
      if (folderNode.children) {
        for (const child of folderNode.children) {
          assignedDocIds.add(child.id);
        }
      }
    }
    // FIX済み仕様の子ページも除外
    for (const docName of fixSpecDocuments) {
      const doc = documentsWithDetails.find(d => d.title === docName);
      if (doc) {
        assignedDocIds.add(doc.id);
      }
    }

    for (const [docId, node] of allNodes.entries()) {
      if (node.type === 'document' && !folderNodes.has(docId) && !assignedDocIds.has(docId)) {
        rootNodes.push(node);
      }
    }

    return rootNodes;
  }

  /**
   * プロジェクトのドキュメント一覧を取得（後方互換性のため残す）
   */
  async getDocuments(projectKey: string): Promise<BacklogDocument[]> {
    const tree = await this.getDocumentTree(projectKey);
    const documents: BacklogDocument[] = [];

    // ツリーをフラット化してドキュメントのみを取得
    const flattenTree = (nodes: BacklogDocumentTreeNode[], parentId?: string) => {
      for (const node of nodes) {
        if (node.type === 'document') {
          documents.push({
            id: node.id,
            title: node.title,
            content: '', // 後で詳細を取得
            updated: node.updated || '',
            created: node.created || '',
            parentId: parentId,
          });
        } else if (node.children) {
          flattenTree(node.children, node.id);
        }
      }
    };

    flattenTree(tree);

    // 各ドキュメントの詳細を取得
    const detailedDocuments: BacklogDocument[] = [];
    for (const doc of documents) {
      try {
        const detail = await this.getDocument(doc.id);
        detail.parentId = doc.parentId;
        detailedDocuments.push(detail);
      } catch (error) {
        console.warn(`ドキュメント ${doc.id} の取得に失敗しました:`, error);
      }
    }

    return detailedDocuments;
  }

  /**
   * ドキュメントの詳細を取得（階層情報を含む）
   */
  private async getDocumentDetail(documentId: string): Promise<any> {
    const url = `${this.baseUrl}/documents/${documentId}?apiKey=${this.apiKey}`;
    return await this.request(url);
  }

  /**
   * ドキュメントの詳細を取得
   */
  async getDocument(documentId: string): Promise<BacklogDocument> {
    const response = await this.getDocumentDetail(documentId);
    
    return {
      id: response.id,
      title: response.title,
      content: response.plain || '',
      updated: response.updated,
      created: response.created,
    };
  }

  /**
   * HTTPリクエストを実行
   */
  private request(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(json);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(json)}`));
            }
          } catch (error) {
            reject(new Error(`JSON parse error: ${error}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  }
}

