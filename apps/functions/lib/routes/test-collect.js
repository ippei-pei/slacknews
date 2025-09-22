"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testRandomCollection = void 0;
const https_1 = require("firebase-functions/v2/https");
const context_1 = require("../context");
const collect_1 = require("../services/collect");
// CORS設定
const corsOptions = {
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [context_1.webAppUrl]
};
// ランダム記事収集テストAPI
exports.testRandomCollection = (0, https_1.onRequest)(corsOptions, async (req, res) => {
    try {
        const { minPerDay = 5 } = req.body || {};
        context_1.logger.info(`[TestAPI] Starting random collection test with minPerDay=${minPerDay}`);
        const addedCount = await (0, collect_1.collectTestRandomGoogleNews)(Number(minPerDay));
        context_1.logger.info(`[TestAPI] Random collection test completed. Added ${addedCount} articles`);
        res.json({
            success: true,
            message: `ランダム記事収集テストが完了しました。${addedCount}件の記事を追加しました。`,
            data: {
                addedCount,
                minPerDay: Number(minPerDay)
            }
        });
    }
    catch (error) {
        context_1.logger.error("[TestAPI] Random collection test failed:", error);
        res.status(500).json({
            success: false,
            error: "ランダム記事収集テストに失敗しました",
            details: error instanceof Error ? error.message : String(error)
        });
    }
});
//# sourceMappingURL=test-collect.js.map