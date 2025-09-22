import { onRequest } from "firebase-functions/v2/https";
import { db, logger, webAppUrl, slackBotToken, openaiApiKey, openaiApiUrl, slackWebhookUrl } from '../context';
import { NewsArticle, SlackSettings } from '../types';
import { postToSlackChannel } from '../utils/slack';
import { executeDailyReport, executeWeeklyReport } from '../services/report';

// 配信処理API（Slack送信）
export const deliverNews = onRequest({ 
  cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
  secrets: [webAppUrl, slackBotToken]
}, async (req, res) => {
  try {
    logger.info("Starting news delivery process...");

    // 全記事を取得してからフィルタリング
    const newsSnapshot = await db.collection("news").get();
    
    // 配信対象で翻訳済み、未配信の記事をフィルタリング
    const targetNews = newsSnapshot.docs.filter(doc => {
      const data = doc.data() as NewsArticle;
      return data.isDeliveryTarget === true && 
             data.isTranslated === true && 
             data.deliveryStatus === "pending";
    });

    logger.info(`Found ${targetNews.length} articles to deliver`);

    let deliveredCount = 0;

    for (const doc of targetNews) {
      const article = doc.data() as NewsArticle;
      
      try {
        // Slack送信処理
        const slackMessage = {
          channel: '', // 後で設定から取得
          text: `📰 ${article.translatedTitle || article.title}`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*${article.translatedTitle || article.title}*`
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `${article.translatedContent || article.translatedSummary || article.content}`
              }
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `カテゴリ: ${article.category} | 重要度: ${article.importance}/5 | ${article.isTranslated ? '翻訳済み' : '未翻訳'}`
                }
              ]
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "詳細を見る"
                  },
                  url: article.url
                }
              ]
            }
          ]
        };

        // Slack Web API chat.postMessage 呼び出し
        try {
          const settingsDoc = await db.collection("settings").doc("slack").get();
          const settings = (settingsDoc.exists ? settingsDoc.data() : null) as SlackSettings | null;
          if (!settings?.channelId) throw new Error('channelId not configured');
          
          slackMessage.channel = settings.channelId;
          await postToSlackChannel(slackMessage, slackBotToken.value());
          logger.info(`Successfully delivered to Slack: ${slackMessage.text}`);
        } catch (slackError) {
          logger.error(`Slack delivery failed: ${slackError}`);
          throw slackError;
        }

        // 配信ステータスを更新
        await doc.ref.update({
          deliveryStatus: 'delivered',
          deliveryDate: new Date()
        });

        deliveredCount++;
        logger.info(`Delivered article: ${article.title}`);
      } catch (deliveryError) {
        logger.error(`Error delivering article ${article.title}:`, deliveryError);
        
        // 配信失敗の場合
        await doc.ref.update({
          deliveryStatus: 'failed'
        });
      }
    }

    res.json({
      success: true,
      message: `${deliveredCount}件の記事を配信しました`
    });
  } catch (error) {
    logger.error("Error in delivery process:", error);
    res.status(500).json({ success: false, error: "Failed to deliver articles" });
  }
});

// 日次レポート配信API
export const deliverDailyReport = onRequest({ 
  cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
  secrets: [webAppUrl, slackBotToken, openaiApiKey, openaiApiUrl]
}, async (req, res) => {
  try {
    const { date } = req.body;
    const result = await executeDailyReport(date);
    res.json(result);
  } catch (error) {
    logger.error("Error in daily report delivery:", error);
    res.status(500).json({ success: false, error: "Failed to deliver daily report" });
  }
});

// 週次レポート配信API
export const deliverWeeklyReport = onRequest({ 
  cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
  secrets: [webAppUrl, slackWebhookUrl, openaiApiKey, openaiApiUrl]
}, async (req, res) => {
  try {
    const { weekStart } = req.body;
    const result = await executeWeeklyReport(weekStart);
    res.json(result);
  } catch (error) {
    logger.error("Error in weekly report delivery:", (error as any)?.stack || error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to deliver weekly report" 
    });
  }
});

