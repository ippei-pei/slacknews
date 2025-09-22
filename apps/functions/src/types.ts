// 企業情報の型定義
export interface Company {
  id: string;
  name: string;
  url: string;
  rssUrl?: string;
  redditUrl?: string;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ニュース記事の型定義
export interface NewsArticle {
  id: string;
  companyId: string;
  title: string;
  content: string;
  url: string;
  publishedAt: Date;
  importance: number;
  category: string;
  summary: string;
  translatedTitle?: string;
  translatedContent?: string;
  translatedSummary?: string;
  isDeliveryTarget: boolean;
  isTranslated: boolean;
  informationAcquisitionDate: Date; // 情報取得日
  deliveryDate?: Date; // 配信日（配信対象のみ）
  deliveryStatus: 'pending' | 'delivered' | 'failed'; // 配信ステータス
  createdAt: Date;
}

// Slack設定の型定義
export interface SlackSettings {
  channelName: string;           // 表示用
  channelId?: string;            // chat.postMessage 用
  deliveryMentionUserId?: string; // 配信時に先頭へ付与（任意）
  errorMentionUserId?: string;   // 例: U123ABCDEF（<@...>でメンション）
  // スケジュール投稿設定
  dailyReportTime?: string;      // 日次レポート投稿時間 (HH:MM形式、JST)
  weeklyReportTime?: string;     // 週次レポート投稿時間 (HH:MM形式、JST)
  weeklyReportDay?: number;      // 週次レポート投稿曜日 (0=日曜日、1=月曜日、...、6=土曜日)
  updatedAt: Date;
}

// RSSアイテムの型定義
export interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

// 週次レポート生成用の型定義
export interface WeeklyReportData {
  competitorSummary: string;
  companySummaries: { company: string; summary: string }[];
  strategicAction: string;
}
