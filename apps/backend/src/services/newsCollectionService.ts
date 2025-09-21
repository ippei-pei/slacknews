import Parser from 'rss-parser';
import { v4 as uuid } from 'uuid';
import { CompanyService } from './companyService.js';
import { LlmService } from './llmService.js';
import { DuplicateDetectionService, ArticleForDuplicateCheck } from './duplicateDetectionService.js';
import { ErrorNotificationService } from './errorNotificationService.js';
import { NewsRepository } from '../repositories/newsRepository.js';
import { CollectionOptions, CollectionLog, NewsArticle } from '../domain/types.js';
import { logger } from '../logger.js';
import { AppConfig } from '../config/env.js';
import { SlackClient } from '../clients/slack.js';

interface RawArticle {
  companyId: string;
  title: string;
  link: string;
  contentSnippet: string;
  publishedAt?: string;
  source: string;
}

export class NewsCollectionService {
  private parser = new Parser({ timeout: 15000 });
  private duplicateDetectionService: DuplicateDetectionService;
  private errorNotificationService: ErrorNotificationService;

  constructor(
    private readonly companyService: CompanyService,
    private readonly llmService: LlmService,
    private readonly newsRepository: NewsRepository,
    private readonly config: AppConfig,
    private readonly slackClient: SlackClient,
    private readonly settingsService: any // SettingsService型を後で修正
  ) {
    this.duplicateDetectionService = new DuplicateDetectionService(config);
    this.errorNotificationService = new ErrorNotificationService(slackClient, settingsService);
  }

  async collect(options: CollectionOptions = {}) {
    const companies = await this.resolveCompanies(options.companyIds);

    const collectionResults: CollectionLog[] = [];
    const processedArticles: NewsArticle[] = [];
    const rawArticles: RawArticle[] = [];

    for (const company of companies) {
      const startedAt = new Date();
      let articlesFetched = 0;
      try {
        const rssArticles = await this.collectRssArticles(company.id, company.name, company.rssUrls);
        rawArticles.push(...rssArticles);
        articlesFetched += rssArticles.length;

        // 重複排除処理
        const duplicateCheckArticles: ArticleForDuplicateCheck[] = rssArticles.map(article => ({
          id: uuid(),
          title: article.title,
          contentSnippet: article.contentSnippet,
          url: article.link,
          companyId: company.id
        }));

        const duplicateGroups = await this.duplicateDetectionService.detectDuplicates(duplicateCheckArticles);
        const mergedArticles = await this.duplicateDetectionService.mergeDuplicateArticles(duplicateGroups);

        // 重複排除後の記事でLLM処理を実行
        const llmInputs = mergedArticles.map(article => ({
          companyName: company.name,
          title: article.title,
          link: article.url,
          contentSnippet: article.contentSnippet,
          publishedAt: rssArticles.find(r => r.link === article.url)?.publishedAt,
          context: undefined
        }));

        const llmOutputs = await this.llmService.processBatchArticles(llmInputs);

        for (let i = 0; i < mergedArticles.length; i++) {
          const article = mergedArticles[i];
          const llmOutput = llmOutputs[i];

          // 元記事の情報を取得
          const originalArticle = rssArticles.find(r => r.link === article.url);
          
          processedArticles.push({
            id: article.id,
            companyId: company.id,
            titleOriginal: article.title,
            titleJp: llmOutput.titleJp,
            summaryJp: llmOutput.summaryJp,
            newsSummaryJp: llmOutput.newsSummaryJp,
            importance: llmOutput.importance,
            categories: llmOutput.categories,
            publishedAt: originalArticle?.publishedAt ? new Date(originalArticle.publishedAt) : new Date(),
            sourceLinks: [
              {
                url: article.url,
                title: article.title,
                source: company.name
              }
            ],
            llmVersion: llmOutput.llmVersion,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }

        collectionResults.push({
          id: uuid(),
          companyId: company.id,
          status: 'success',
          articlesFetched,
          startedAt,
          completedAt: new Date()
        } as CollectionLog);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ err: error, companyId: company.id }, 'News collection failed');
        
        collectionResults.push({
          id: uuid(),
          companyId: company.id,
          status: 'failed',
          articlesFetched,
          errorCode: 'COLLECTION_ERROR',
          errorMessage,
          startedAt,
          completedAt: new Date()
        });

        // エラー通知を送信
        await this.errorNotificationService.sendErrorNotification({
          errorType: 'COLLECTION_ERROR',
          errorMessage: `企業「${company.name}」のニュース収集に失敗しました: ${errorMessage}`,
          errorDetails: { companyId: company.id, articlesFetched },
          context: { 
            companyId: company.id, 
            companyName: company.name,
            operation: 'news_collection'
          }
        });
      }
    }

    if (rawArticles.length) {
      await this.newsRepository.saveRawArticles(rawArticles);
    }
    if (processedArticles.length) {
      await this.newsRepository.saveNewsArticles(processedArticles);
    }

    for (const log of collectionResults) {
      await this.newsRepository.appendCollectionLog(log);
    }

    return {
      companiesProcessed: companies.length,
      articlesCollected: rawArticles.length,
      articlesProcessed: processedArticles.length,
      results: collectionResults
    };
  }

  private async resolveCompanies(companyIds?: string[]) {
    if (companyIds?.length) {
      const companies = await Promise.all(companyIds.map((id) => this.companyService.getById(id)));
      return companies.filter((c): c is NonNullable<typeof c> => Boolean(c));
    }
    return this.companyService.listActiveCompanies();
  }

  private async collectRssArticles(companyId: string, companyName: string, rssUrls: string[]): Promise<RawArticle[]> {
    const results: RawArticle[] = [];
    for (const url of rssUrls ?? []) {
      try {
        const feed = await this.parser.parseURL(url);
        for (const item of feed.items ?? []) {
          if (!item.title || !item.link) continue;
          results.push({
            companyId,
            title: item.title,
            link: item.link,
            contentSnippet: item.contentSnippet ?? item.content ?? '',
            publishedAt: item.isoDate ?? item.pubDate,
            source: companyName
          });
        }
      } catch (error) {
        logger.warn({ err: error, companyId, url }, 'Failed to fetch RSS');
      }
    }
    return results;
  }
}

