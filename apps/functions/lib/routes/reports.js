"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliverWeeklyReport = exports.deliverDailyReport = exports.deliverNews = void 0;
const https_1 = require("firebase-functions/v2/https");
const context_1 = require("../context");
const slack_1 = require("../utils/slack");
const report_1 = require("../services/report");
// 配信処理API（Slack送信）
exports.deliverNews = (0, https_1.onRequest)({
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [context_1.webAppUrl, context_1.slackBotToken]
}, async (req, res) => {
    try {
        context_1.logger.info("Starting news delivery process...");
        // 全記事を取得してからフィルタリング
        const newsSnapshot = await context_1.db.collection("news").get();
        // 配信対象で翻訳済み、未配信の記事をフィルタリング
        const targetNews = newsSnapshot.docs.filter(doc => {
            const data = doc.data();
            return data.isDeliveryTarget === true &&
                data.isTranslated === true &&
                data.deliveryStatus === "pending";
        });
        context_1.logger.info(`Found ${targetNews.length} articles to deliver`);
        let deliveredCount = 0;
        for (const doc of targetNews) {
            const article = doc.data();
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
                    const settingsDoc = await context_1.db.collection("settings").doc("slack").get();
                    const settings = (settingsDoc.exists ? settingsDoc.data() : null);
                    if (!(settings === null || settings === void 0 ? void 0 : settings.channelId))
                        throw new Error('channelId not configured');
                    slackMessage.channel = settings.channelId;
                    await (0, slack_1.postToSlackChannel)(slackMessage, context_1.slackBotToken.value());
                    context_1.logger.info(`Successfully delivered to Slack: ${slackMessage.text}`);
                }
                catch (slackError) {
                    context_1.logger.error(`Slack delivery failed: ${slackError}`);
                    throw slackError;
                }
                // 配信ステータスを更新
                await doc.ref.update({
                    deliveryStatus: 'delivered',
                    deliveryDate: new Date()
                });
                deliveredCount++;
                context_1.logger.info(`Delivered article: ${article.title}`);
            }
            catch (deliveryError) {
                context_1.logger.error(`Error delivering article ${article.title}:`, deliveryError);
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
    }
    catch (error) {
        context_1.logger.error("Error in delivery process:", error);
        res.status(500).json({ success: false, error: "Failed to deliver articles" });
    }
});
// 日次レポート配信API
exports.deliverDailyReport = (0, https_1.onRequest)({
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [context_1.webAppUrl, context_1.slackBotToken, context_1.openaiApiKey, context_1.openaiApiUrl]
}, async (req, res) => {
    try {
        const { date } = req.body;
        const result = await (0, report_1.executeDailyReport)(date);
        res.json(result);
    }
    catch (error) {
        context_1.logger.error("Error in daily report delivery:", error);
        res.status(500).json({ success: false, error: "Failed to deliver daily report" });
    }
});
// 週次レポート配信API
exports.deliverWeeklyReport = (0, https_1.onRequest)({
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [context_1.webAppUrl, context_1.slackWebhookUrl, context_1.openaiApiKey, context_1.openaiApiUrl]
}, async (req, res) => {
    try {
        const { weekStart } = req.body;
        const result = await (0, report_1.executeWeeklyReport)(weekStart);
        res.json(result);
    }
    catch (error) {
        context_1.logger.error("Error in weekly report delivery:", (error === null || error === void 0 ? void 0 : error.stack) || error);
        res.status(500).json({
            success: false,
            error: "Failed to deliver weekly report"
        });
    }
});
//# sourceMappingURL=reports.js.map