import { onRequest } from "firebase-functions/v2/https";
import { logger, webAppUrl } from '../context';
import { collectTestRandomGoogleNews } from '../services/collect';

// CORS設定
const corsOptions = {
  cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
  secrets: [webAppUrl]
};

// ランダム記事収集テストAPI
export const testRandomCollection = onRequest(corsOptions, async (req, res) => {
  try {
    const { minPerDay = 5 } = req.body || {};
    
    logger.info(`[TestAPI] Starting random collection test with minPerDay=${minPerDay}`);
    
    const addedCount = await collectTestRandomGoogleNews(Number(minPerDay));
    
    logger.info(`[TestAPI] Random collection test completed. Added ${addedCount} articles`);
    
    res.json({
      success: true,
      message: `ランダム記事収集テストが完了しました。${addedCount}件の記事を追加しました。`,
      data: {
        addedCount,
        minPerDay: Number(minPerDay)
      }
    });
  } catch (error) {
    logger.error("[TestAPI] Random collection test failed:", error);
    res.status(500).json({
      success: false,
      error: "ランダム記事収集テストに失敗しました",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});
