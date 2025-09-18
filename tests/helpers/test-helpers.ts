import { Page } from '@playwright/test';
import { TestCompany, TestNewsArticle } from '../test-data';

/**
 * テストヘルパー関数
 * 共通のテスト処理を提供
 */

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * バックエンド処理の結果を検証
   */
  async verifyBackendProcessing(articles: TestNewsArticle[]): Promise<void> {
    // 重複排除の確認
    await this.verifyDuplicateRemoval(articles);
    
    // 日本語翻訳の確認
    await this.verifyJapaneseTranslation(articles);
    
    // 要約の確認
    await this.verifySummarization(articles);
    
    // 重要度評価の確認
    await this.verifyImportanceScoring(articles);
    
    // ソース統合の確認
    await this.verifySourceIntegration(articles);
  }

  /**
   * 重複排除の検証
   */
  private async verifyDuplicateRemoval(articles: TestNewsArticle[]): Promise<void> {
    const titles = articles.map(article => article.title.toLowerCase());
    const uniqueTitles = new Set(titles);
    
    if (titles.length !== uniqueTitles.size) {
      throw new Error('Duplicate articles should be removed or merged');
    }
  }

  /**
   * 日本語翻訳の検証
   */
  private async verifyJapaneseTranslation(articles: TestNewsArticle[]): Promise<void> {
    for (const article of articles) {
      // 日本語文字が含まれているか確認
      const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(article.titleJp);
      if (!hasJapanese) {
        throw new Error(`Article title should be translated to Japanese: ${article.title}`);
      }
      
      if (article.summaryJp && !/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(article.summaryJp)) {
        throw new Error(`Article summary should be translated to Japanese: ${article.title}`);
      }
    }
  }

  /**
   * 要約の検証
   */
  private async verifySummarization(articles: TestNewsArticle[]): Promise<void> {
    for (const article of articles) {
      if (article.summaryJp && article.summaryJp.length > 200) {
        throw new Error(`Article summary should be within 200 characters: ${article.title}`);
      }
      
      if (article.newsSummaryJp && article.newsSummaryJp.length > 50) {
        throw new Error(`News summary should be within 50 characters: ${article.title}`);
      }
    }
  }

  /**
   * 重要度評価の検証
   */
  private async verifyImportanceScoring(articles: TestNewsArticle[]): Promise<void> {
    for (const article of articles) {
      if (article.importance < 0 || article.importance > 100) {
        throw new Error(`Importance score should be between 0-100: ${article.title}`);
      }
    }
  }

  /**
   * ソース統合の検証
   */
  private async verifySourceIntegration(articles: TestNewsArticle[]): Promise<void> {
    for (const article of articles) {
      if (!article.sourceUrls || article.sourceUrls.length === 0) {
        throw new Error(`Article should have source URLs: ${article.title}`);
      }
      
      for (const sourceUrl of article.sourceUrls) {
        if (!sourceUrl.url || !sourceUrl.title || !sourceUrl.source) {
          throw new Error(`Source URL should have complete information: ${article.title}`);
        }
      }
    }
  }

  /**
   * Slack配信形式の検証
   */
  async verifySlackDeliveryFormat(message: string, threadMessages: string[]): Promise<void> {
    // 本文投稿の確認
    await this.verifyMainMessageFormat(message);
    
    // スレッド投稿の確認
    await this.verifyThreadMessageFormat(threadMessages);
    
    // リンク形式の確認
    await this.verifyLinkFormat([message, ...threadMessages]);
    
    // 重要度スコア非表示の確認
    await this.verifyNoScoreDisplay([message, ...threadMessages]);
  }

  /**
   * 本文メッセージ形式の検証
   */
  private async verifyMainMessageFormat(message: string): Promise<void> {
    if (!message.includes('📊 競合情報レポート')) {
      throw new Error('Main message should contain report header');
    }
    
    if (!message.includes('件)')) {
      throw new Error('Main message should contain article count');
    }
    
    // 重要度上位10件の確認
    const linkMatches = message.match(/<[^|]+\|[^>]+>/g);
    if (linkMatches && linkMatches.length > 10) {
      throw new Error('Main message should contain maximum 10 articles');
    }
  }

  /**
   * スレッドメッセージ形式の検証
   */
  private async verifyThreadMessageFormat(threadMessages: string[]): Promise<void> {
    if (threadMessages.length === 0) {
      throw new Error('Thread should contain remaining articles');
    }
    
    for (const message of threadMessages) {
      if (!/<[^|]+\|[^>]+>/.test(message)) {
        throw new Error('Thread messages should contain links');
      }
    }
  }

  /**
   * リンク形式の検証
   */
  private async verifyLinkFormat(messages: string[]): Promise<void> {
    for (const message of messages) {
      const linkMatches = message.match(/<[^|]+\|[^>]+>/g);
      if (linkMatches) {
        for (const link of linkMatches) {
          if (!link.includes('http')) {
            throw new Error('Links should contain valid URLs');
          }
        }
      }
    }
  }

  /**
   * 重要度スコア非表示の検証
   */
  private async verifyNoScoreDisplay(messages: string[]): Promise<void> {
    for (const message of messages) {
      if (/\d+点/.test(message) || /\d+pt/.test(message)) {
        throw new Error('Importance scores should not be displayed in messages');
      }
    }
  }

  /**
   * エラーハンドリングの検証
   */
  async verifyErrorHandling(errorMessage: string, mentionUser: string): Promise<void> {
    if (!errorMessage || errorMessage.trim() === '') {
      throw new Error('Error message should be provided');
    }
    
    if (!mentionUser || !mentionUser.startsWith('@')) {
      throw new Error('Error mention should include user with @ prefix');
    }
  }

  /**
   * レスポンス時間の測定
   */
  async measureResponseTime(action: () => Promise<void>): Promise<number> {
    const startTime = Date.now();
    await action();
    const endTime = Date.now();
    return endTime - startTime;
  }

  /**
   * レスポンス時間の検証
   */
  async verifyResponseTime(responseTime: number, maxTime: number = 30000): Promise<void> {
    if (responseTime > maxTime) {
      throw new Error(`Response time ${responseTime}ms exceeds maximum ${maxTime}ms`);
    }
  }

  /**
   * データベース整合性の検証
   */
  async verifyDatabaseIntegrity(): Promise<void> {
    // データベースの状態を確認
    const dbStatus = await this.page.evaluate(() => {
      return window.localStorage.getItem('db-integrity-status');
    });
    
    if (dbStatus !== 'ok') {
      throw new Error('Database integrity check failed');
    }
  }
}
