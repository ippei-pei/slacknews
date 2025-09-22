"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCollection = void 0;
const https_1 = require("firebase-functions/v2/https");
const context_1 = require("../context");
const collect_1 = require("../services/collect");
// CORS設定
const corsOptions = {
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [context_1.webAppUrl]
};
// 情報収集実行API
exports.runCollection = (0, https_1.onRequest)(corsOptions, async (req, res) => {
    try {
        context_1.logger.info("Starting news collection process...");
        // アクティブな企業を取得
        const companiesSnapshot = await context_1.db.collection("companies")
            .where("isActive", "==", true)
            .get();
        const companies = companiesSnapshot.docs.map(doc => {
            const data = doc.data();
            return Object.assign({ id: doc.id }, data);
        });
        context_1.logger.info(`Found ${companies.length} active companies`);
        let collectedCount = 0;
        // 各企業のRSSフィードを収集
        for (const company of companies) {
            try {
                context_1.logger.info(`Collecting news for ${company.name}...`);
                // RSSフィードが設定されている場合のみ処理
                if (company.rssUrl) {
                    await (0, collect_1.collectRSSFeed)(company);
                    collectedCount++;
                }
                if (company.redditUrl) {
                    await (0, collect_1.collectRedditFeed)(company);
                    collectedCount++;
                }
            }
            catch (error) {
                context_1.logger.error(`Error collecting news for ${company.name}:`, error);
            }
        }
        // 【テスト用】Google Newsランダム収集（各日5件以上）
        const added = await (0, collect_1.collectTestRandomGoogleNews)(5);
        context_1.logger.info(`RandomCollect added: ${added}`);
        res.json({
            success: true,
            message: `${companies.length}社から${collectedCount}件の情報収集が完了しました`
        });
    }
    catch (error) {
        context_1.logger.error("Error in runCollection:", error);
        res.status(500).json({
            success: false,
            error: "情報収集の実行中にエラーが発生しました"
        });
    }
});
//# sourceMappingURL=collect.js.map