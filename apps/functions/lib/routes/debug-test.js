"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugTest = void 0;
const https_1 = require("firebase-functions/v2/https");
const context_1 = require("../context");
const rss_1 = require("../utils/rss");
const config_1 = require("../config");
// デバッグ用テストAPI - 各段階を個別にテスト
exports.debugTest = (0, https_1.onRequest)({
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [context_1.webAppUrl]
}, async (req, res) => {
    try {
        const { stage } = req.body || {};
        context_1.logger.info(`[DebugTest] Starting debug test for stage: ${stage}`);
        switch (stage) {
            case 'rss':
                return await testRSSFetch(res);
            case 'parse':
                return await testRSSParsing(res);
            case 'db':
                return await testDBSave(res);
            case 'dedup':
                return await testDeduplication(res);
            default:
                return await testAllStages(res);
        }
    }
    catch (error) {
        context_1.logger.error("[DebugTest] Debug test failed:", error);
        res.status(500).json({
            success: false,
            error: "デバッグテストに失敗しました",
            details: error instanceof Error ? error.message : String(error)
        });
    }
});
// RSS取得テスト
async function testRSSFetch(res) {
    context_1.logger.info('[DebugTest] Testing RSS fetch');
    // 複数のRSSフィードをテスト
    const testUrls = [
        'https://feeds.bbci.co.uk/news/technology/rss.xml',
        'https://rss.cnn.com/rss/edition_technology.rss',
        'https://news.google.com/rss/search?q=technology&hl=en-US&gl=US&ceid=US:en'
    ];
    const results = [];
    for (const url of testUrls) {
        try {
            context_1.logger.info(`[DebugTest] Testing URL: ${url}`);
            const response = await fetch(url);
            context_1.logger.info(`[DebugTest] Response status for ${url}: ${response.status}`);
            if (response.ok) {
                const xml = await response.text();
                context_1.logger.info(`[DebugTest] XML length for ${url}: ${xml.length} chars`);
                results.push({
                    url,
                    status: response.status,
                    xmlLength: xml.length,
                    success: true
                });
            }
            else {
                results.push({
                    url,
                    status: response.status,
                    error: `HTTP ${response.status}: ${response.statusText}`,
                    success: false
                });
            }
        }
        catch (error) {
            context_1.logger.error(`[DebugTest] Error fetching ${url}:`, error);
            results.push({
                url,
                error: error instanceof Error ? error.message : String(error),
                success: false
            });
        }
    }
    res.json({
        success: true,
        message: 'RSS取得テスト完了',
        data: { results }
    });
}
// RSS解析テスト
async function testRSSParsing(res) {
    var _a;
    context_1.logger.info('[DebugTest] Testing RSS parsing');
    try {
        const url = 'https://news.google.com/rss/search?q=technology&hl=en-US&gl=US&ceid=US:en';
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        const xml = await response.text();
        context_1.logger.info(`[DebugTest] XML length: ${xml.length} chars`);
        const items = (0, rss_1.parseRSSFeed)(xml);
        context_1.logger.info(`[DebugTest] Parsed ${items.length} items`);
        const firstItem = items.length > 0 ? items[0] : null;
        res.json({
            success: true,
            message: 'RSS解析テスト完了',
            data: {
                xmlLength: xml.length,
                itemCount: items.length,
                firstItem: firstItem ? {
                    title: firstItem.title,
                    link: firstItem.link,
                    description: (_a = firstItem.description) === null || _a === void 0 ? void 0 : _a.substring(0, 100),
                    pubDate: firstItem.pubDate
                } : null
            }
        });
    }
    catch (error) {
        context_1.logger.error('[DebugTest] RSS parsing failed:', error);
        res.status(500).json({
            success: false,
            error: 'RSS解析テストに失敗しました',
            details: error instanceof Error ? error.message : String(error)
        });
    }
}
// DB保存テスト
async function testDBSave(res) {
    context_1.logger.info('[DebugTest] Testing DB save');
    try {
        const testArticle = {
            companyId: config_1.config.test.testCompanyId,
            title: 'Test Article - Debug',
            content: 'This is a test article for debugging purposes.',
            url: `https://test.com/debug-${Date.now()}`,
            publishedAt: new Date(),
            importance: 3,
            category: config_1.config.test.testCategoryName,
            summary: 'Test summary',
            isDeliveryTarget: true,
            isTranslated: false,
            informationAcquisitionDate: new Date(),
            deliveryStatus: 'pending',
            createdAt: new Date()
        };
        context_1.logger.info('[DebugTest] Saving test article to Firestore...');
        const docRef = await context_1.db.collection('news').add(testArticle);
        context_1.logger.info(`[DebugTest] Successfully saved with ID: ${docRef.id}`);
        res.json({
            success: true,
            message: 'DB保存テスト完了',
            data: {
                articleId: docRef.id,
                article: testArticle
            }
        });
    }
    catch (error) {
        context_1.logger.error('[DebugTest] DB save failed:', error);
        res.status(500).json({
            success: false,
            error: 'DB保存テストに失敗しました',
            details: error instanceof Error ? error.message : String(error)
        });
    }
}
// 重複排除テスト
async function testDeduplication(res) {
    context_1.logger.info('[DebugTest] Testing deduplication');
    try {
        // 既存記事の確認
        const existing = await context_1.db.collection('news')
            .where('category', '==', config_1.config.test.testCategoryName)
            .get();
        context_1.logger.info(`[DebugTest] Found ${existing.docs.length} existing articles`);
        const existingUrls = new Set();
        existing.docs.forEach(d => {
            const data = d.data();
            if (data.url) {
                existingUrls.add(data.url);
            }
        });
        context_1.logger.info(`[DebugTest] Found ${existingUrls.size} existing URLs`);
        res.json({
            success: true,
            message: '重複排除テスト完了',
            data: {
                totalArticles: existing.docs.length,
                uniqueUrls: existingUrls.size,
                sampleUrls: Array.from(existingUrls).slice(0, 5)
            }
        });
    }
    catch (error) {
        context_1.logger.error('[DebugTest] Deduplication test failed:', error);
        res.status(500).json({
            success: false,
            error: '重複排除テストに失敗しました',
            details: error instanceof Error ? error.message : String(error)
        });
    }
}
// 全段階テスト
async function testAllStages(res) {
    context_1.logger.info('[DebugTest] Testing all stages');
    const results = {
        rss: null,
        parse: null,
        db: null,
        dedup: null
    };
    try {
        // 1. RSS取得
        context_1.logger.info('[DebugTest] Stage 1: RSS fetch');
        const rssRes = { json: (data) => { results.rss = data; } };
        await testRSSFetch(rssRes);
        // 2. RSS解析
        context_1.logger.info('[DebugTest] Stage 2: RSS parsing');
        const parseRes = { json: (data) => { results.parse = data; } };
        await testRSSParsing(parseRes);
        // 3. 重複排除
        context_1.logger.info('[DebugTest] Stage 3: Deduplication');
        const dedupRes = { json: (data) => { results.dedup = data; } };
        await testDeduplication(dedupRes);
        // 4. DB保存（1件のみテスト）
        context_1.logger.info('[DebugTest] Stage 4: DB save');
        const dbRes = { json: (data) => { results.db = data; } };
        await testDBSave(dbRes);
        res.json({
            success: true,
            message: '全段階テスト完了',
            data: results
        });
    }
    catch (error) {
        context_1.logger.error('[DebugTest] All stages test failed:', error);
        res.status(500).json({
            success: false,
            error: '全段階テストに失敗しました',
            details: error instanceof Error ? error.message : String(error),
            partialResults: results
        });
    }
}
//# sourceMappingURL=debug-test.js.map