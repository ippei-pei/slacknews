import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Slackモックページクラス
 * Slack配信内容の確認をテスト
 */
export class SlackMockPage extends BasePage {
  private get channelMessages(): Locator {
    return this.page.locator('[data-testid="channel-messages"]');
  }

  private get messageItem(): Locator {
    return this.page.locator('[data-testid="message-item"]');
  }

  private get threadMessages(): Locator {
    return this.page.locator('[data-testid="thread-messages"]');
  }

  private get threadMessageItem(): Locator {
    return this.page.locator('[data-testid="thread-message-item"]');
  }

  private get mentionNotification(): Locator {
    return this.page.locator('[data-testid="mention-notification"]');
  }

  constructor(page: Page) {
    super(page);
  }

  async navigateToSlackChannel(channelName: string): Promise<void> {
    await this.page.goto(`/slack-mock/${channelName}`);
    await this.channelMessages.waitFor({ state: 'visible' });
  }

  async getLatestMessage(): Promise<string> {
    const latestMessage = this.messageItem.first();
    await latestMessage.waitFor({ state: 'visible' });
    return await latestMessage.textContent() || '';
  }

  async getMessageCount(): Promise<number> {
    await this.messageItem.first().waitFor({ state: 'visible' });
    return await this.messageItem.count();
  }

  async verifyDailyReportFormat(message: string): Promise<void> {
    // 日次レポート形式の確認
    if (!message.includes('📊 競合情報レポート')) {
      throw new Error('Daily report format is incorrect - missing report header');
    }
    
    if (!message.includes('件)')) {
      throw new Error('Daily report format is incorrect - missing article count');
    }
  }

  async verifyWeeklyReportFormat(message: string): Promise<void> {
    // 週次レポート形式の確認
    if (!message.includes('📈 週次戦略分析レポート')) {
      throw new Error('Weekly report format is incorrect - missing report header');
    }
    
    if (!message.includes('基本戦略:') || !message.includes('変更点:')) {
      throw new Error('Weekly report format is incorrect - missing strategy sections');
    }
  }

  async verifyTop10ArticlesInMainMessage(message: string): Promise<void> {
    // 本文に重要度上位10件が含まれているか確認
    const linkMatches = message.match(/<[^|]+\|[^>]+>/g);
    if (!linkMatches || linkMatches.length > 10) {
      throw new Error('Main message should contain maximum 10 articles');
    }
  }

  async verifyThreadMessages(): Promise<void> {
    await this.threadMessages.waitFor({ state: 'visible' });
    const threadCount = await this.threadMessageItem.count();
    
    if (threadCount === 0) {
      throw new Error('Thread messages should contain remaining articles');
    }
  }

  async verifyJapaneseContent(message: string): Promise<void> {
    // 日本語文字が含まれているか確認
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(message);
    if (!hasJapanese) {
      throw new Error('Content should be translated to Japanese');
    }
  }

  async verifySourceLinks(message: string): Promise<void> {
    // ソースリンクが含まれているか確認
    const hasLinks = /<https?:\/\/[^|]+\|[^>]+>/.test(message);
    if (!hasLinks) {
      throw new Error('Message should contain source links');
    }
  }

  async verifyErrorMention(user: string): Promise<void> {
    await this.mentionNotification.waitFor({ state: 'visible' });
    const mentionText = await this.mentionNotification.textContent();
    
    if (!mentionText?.includes(user)) {
      throw new Error(`Error mention should include user ${user}`);
    }
  }

  async verifyNoImportanceScoreDisplay(message: string): Promise<void> {
    // 重要度スコアが表示されていないか確認
    if (/\d+点/.test(message) || /\d+pt/.test(message)) {
      throw new Error('Importance scores should not be displayed in messages');
    }
  }

  async verifyDuplicateRemoval(messages: string[]): Promise<void> {
    // 重複記事が排除されているか確認
    const titles = messages.map(msg => {
      const match = msg.match(/【[^】]+】([^-]+)/);
      return match ? match[1].trim() : '';
    }).filter(title => title !== '');
    
    const uniqueTitles = new Set(titles);
    if (titles.length !== uniqueTitles.size) {
      throw new Error('Duplicate articles should be removed');
    }
  }
}
