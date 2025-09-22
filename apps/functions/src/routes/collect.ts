import { onRequest } from "firebase-functions/v2/https";
import { db, logger, webAppUrl } from '../context';
import { Company } from '../types';
import { collectRSSFeed, collectRedditFeed, collectTestRandomGoogleNews } from '../services/collect';

// CORS設定
const corsOptions = {
  cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
  secrets: [webAppUrl]
};

// 情報収集実行API
export const runCollection = onRequest(corsOptions, async (req, res) => {
  try {
    logger.info("Starting news collection process...");

    // アクティブな企業を取得
    const companiesSnapshot = await db.collection("companies")
      .where("isActive", "==", true)
      .get();

    const companies = companiesSnapshot.docs.map(doc => {
      const data = doc.data() as Omit<Company, "id">;
      return {
        id: doc.id,
        ...data
      };
    });

    logger.info(`Found ${companies.length} active companies`);

    let collectedCount = 0;

    // 各企業のRSSフィードを収集
    for (const company of companies) {
      try {
        logger.info(`Collecting news for ${company.name}...`);
        
        // RSSフィードが設定されている場合のみ処理
        if (company.rssUrl) {
          await collectRSSFeed(company);
          collectedCount++;
        }
        
        if (company.redditUrl) {
          await collectRedditFeed(company);
          collectedCount++;
        }
        
      } catch (error) {
        logger.error(`Error collecting news for ${company.name}:`, error);
      }
    }
    
    // 【テスト用】Google Newsランダム収集（各日5件以上）
    const added = await collectTestRandomGoogleNews(5);
    logger.info(`RandomCollect added: ${added}`);

    res.json({ 
      success: true, 
      message: `${companies.length}社から${collectedCount}件の情報収集が完了しました` 
    });

  } catch (error) {
    logger.error("Error in runCollection:", error);
    res.status(500).json({ 
      success: false, 
      error: "情報収集の実行中にエラーが発生しました" 
    });
  }
});
