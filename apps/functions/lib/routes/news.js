"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupNews = exports.getNews = void 0;
const https_1 = require("firebase-functions/v2/https");
const context_1 = require("../context");
// CORS設定
const corsOptions = {
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [context_1.webAppUrl]
};
// ニュース記事一覧取得API（配信対象の記事のみ）
exports.getNews = (0, https_1.onRequest)(corsOptions, async (req, res) => {
    try {
        const { companyId, limit = 10 } = req.query;
        let newsSnapshot;
        if (companyId) {
            newsSnapshot = await context_1.db.collection("news")
                .where("companyId", "==", companyId)
                .get();
        }
        else {
            newsSnapshot = await context_1.db.collection("news").get();
        }
        const news = newsSnapshot.docs.map(doc => {
            const data = doc.data();
            return Object.assign({ id: doc.id }, data);
        });
        // 配信対象の記事のみをフィルタリング
        const deliveryTargetNews = news.filter(article => article.isDeliveryTarget === true);
        // 公開日時でソート（クライアント側）
        deliveryTargetNews.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
        // 制限を適用
        const limitedNews = deliveryTargetNews.slice(0, Number(limit));
        res.json({ success: true, data: limitedNews });
    }
    catch (error) {
        context_1.logger.error("Error fetching news:", error);
        res.status(500).json({ success: false, error: "Failed to fetch news" });
    }
});
// 記事クリーンナップAPI（完全削除・デバッグ用）
exports.cleanupNews = (0, https_1.onRequest)(corsOptions, async (req, res) => {
    try {
        context_1.logger.info("Starting news cleanup process...");
        // 全記事を取得
        const newsSnapshot = await context_1.db.collection("news").get();
        const totalArticles = newsSnapshot.docs.length;
        context_1.logger.info(`Found ${totalArticles} articles to delete`);
        if (totalArticles === 0) {
            res.json({
                success: true,
                message: "No articles found to cleanup"
            });
            return;
        }
        // バッチ削除（Firestoreの制限により500件ずつ処理）
        const batchSize = 500;
        let deletedCount = 0;
        for (let i = 0; i < newsSnapshot.docs.length; i += batchSize) {
            const batch = context_1.db.batch();
            const batchDocs = newsSnapshot.docs.slice(i, i + batchSize);
            batchDocs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            deletedCount += batchDocs.length;
            context_1.logger.info(`Deleted batch: ${deletedCount}/${totalArticles} articles`);
        }
        context_1.logger.info(`News cleanup completed. Deleted ${deletedCount} articles`);
        res.json({
            success: true,
            message: `Successfully deleted ${deletedCount} articles from the database`
        });
    }
    catch (error) {
        context_1.logger.error("Error during news cleanup:", error);
        res.status(500).json({
            success: false,
            error: "Failed to cleanup news articles"
        });
    }
});
//# sourceMappingURL=news.js.map