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
        try {
          const page = await this.client.pages.retrieve({ page_id: block.id });
          
          if ('properties' in page && 'last_edited_time' in page) {
            const title = this.extractTitle(page.properties);
            
            childPages.push({
              id: block.id,
              title: title,
              lastEditedTime: page.last_edited_time,
            });
          }
        } catch (error: any) {
          // ページが見つからない場合はスキップ（削除されたページなど）
          if (error.code === 'object_not_found') {
            console.warn(`ページが見つかりません（スキップ）: ${block.id}`);
            continue;
          }
          throw error;
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
   * ページを削除（アーカイブ）
   */
  async deletePage(pageId: string): Promise<void> {
    await this.client.pages.update({
      page_id: pageId,
      archived: true,
    });
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

    // ブロックを追加（テーブルブロックとテーブル行を適切に処理）
    for (const block of blocks) {
      // テーブルブロックとテーブル行が一緒に返されている場合
      if (block.tableBlock && block.tableRows) {
        // テーブルブロックを作成
        const tableBlockResponse = await this.client.blocks.children.append({
          block_id: pageId,
          children: [block.tableBlock],
        });

        // テーブルブロックのIDを取得
        const tableBlockId = tableBlockResponse.results[0].id;

        // テーブル行を追加
        if (block.tableRows.length > 0) {
          await this.client.blocks.children.append({
            block_id: tableBlockId,
            children: block.tableRows,
          });
        }
      } else {
        // 通常のブロックを追加
        await this.client.blocks.children.append({
          block_id: pageId,
          children: [block],
        });
      }
    }
  }

  /**
   * Markdown形式のテキストをNotion Blocksに変換
   * 簡易版：行ごとに変換（より高度な変換は後で改善可能）
   */
  private markdownToBlocks(markdown: string): any[] {
    const lines = markdown.split('\n');
    const blocks: any[] = [];
    let i = 0;

    while (i < lines.length) {
      const trimmedLine = lines[i].trim();
      
      if (!trimmedLine) {
        // 空行は空のparagraphブロックとして追加
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [],
          },
        });
        i++;
        continue;
      }

      // テーブルの検出（|で始まり|で終わる行）
      // 一旦無効化：テーブルは通常のテキストとして扱う
      // if (this.isTableRow(trimmedLine)) {
      //   const tableData = this.parseTable(lines, i);
      //   if (tableData.rows.length > 0) {
      //     blocks.push(this.createTableBlock(tableData.rows, tableData.hasHeader));
      //     i = tableData.nextIndex;
      //     continue;
      //   }
      // }

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
      i++;
    }

    return blocks;
  }

  /**
   * テーブル行かどうかを判定
   */
  private isTableRow(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2;
  }

  /**
   * テーブルセパレーター行かどうかを判定（|---| や |:---:| など）
   */
  private isTableSeparator(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
      return false;
    }
    // |---|---| や |:---:| のような形式を検出
    const content = trimmed.slice(1, -1);
    return /^[\s:|-]+$/.test(content);
  }

  /**
   * Markdownテーブルを解析して、テーブル行の配列を返す
   */
  private parseTable(lines: string[], startIndex: number): { rows: string[][], hasHeader: boolean, nextIndex: number } {
    const rows: string[][] = [];
    let hasHeader = false;
    let i = startIndex;
    let headerProcessed = false;

    while (i < lines.length) {
      const trimmedLine = lines[i].trim();
      
      if (!this.isTableRow(trimmedLine)) {
        // テーブル行でない場合は終了
        break;
      }

      // セパレーター行をスキップ
      if (this.isTableSeparator(trimmedLine)) {
        if (!headerProcessed && rows.length > 0) {
          hasHeader = true;
          headerProcessed = true;
        }
        i++;
        continue;
      }

      // テーブル行を解析
      const cells = this.parseTableRow(trimmedLine);
      rows.push(cells);
      i++;
    }

    return { rows, hasHeader, nextIndex: i };
  }

  /**
   * テーブル行を解析してセルの配列を返す
   */
  private parseTableRow(line: string): string[] {
    // 先頭と末尾の|を削除
    const content = line.trim().slice(1, -1);
    // |で分割してセルを取得
    const cells = content.split('|').map(cell => cell.trim());
    return cells;
  }

  /**
   * Notionテーブルブロックを作成
   */
  private createTableBlock(rows: string[][], hasHeader: boolean): any {
    if (rows.length === 0) {
      return {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [],
        },
      };
    }

    // 列数を取得（最初の行の列数を使用）
    const columnCount = rows[0].length;

    // テーブル行ブロックを作成
    const tableRows: any[] = rows.map((row) => {
      const cells = row.map(cell => {
        // cellsの各要素は配列である必要がある
        return [
          {
            type: 'text',
            text: {
              content: cell || '',
            },
          },
        ];
      });

      return {
        object: 'block',
        type: 'table_row',
        table_row: {
          cells: cells,
        },
      };
    });

    // テーブルブロック本体（最初のテーブル行をchildrenに含める）
    const tableBlock: any = {
      object: 'block',
      type: 'table',
      table: {
        table_width: columnCount,
        has_column_header: hasHeader,
        has_row_header: false,
        children: tableRows.length > 0 ? [tableRows[0]] : [], // 最初の行を含める
      },
    };

    // 残りのテーブル行（2行目以降）を返す
    const remainingRows = tableRows.slice(1);

    // テーブルブロックと残りのテーブル行を一緒に返す
    return {
      tableBlock,
      tableRows: remainingRows, // 残りの行のみ
    };
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

