"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateDeliveryTargetNews = void 0;
const https_1 = require("firebase-functions/v2/https");
const context_1 = require("../context");
const translate_1 = require("../services/translate");
// CORS設定
const corsOptions = {
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [context_1.openaiApiKey, context_1.openaiApiUrl]
};
// 配信対象記事の翻訳処理API
exports.translateDeliveryTargetNews = (0, https_1.onRequest)(corsOptions, async (req, res) => {
    try {
        context_1.logger.info("Starting translation process for delivery target news...");
        context_1.logger.info(`Environment variables check: OPENAI_API_KEY exists: ${!!process.env.OPENAI_API_KEY}`);
        // 全記事を取得してからフィルタリング（複合クエリのインデックス問題を回避）
        const newsSnapshot = await context_1.db.collection("news").get();
        context_1.logger.info(`Total articles found: ${newsSnapshot.docs.length}`);
        // 配信対象で未翻訳の記事をフィルタリング
        const targetNews = newsSnapshot.docs.filter(doc => {
            const data = doc.data();
            const isTarget = data.isDeliveryTarget === true && data.isTranslated === false;
            context_1.logger.info(`Article ${doc.id}: isDeliveryTarget=${data.isDeliveryTarget}, isTranslated=${data.isTranslated}, isTarget=${isTarget}, title=${data.title.substring(0, 50)}...`);
            return isTarget;
        });
        context_1.logger.info(`Found ${targetNews.length} articles to translate`);
        if (targetNews.length === 0) {
            context_1.logger.warn("No articles found for translation. Checking all articles...");
            newsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                context_1.logger.info(`Article ${doc.id}: isDeliveryTarget=${data.isDeliveryTarget}, isTranslated=${data.isTranslated}, title=${data.title.substring(0, 50)}...`);
            });
        }
        let translatedCount = 0;
        for (const doc of targetNews) {
            const article = doc.data();
            try {
                context_1.logger.info(`Starting translation for article: ${article.title.substring(0, 100)}...`);
                // 翻訳処理（エラー時はフォールバック翻訳を使用）
                const translatedTitle = await (0, translate_1.translateToJapanese)(article.title);
                context_1.logger.info(`Title translation completed: ${translatedTitle.substring(0, 100)}...`);
                const translatedContent = await (0, translate_1.translateToJapanese)(article.content);
                context_1.logger.info(`Content translation completed: ${translatedContent.substring(0, 100)}...`);
                const translatedSummary = await (0, translate_1.translateToJapanese)(article.summary);
                context_1.logger.info(`Summary translation completed: ${translatedSummary.substring(0, 100)}...`);
                // 翻訳結果をDBに保存
                await doc.ref.update({
                    translatedTitle,
                    translatedContent,
                    translatedSummary,
                    isTranslated: true
                });
                translatedCount++;
                context_1.logger.info(`Successfully translated and saved article: ${article.title} -> ${translatedTitle}`);
            }
            catch (translateError) {
                context_1.logger.error(`Error translating article ${article.title}:`, translateError);
                // 翻訳エラーの場合はスキップ（フォールバック処理は禁止）
                context_1.logger.warn(`Skipping translation for article: ${article.title}`);
            }
        }
        context_1.logger.info(`Translation process completed. Translated ${translatedCount} articles.`);
        res.json({
            success: true,
            message: `${translatedCount}件の記事を翻訳しました`
        });
    }
    catch (error) {
        context_1.logger.error("Error in translation process:", error);
        res.status(500).json({ success: false, error: "Failed to translate articles" });
    }
});
//# sourceMappingURL=translate.js.map