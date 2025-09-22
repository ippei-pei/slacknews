"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.simpleTest = void 0;
const https_1 = require("firebase-functions/v2/https");
const context_1 = require("../context");
// シンプルなテストAPI
exports.simpleTest = (0, https_1.onRequest)({
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [context_1.webAppUrl]
}, async (req, res) => {
    try {
        context_1.logger.info('[SimpleTest] Starting simple test');
        // 基本的なfetchテスト（BBC Newsでテスト）
        context_1.logger.info('[SimpleTest] Testing fetch to BBC News');
        const response = await fetch('http://feeds.bbci.co.uk/news/technology/rss.xml');
        context_1.logger.info(`[SimpleTest] Response status: ${response.status}`);
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        const xml = await response.text();
        context_1.logger.info(`[SimpleTest] XML length: ${xml.length} chars`);
        // 簡易的なRSS解析
        const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
        context_1.logger.info(`[SimpleTest] Found ${itemMatches.length} items`);
        let firstItemTitle = 'Not found';
        if (itemMatches.length > 0) {
            const firstItem = itemMatches[0];
            if (firstItem) {
                const titleMatch = firstItem.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                    firstItem.match(/<title>(.*?)<\/title>/);
                const linkMatch = firstItem.match(/<link>(.*?)<\/link>/);
                firstItemTitle = titleMatch ? titleMatch[1] : 'Not found';
                context_1.logger.info(`[SimpleTest] First item title: ${firstItemTitle}`);
                context_1.logger.info(`[SimpleTest] First item link: ${linkMatch ? linkMatch[1] : 'Not found'}`);
            }
        }
        res.json({
            success: true,
            message: 'シンプルテストが完了しました',
            data: {
                xmlLength: xml.length,
                itemCount: itemMatches.length,
                firstItemTitle: firstItemTitle
            }
        });
    }
    catch (error) {
        context_1.logger.error("[SimpleTest] Simple test failed:", error);
        res.status(500).json({
            success: false,
            error: "シンプルテストに失敗しました",
            details: error instanceof Error ? error.message : String(error)
        });
    }
});
//# sourceMappingURL=simple-test.js.map