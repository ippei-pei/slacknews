import { randomUUID } from 'crypto';
import { SettingsService } from './settingsService.js';
import { NewsRepository } from '../repositories/newsRepository.js';
import { SlackClient } from '../clients/slack.js';
import { ErrorNotificationService } from './errorNotificationService.js';
import { ReportOptions, DeliveryLog } from '../domain/types.js';
import { logger } from '../logger.js';

interface ReportResult {
  channelId: string;
  channelName: string;
  messageTs?: string;
  threadCount: number;
  articlesDelivered: number;
  reportType: 'daily' | 'weekly';
  formattedMessages: {
    main: string;
    threads: string[];
  };
}

export class ReportService {
  private errorNotificationService: ErrorNotificationService;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly newsRepository: NewsRepository,
    private readonly slackClient: SlackClient
  ) {
    this.errorNotificationService = new ErrorNotificationService(slackClient, settingsService);
  }

  async sendDailyReport(options: ReportOptions = {}): Promise<ReportResult> {
    const slackSettings = await this.settingsService.getSlackSettings();
    if (!slackSettings && !options.overrideChannelId) {
      throw new Error('Slack settings are not configured');
    }

    const channelId = options.overrideChannelId ?? slackSettings!.channelId;
    const channelName = slackSettings?.channelName ?? 'override-channel';

    const articles = await this.newsRepository.listNewsArticles({
      companyIds: options.companyIds,
      limit: 50
    });

    if (!articles.length) {
      throw new Error('配信対象の記事がありません');
    }

    const sorted = [...articles].sort((a, b) => b.importance - a.importance);
    const mainArticles = sorted.slice(0, 10);
    const restArticles = sorted.slice(10);

    const mainMessageLines = [`📊 競合情報レポート (${articles.length}件)`, ''];
    mainArticles.forEach((article, index) => {
      const link = article.sourceLinks[0]?.url ?? '#';
      mainMessageLines.push(`${index + 1}. <${link}|${article.newsSummaryJp}>`);
    });

    const threadMessages = restArticles.map((article, index) => {
      const link = article.sourceLinks[0]?.url ?? '#';
      return `${index + mainArticles.length + 1}. <${link}|${article.newsSummaryJp}>`;
    });

    const formatted = {
      main: mainMessageLines.join('\n'),
      threads: threadMessages
    };

    const startedAt = new Date();
    let messageTs: string | undefined;
    let threadCount = 0;

    try {
      const mainResponse = await this.slackClient.postMessage({
        channel: channelId,
        text: formatted.main
      });

      if (!mainResponse?.ok) {
        throw new Error(`Slack投稿に失敗しました: ${mainResponse?.error || 'unknown_error'}`);
      }

      messageTs = mainResponse.ts;
      for (const threadMessage of formatted.threads) {
        const response = await this.slackClient.postMessage({
          channel: channelId,
          text: threadMessage,
          threadTs: messageTs
        });
        if (!response?.ok) {
          throw new Error(`Slackスレッド投稿に失敗しました: ${response?.error || 'unknown_error'}`);
        }
        threadCount += 1;
      }

      await this.newsRepository.appendDeliveryLog({
        id: randomUUID(),
        reportType: 'daily',
        channelId,
        channelName,
        threadCount,
        articlesDelivered: articles.length,
        status: 'success',
        startedAt,
        completedAt: new Date()
      });

      return {
        channelId,
        channelName,
        messageTs,
        threadCount,
        articlesDelivered: articles.length,
        reportType: 'daily',
        formattedMessages: formatted
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await this.newsRepository.appendDeliveryLog({
        id: randomUUID(),
        reportType: 'daily',
        channelId,
        channelName,
        threadCount,
        articlesDelivered: articles.length,
        status: 'failed',
        errorCode: 'SLACK_API_ERROR',
        errorMessage,
        startedAt,
        completedAt: new Date()
      });

      // エラー通知を送信
      await this.errorNotificationService.sendErrorNotification({
        errorType: 'SLACK_ERROR',
        errorMessage: `日次レポート配信に失敗しました: ${errorMessage}`,
        errorDetails: { channelId, channelName, articleCount: articles.length },
        context: { operation: 'daily_report' }
      });

      throw error instanceof Error ? error : new Error('日次レポート配信に失敗しました');
    }
  }

  async sendWeeklyReport(options: ReportOptions = {}): Promise<ReportResult> {
    const slackSettings = await this.settingsService.getSlackSettings();
    if (!slackSettings && !options.overrideChannelId) {
      throw new Error('Slack settings are not configured');
    }

    const channelId = options.overrideChannelId ?? slackSettings!.channelId;
    const channelName = slackSettings?.channelName ?? 'override-channel';

    const articles = await this.newsRepository.listNewsArticles({
      companyIds: options.companyIds,
      limit: 100
    });

    if (!articles.length) {
      throw new Error('配信対象の記事がありません');
    }

    const grouped = new Map<string, typeof articles>();
    for (const article of articles) {
      const arr = grouped.get(article.companyId) ?? [];
      arr.push(article);
      grouped.set(article.companyId, arr);
    }

    const lines = ['📈 週次戦略分析レポート', '今週の主要トピックと競合比較をまとめました。'];

    for (const [companyId, companyArticles] of grouped.entries()) {
      const top = companyArticles[0];
      lines.push(`\n🏢 [${companyId}]`);
      lines.push(`基本戦略: ${top?.summaryJp.slice(0, 60)}...`);
      lines.push(`変更点: ${companyArticles.length}件の更新が確認されました。`);
      lines.push(`ニュースサマリ: ${top?.newsSummaryJp}`);
      lines.push(`競合比較: ${companyArticles.length}件のニュースを分析。`);
      lines.push(`参考リンク: <${top?.sourceLinks[0]?.url ?? '#'}|${top?.titleJp}>`);
    }

    const formatted = {
      main: lines.join('\n'),
      threads: [] as string[]
    };

    const startedAt = new Date();

    try {
      const response = await this.slackClient.postMessage({
        channel: channelId,
        text: formatted.main
      });
      if (!response?.ok) {
        throw new Error(`Slack投稿に失敗しました: ${response?.error || 'unknown_error'}`);
      }

      await this.newsRepository.appendDeliveryLog({
        id: randomUUID(),
        reportType: 'weekly',
        channelId,
        channelName,
        threadCount: 0,
        articlesDelivered: articles.length,
        status: 'success',
        startedAt,
        completedAt: new Date()
      });

      return {
        channelId,
        channelName,
        messageTs: response.ts,
        threadCount: 0,
        articlesDelivered: articles.length,
        reportType: 'weekly',
        formattedMessages: formatted
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await this.newsRepository.appendDeliveryLog({
        id: randomUUID(),
        reportType: 'weekly',
        channelId,
        channelName,
        threadCount: 0,
        articlesDelivered: articles.length,
        status: 'failed',
        errorCode: 'SLACK_API_ERROR',
        errorMessage,
        startedAt,
        completedAt: new Date()
      });

      // エラー通知を送信
      await this.errorNotificationService.sendErrorNotification({
        errorType: 'SLACK_ERROR',
        errorMessage: `週次レポート配信に失敗しました: ${errorMessage}`,
        errorDetails: { channelId, channelName, articleCount: articles.length },
        context: { operation: 'weekly_report' }
      });

      throw error instanceof Error ? error : new Error('週次レポート配信に失敗しました');
    }
  }
}
