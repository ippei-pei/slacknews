"use strict";
// システム設定ファイル
// 運用上制御が必要な設定値を管理
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.config = {
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
//# sourceMappingURL=config.js.map