import { Client } from '@notionhq/client';

export interface NotionPage {
  id: string;
  title: string;
  lastEditedTime: string;
}

export class NotionClient {
  private client: Client;

  constructor(token: string) {
    this.client = new Client({ auth: token });
  }

  /**
   * 親ページ配下の子ページ一覧を取得
   */
  async getChildPages(parentPageId: string): Promise<NotionPage[]> {
    const response = await this.client.blocks.children.list({
      block_id: parentPageId,
    });

    const childPages: NotionPage[] = [];
    
    for (const block of response.results) {
      if ('type' in block && block.type === 'child_page') {
        const page = await this.client.pages.retrieve({ page_id: block.id });
        
        if ('properties' in page && 'last_edited_time' in page) {
          const title = this.extractTitle(page.properties);
          
          childPages.push({
            id: block.id,
            title: title,
            lastEditedTime: page.last_edited_time,
          });
        }
      }
    }

    return childPages;
  }

  /**
   * 子ページを作成
   */
  async createChildPage(parentPageId: string, title: string): Promise<string> {
    const response = await this.client.pages.create({
      parent: {
        page_id: parentPageId,
      },
      properties: {
        title: {
          title: [
            {
              text: {
                content: title,
              },
            },
          ],
        },
      },
    });

    return response.id;
  }

  /**
   * ページの内容を更新（Markdown形式のテキストをNotion Blocksに変換）
   */
  async updatePageContent(pageId: string, markdown: string): Promise<void> {
    // 既存のブロックを削除（最初のブロックを取得して削除）
    const existingBlocks = await this.client.blocks.children.list({
      block_id: pageId,
    });

    // 既存のブロックを削除
    for (const block of existingBlocks.results) {
      await this.client.blocks.delete({
        block_id: block.id,
      });
    }

    // MarkdownをNotion Blocksに変換
    const blocks = this.markdownToBlocks(markdown);

    // 新しいブロックを追加
    if (blocks.length > 0) {
      await this.client.blocks.children.append({
        block_id: pageId,
        children: blocks,
      });
    }
  }

  /**
   * Markdown形式のテキストをNotion Blocksに変換
   * 簡易版：行ごとに変換（より高度な変換は後で改善可能）
   */
  private markdownToBlocks(markdown: string): any[] {
    const lines = markdown.split('\n');
    const blocks: any[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (!trimmedLine) {
        // 空行は空のparagraphブロックとして追加
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [],
          },
        });
        continue;
      }

      // 見出しの検出
      if (trimmedLine.startsWith('### ')) {
        blocks.push({
          object: 'block',
          type: 'heading_3',
          heading_3: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: trimmedLine.substring(4),
                },
              },
            ],
          },
        });
      } else if (trimmedLine.startsWith('## ')) {
        blocks.push({
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: trimmedLine.substring(3),
                },
              },
            ],
          },
        });
      } else if (trimmedLine.startsWith('# ')) {
        blocks.push({
          object: 'block',
          type: 'heading_1',
          heading_1: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: trimmedLine.substring(2),
                },
              },
            ],
          },
        });
      } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        // リスト項目
        blocks.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: trimmedLine.substring(2),
                },
              },
            ],
          },
        });
      } else {
        // 通常のテキスト（リンクや太字などの装飾は後で改善可能）
        const richText = this.parseRichText(trimmedLine);
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: richText,
          },
        });
      }
    }

    return blocks;
  }

  /**
   * テキストからリッチテキストを解析（簡易版）
   * 太字（**text**）やリンク（[text](url)）などを検出
   */
  private parseRichText(text: string): any[] {
    const richText: any[] = [];
    let currentIndex = 0;

    // 簡易版：太字とリンクを検出
    const boldRegex = /\*\*(.+?)\*\*/g;
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

    // まずリンクを処理
    const linkMatches = Array.from(text.matchAll(linkRegex));
    const boldMatches = Array.from(text.matchAll(boldRegex));

    // シンプルな実装：通常のテキストとして返す
    // より高度な変換は後で改善可能
    richText.push({
      type: 'text',
      text: {
        content: text,
      },
    });

    return richText;
  }

  /**
   * ページのタイトルを抽出
   */
  private extractTitle(properties: any): string {
    if (properties.title && properties.title.title && properties.title.title.length > 0) {
      return properties.title.title[0].plain_text;
    }
    return 'Untitled';
  }
}

