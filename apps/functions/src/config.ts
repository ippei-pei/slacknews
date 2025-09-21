// システム設定ファイル
// 運用上制御が必要な設定値を管理

export interface SystemConfig {
  // テスト用設定
  test: {
    randomArticleCount: number;
    testCompanyId: string;
    testCategoryName: string;
    rssItemLimit: number;
    redditItemLimit: number;
  };
  
  // AI・翻訳設定
  ai: {
    model: string;
    maxTokens: number;
    temperature: number;
    apiWaitTime: number;
  };
  
  // スケジュール設定
  schedule: {
    collectionTime: string;
  };
  
  // 文字列処理設定
  text: {
    maxTitleLength: number;
    maxContentLength: number;
    maxSummaryLength: number;
  };
  
  // 時間設定
  time: {
    pastWeekDays: number;
  };
}

export const config: SystemConfig = {
  test: {
    randomArticleCount: 20,
    testCompanyId: 'TEST_RANDOM',
    testCategoryName: 'Google News Test Random',
    rssItemLimit: 5,
    redditItemLimit: 3,
  },
  
  ai: {
    model: 'gpt-4o-mini',
    maxTokens: 1000,
    temperature: 0.3,
    apiWaitTime: 1000,
  },
  
  schedule: {
    collectionTime: 'every day 09:00',
  },
  
  text: {
    maxTitleLength: 100,
    maxContentLength: 100,
    maxSummaryLength: 100,
  },
  
  time: {
    pastWeekDays: 7,
  },
};
