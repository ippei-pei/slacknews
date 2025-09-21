export interface Company {
  id: string;
  name: string;
  urls: string[];
  rssUrls: string[];
  redditUrls: string[];
  snsAccounts?: {
    twitter?: {
      username: string;
      userId: string;
      verified: boolean;
    };
    linkedin?: {
      companyId: string;
      profileUrl: string;
    };
  };
  priority: number;
  category?: string;
  country?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollectionLog {
  id: string;
  companyId: string;
  status: 'success' | 'partial' | 'failed';
  articlesFetched: number;
  llmTokens?: number;
  errorCode?: string;
  errorMessage?: string;
  startedAt: Date;
  completedAt: Date;
}

export interface NewsArticleSourceLink {
  url: string;
  title: string;
  source: string;
}

export interface NewsArticle {
  id: string;
  companyId: string;
  titleOriginal: string;
  titleJp: string;
  summaryJp: string;
  newsSummaryJp: string;
  importance: number;
  categories: string[];
  publishedAt: Date;
  sourceLinks: NewsArticleSourceLink[];
  llmVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliveryLog {
  id: string;
  reportType: 'daily' | 'weekly';
  channelId: string;
  channelName: string;
  threadCount: number;
  articlesDelivered: number;
  status: 'success' | 'failed';
  errorCode?: string;
  errorMessage?: string;
  startedAt: Date;
  completedAt: Date;
}

export interface SlackSettings {
  channelId: string;
  channelName: string;
  threadStrategy: 'top10-main-rest-thread';
  updatedAt: Date;
  updatedBy?: string;
}

export interface ErrorNotificationSettings {
  mentionUser: string;
  fallbackChannelId?: string;
  updatedAt: Date;
  updatedBy?: string;
}

export interface CollectionOptions {
  companyIds?: string[];
  force?: boolean;
}

export interface ReportOptions {
  companyIds?: string[];
  overrideChannelId?: string;
}

