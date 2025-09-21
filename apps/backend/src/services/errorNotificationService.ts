import { SlackClient } from '../clients/slack.js';
import { SettingsService } from './settingsService.js';
import { logger } from '../logger.js';

export interface ErrorNotificationOptions {
  errorType: 'COLLECTION_ERROR' | 'LLM_ERROR' | 'SLACK_ERROR' | 'DATABASE_ERROR' | 'GENERAL_ERROR';
  errorMessage: string;
  errorDetails?: any;
  context?: {
    companyId?: string;
    companyName?: string;
    articleCount?: number;
    operation?: string;
  };
}

export class ErrorNotificationService {
  constructor(
    private readonly slackClient: SlackClient,
    private readonly settingsService: SettingsService
  ) {}

  async sendErrorNotification(options: ErrorNotificationOptions): Promise<void> {
    try {
      const settings = await this.settingsService.getSettings();
      const errorNotificationUsers = settings?.errorNotificationUsers || [];

      if (errorNotificationUsers.length === 0) {
        logger.warn('No error notification users configured');
        return;
      }

      const errorMessage = this.formatErrorMessage(options);
      const channelId = settings?.slackSettings?.channelId;

      if (!channelId) {
        logger.warn('No Slack channel configured for error notifications');
        return;
      }

      // エラー通知ユーザーにメンション付きで送信
      const mentions = errorNotificationUsers.map(user => `<@${user}>`).join(' ');
      const fullMessage = `${mentions}\n\n${errorMessage}`;

      await this.slackClient.postMessage({
        channel: channelId,
        text: fullMessage,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: fullMessage
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `エラー種別: ${options.errorType} | 時刻: ${new Date().toLocaleString('ja-JP')}`
              }
            ]
          }
        ]
      });

      logger.info({ 
        errorType: options.errorType, 
        notifiedUsers: errorNotificationUsers.length 
      }, 'Error notification sent successfully');

    } catch (error) {
      logger.error({ err: error, options }, 'Failed to send error notification');
    }
  }

  private formatErrorMessage(options: ErrorNotificationOptions): string {
    const { errorType, errorMessage, errorDetails, context } = options;

    let message = `🚨 *SlackNews システムエラー* 🚨\n\n`;
    
    // エラー種別に応じたアイコンと説明
    switch (errorType) {
      case 'COLLECTION_ERROR':
        message += `📰 *情報収集エラー*\n`;
        message += `競合企業のニュース収集中にエラーが発生しました。\n\n`;
        break;
      case 'LLM_ERROR':
        message += `🤖 *AI分析エラー*\n`;
        message += `記事の分析・翻訳処理中にエラーが発生しました。\n\n`;
        break;
      case 'SLACK_ERROR':
        message += `📤 *Slack配信エラー*\n`;
        message += `レポート配信中にエラーが発生しました。\n\n`;
        break;
      case 'DATABASE_ERROR':
        message += `💾 *データベースエラー*\n`;
        message += `データの保存・取得中にエラーが発生しました。\n\n`;
        break;
      case 'GENERAL_ERROR':
        message += `⚠️ *システムエラー*\n`;
        message += `システムで予期しないエラーが発生しました。\n\n`;
        break;
    }

    message += `*エラー詳細:*\n`;
    message += `\`\`\`${errorMessage}\`\`\`\n\n`;

    if (context) {
      message += `*コンテキスト:*\n`;
      if (context.companyName) {
        message += `• 対象企業: ${context.companyName}\n`;
      }
      if (context.operation) {
        message += `• 操作: ${context.operation}\n`;
      }
      if (context.articleCount !== undefined) {
        message += `• 処理記事数: ${context.articleCount}\n`;
      }
      message += `\n`;
    }

    if (errorDetails) {
      message += `*詳細情報:*\n`;
      message += `\`\`\`${JSON.stringify(errorDetails, null, 2)}\`\`\`\n\n`;
    }

    message += `*対処方法:*\n`;
    message += `1. システム管理者に連絡してください\n`;
    message += `2. 必要に応じて手動で情報収集を実行してください\n`;
    message += `3. エラーが継続する場合は、設定を確認してください\n`;

    return message;
  }

  async sendRecoveryNotification(recoveryMessage: string): Promise<void> {
    try {
      const settings = await this.settingsService.getSettings();
      const errorNotificationUsers = settings?.errorNotificationUsers || [];

      if (errorNotificationUsers.length === 0) {
        return;
      }

      const mentions = errorNotificationUsers.map(user => `<@${user}>`).join(' ');
      const fullMessage = `${mentions}\n\n✅ *SlackNews システム復旧* ✅\n\n${recoveryMessage}`;

      const channelId = settings?.slackSettings?.channelId;
      if (!channelId) return;

      await this.slackClient.postMessage({
        channel: channelId,
        text: fullMessage
      });

      logger.info('Recovery notification sent successfully');
    } catch (error) {
      logger.error({ err: error }, 'Failed to send recovery notification');
    }
  }
}
