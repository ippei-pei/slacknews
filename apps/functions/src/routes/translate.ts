import { onRequest } from "firebase-functions/v2/https";
import { db, logger, openaiApiKey, openaiApiUrl } from '../context';
import { NewsArticle } from '../types';
import { translateToJapanese } from '../services/translate';

// CORS設定
const corsOptions = {
  cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
  secrets: [openaiApiKey, openaiApiUrl]
};

// 配信対象記事の翻訳処理API
export const translateDeliveryTargetNews = onRequest(corsOptions, async (req, res) => {
  try {
    logger.info("Starting translation process for delivery target news...");
    logger.info(`Environment variables check: OPENAI_API_KEY exists: ${!!process.env.OPENAI_API_KEY}`);

    // 全記事を取得してからフィルタリング（複合クエリのインデックス問題を回避）
    const newsSnapshot = await db.collection("news").get();
    
    logger.info(`Total articles found: ${newsSnapshot.docs.length}`);
    
    // 配信対象で未翻訳の記事をフィルタリング
    const targetNews = newsSnapshot.docs.filter(doc => {
      const data = doc.data() as NewsArticle;
      const isTarget = data.isDeliveryTarget === true && data.isTranslated === false;
      logger.info(`Article ${doc.id}: isDeliveryTarget=${data.isDeliveryTarget}, isTranslated=${data.isTranslated}, isTarget=${isTarget}, title=${data.title.substring(0, 50)}...`);
      return isTarget;
    });

    logger.info(`Found ${targetNews.length} articles to translate`);

    if (targetNews.length === 0) {
      logger.warn("No articles found for translation. Checking all articles...");
      newsSnapshot.docs.forEach(doc => {
        const data = doc.data() as NewsArticle;
        logger.info(`Article ${doc.id}: isDeliveryTarget=${data.isDeliveryTarget}, isTranslated=${data.isTranslated}, title=${data.title.substring(0, 50)}...`);
      });
    }

    let translatedCount = 0;

    for (const doc of targetNews) {
      const article = doc.data() as NewsArticle;
      
      try {
        logger.info(`Starting translation for article: ${article.title.substring(0, 100)}...`);
        
        // 翻訳処理（エラー時はフォールバック翻訳を使用）
        const translatedTitle = await translateToJapanese(article.title);
        logger.info(`Title translation completed: ${translatedTitle.substring(0, 100)}...`);
        
        const translatedContent = await translateToJapanese(article.content);
        logger.info(`Content translation completed: ${translatedContent.substring(0, 100)}...`);
        
        const translatedSummary = await translateToJapanese(article.summary);
        logger.info(`Summary translation completed: ${translatedSummary.substring(0, 100)}...`);

        // 翻訳結果をDBに保存
        await doc.ref.update({
          translatedTitle,
          translatedContent,
          translatedSummary,
          isTranslated: true
        });

        translatedCount++;
        logger.info(`Successfully translated and saved article: ${article.title} -> ${translatedTitle}`);
      } catch (translateError) {
        logger.error(`Error translating article ${article.title}:`, translateError);
        // 翻訳エラーの場合はスキップ（フォールバック処理は禁止）
        logger.warn(`Skipping translation for article: ${article.title}`);
      }
    }

    logger.info(`Translation process completed. Translated ${translatedCount} articles.`);

    res.json({
      success: true,
      message: `${translatedCount}件の記事を翻訳しました`
    });
  } catch (error) {
    logger.error("Error in translation process:", error);
    res.status(500).json({ success: false, error: "Failed to translate articles" });
  }
});
