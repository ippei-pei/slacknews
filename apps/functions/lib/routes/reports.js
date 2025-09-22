"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliverWeeklyReport = exports.deliverDailyReport = exports.deliverNews = void 0;
const https_1 = require("firebase-functions/v2/https");
const context_1 = require("../context");
const slack_1 = require("../utils/slack");
const date_1 = require("../utils/date");
const config_1 = require("../config");
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
    var _a, _b, _c;
    try {
        const { date } = req.body;
        const targetDate = date || new Date().toISOString().split('T')[0];
        context_1.logger.info(`Starting daily report delivery for ${targetDate}...`);
        // 指定日の記事を取得
        // JST日付境界に統一
        const startOfDay = (0, date_1.toJstStartOfDay)(targetDate);
        const endOfDay = (0, date_1.toJstEndOfDay)(targetDate);
        const newsSnapshot = await context_1.db.collection("news").get();
        const dailyNews = newsSnapshot.docs.filter(doc => {
            const data = doc.data();
            const articleDate = new Date(data.publishedAt);
            return articleDate >= startOfDay && articleDate <= endOfDay;
        }).map(doc => doc.data());
        // LLMで日次サマリを生成
        const articlesForPrompt = dailyNews.map(a => ({
            id: a.id,
            company: a.companyId,
            title: a.isTranslated ? (a.translatedTitle || a.title) : a.title,
            content: ((a.isTranslated ? (a.translatedContent || a.translatedSummary) : (a.content || a.summary)) || '').slice(0, 400),
            category: a.category,
            publishedAt: a.publishedAt
        }));
        const OPENAI_API_KEY = context_1.openaiApiKey.value();
        const OPENAI_API_URL = context_1.openaiApiUrl.value();
        const model = config_1.config.ai.model;
        const systemPrompt = "あなたは日本語のビジネスアナリストです。Slack投稿用に簡潔な日次サマリを日本語で出力します。";
        const userPrompt = `以下の本日の記事一覧から、Slackに投稿する日次サマリ文（約200文字）を生成してください。\n- 統計や重要度の記載は不要\n- 見出しや装飾は不要、本文のみ\n出力はテキストのみ\n\n記事一覧(JSON):\n${JSON.stringify(articlesForPrompt, null, 2)}`;
        let dailySummary = "";
        try {
            const r = await fetch(`${OPENAI_API_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model,
                    temperature: 0.7,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ]
                })
            });
            if (!r.ok) {
                const t = await r.text();
                throw new Error(`OpenAI API error: ${r.status} ${r.statusText} ${t}`);
            }
            const data = await r.json();
            dailySummary = (((_c = (_b = (_a = data.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) || '').trim();
        }
        catch (e) {
            context_1.logger.error('daily summary generation failed', e);
            dailySummary = dailyNews.length > 0 ? '本日の主要動向については記事をご確認ください。' : '本日は該当する記事がありませんでした。';
        }
        // 日次レポートメッセージを生成（重要度表記なし）
        const slackMessage = {
            channel: '', // 後で設定から取得
            text: `📰 日次ニュースレポート - ${targetDate}`,
            blocks: [
                {
                    type: "header",
                    text: { type: "plain_text", text: `📰 日次ニュースレポート - ${targetDate}` }
                },
                {
                    type: "section",
                    text: { type: "mrkdwn", text: dailySummary || `本日 ${dailyNews.length} 件の記事を確認しました。` }
                }
            ]
        };
        // 主要記事（最大5件、重要度文言を削除）
        if (dailyNews.length > 0) {
            slackMessage.blocks.push({ type: "section", text: { type: "mrkdwn", text: "*📋 主要記事:*" } });
            dailyNews.slice(0, 5).forEach((article) => {
                slackMessage.blocks.push({
                    type: "section",
                    text: { type: "mrkdwn", text: `*${article.isTranslated ? (article.translatedTitle || article.title) : article.title}*\n${article.isTranslated ? (article.translatedContent || article.translatedSummary || '') : (article.content || article.summary)}` }
                });
            });
            if (dailyNews.length > 5) {
                slackMessage.blocks.push({ type: "section", text: { type: "mrkdwn", text: `...他 ${dailyNews.length - 5} 件` } });
            }
        }
        else {
            slackMessage.blocks.push({ type: "section", text: { type: "mrkdwn", text: "本日の記事はありません。" } });
        }
        // Slack送信
        // エラー時メンション設定を読み込み
        try {
            await context_1.db.collection("settings").doc("slack").get();
        }
        catch (_d) { }
        // 設定の参照（メンション/チャンネル）
        let mentionPrefix = '';
        const settingsDoc = await context_1.db.collection("settings").doc("slack").get();
        const settings = (settingsDoc.exists ? settingsDoc.data() : null);
        if (settings === null || settings === void 0 ? void 0 : settings.deliveryMentionUserId)
            mentionPrefix = `<@${settings.deliveryMentionUserId}> `;
        if (!(settings === null || settings === void 0 ? void 0 : settings.channelId))
            throw new Error('channelId not configured');
        if (mentionPrefix)
            slackMessage.blocks.unshift({ type: 'section', text: { type: 'mrkdwn', text: `${mentionPrefix}` } });
        slackMessage.channel = settings.channelId;
        await (0, slack_1.postToSlackChannel)(slackMessage, context_1.slackBotToken.value());
        context_1.logger.info(`Daily report delivered successfully for ${targetDate}`);
        res.json({ success: true, message: `日次レポートを配信しました（${dailyNews.length}件の記事）` });
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
        const targetWeekStart = weekStart || new Date().toISOString().split('T')[0];
        context_1.logger.info(`Starting weekly report delivery for week starting ${targetWeekStart}...`);
        // 指定週の記事を取得
        const startOfWeek = (0, date_1.getWeekStart)(new Date(targetWeekStart));
        const endOfWeek = (0, date_1.getWeekEnd)(new Date(targetWeekStart));
        const newsSnapshot = await context_1.db.collection("news").get();
        const weeklyNews = newsSnapshot.docs.filter(doc => {
            const data = doc.data();
            const articleDate = new Date(data.publishedAt);
            return articleDate >= startOfWeek && articleDate <= endOfWeek;
        }).map(doc => doc.data());
        // LLMで文生成（失敗時はフォールバック）
        let competitorSummary = '';
        let companySummaries = [];
        let strategicAction = '';
        try {
            const llm = await generateWeeklyReportWithLLM(weeklyNews);
            competitorSummary = llm.competitorSummary;
            companySummaries = llm.companySummaries;
            strategicAction = llm.strategicAction;
        }
        catch (llmErr) {
            context_1.logger.error('LLM weekly generation failed:', llmErr);
            competitorSummary = weeklyNews.length > 0 ? '今週の競合動向については記事をご確認ください。' : '今週は該当する記事がありませんでした。';
            companySummaries = [];
            strategicAction = '推奨アクションは取得できませんでした。';
        }
        // 週次レポートメッセージを生成
        const slackMessage = {
            channel: '', // 後で設定から取得
            text: `📊 週次戦略レポート - ${targetWeekStart}週`,
            blocks: [
                {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: `📊 週次戦略レポート - ${targetWeekStart}週`
                    }
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*🏢 競合の動きサマリ*\n${competitorSummary}`
                    }
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*🏢 各社の動きサマリ*`
                    }
                }
            ]
        };
        // 各社の動きサマリを追加
        if (companySummaries.length > 0) {
            companySummaries.forEach(company => {
                slackMessage.blocks.push({
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*${company.company || ''}*\n${company.summary}`
                    }
                });
            });
        }
        else {
            slackMessage.blocks.push({
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "該当週の競合記事はありません。"
                }
            });
        }
        // 自社が取るべき動きを追加
        slackMessage.blocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*🎯 自社が取るべき動き*\n${strategicAction}`
            }
        });
        // Slack送信（chat.postMessage）
        const settingsDoc = await context_1.db.collection("settings").doc("slack").get();
        const settings = (settingsDoc.exists ? settingsDoc.data() : null);
        let mentionPrefix = '';
        if (settings === null || settings === void 0 ? void 0 : settings.deliveryMentionUserId)
            mentionPrefix = `<@${settings.deliveryMentionUserId}> `;
        if (mentionPrefix)
            slackMessage.blocks.unshift({ type: 'section', text: { type: 'mrkdwn', text: `${mentionPrefix}` } });
        if (!(settings === null || settings === void 0 ? void 0 : settings.channelId))
            throw new Error('channelId not configured');
        slackMessage.channel = settings.channelId;
        await (0, slack_1.postToSlackChannel)(slackMessage, context_1.slackBotToken.value());
        context_1.logger.info(`Weekly report delivered successfully for week starting ${targetWeekStart}`);
        res.json({
            success: true,
            message: `週次レポートを配信しました（${weeklyNews.length}件の記事）`
        });
    }
    catch (error) {
        context_1.logger.error("Error in weekly report delivery:", (error === null || error === void 0 ? void 0 : error.stack) || error);
        // 設定からエラーメンション取得して通知
        try {
            const settingsDoc = await context_1.db.collection("settings").doc("slack").get();
            const settings = (settingsDoc.exists ? settingsDoc.data() : null);
            const mention = (settings === null || settings === void 0 ? void 0 : settings.errorMentionUserId) ? `<@${settings.errorMentionUserId}> ` : '';
            if (settings === null || settings === void 0 ? void 0 : settings.channelId) {
                const errorMessage = {
                    channel: settings.channelId,
                    text: `${mention}週次レポート配信に失敗しました。詳細: ${((error === null || error === void 0 ? void 0 : error.message) || String(error)).slice(0, 300)}`
                };
                await (0, slack_1.postToSlackChannel)(errorMessage, context_1.slackBotToken.value());
            }
        }
        catch (_a) { }
        res.status(500).json({
            success: false,
            error: "Failed to deliver weekly report"
        });
    }
});
// ヘルパー関数（LLMによる文生成）
async function generateWeeklyReportWithLLM(weeklyNews) {
    var _a, _b, _c;
    // データがない場合は空の指示で生成（LLMに「記事がない」前提で短く出力させる）
    const articlesForPrompt = weeklyNews.map(a => ({
        id: a.id,
        company: a.companyId,
        title: a.isTranslated ? (a.translatedTitle || a.title) : a.title,
        content: ((a.isTranslated ? (a.translatedContent || a.translatedSummary) : (a.content || a.summary)) || '').slice(0, 500),
        category: a.category,
        importance: a.importance,
        publishedAt: a.publishedAt
    }));
    const systemPrompt = "あなたは日本語のビジネスアナリストです。Slackに投稿可能なテキストのみを、日本語で簡潔に出力します。";
    const userPrompt = `以下のニュース一覧から、Slack投稿用の週次レポートをJSONで生成してください。\n要件:\n- 競合の動きサマリ: およそ200文字\n- 各社の動きサマリ: 会社ごとに約100文字\n- 自社が取るべき動き: およそ200文字\n- 統計値や数値の羅列は不要\n- 見出しや装飾は不要、本文のみ\n- 出力は必ず次のJSONスキーマに従うこと\n{\n  "competitorSummary": "string",\n  "companySummaries": [{"company": "string", "summary": "string"}],\n  "strategicAction": "string"\n}\nニュース一覧(JSON):\n${JSON.stringify(articlesForPrompt, null, 2)}`;
    // OpenAI Chat Completions 呼び出し
    const OPENAI_API_KEY = context_1.openaiApiKey.value();
    const OPENAI_API_URL = context_1.openaiApiUrl.value();
    const model = config_1.config.ai.model;
    const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model,
            temperature: 0.7,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]
        })
    });
    if (!response.ok) {
        const errorText = await response.text();
        context_1.logger.error(`OpenAI API error (weekly report): ${errorText}`);
        throw new Error(`OpenAI API error: ${response.status} - ${response.statusText}`);
    }
    const data = await response.json();
    const content = (_c = (_b = (_a = data.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content;
    if (!content) {
        throw new Error('LLMから週次レポートの応答が得られませんでした');
    }
    // JSON抽出
    let jsonText = content.trim();
    const jsonStart = jsonText.indexOf('{');
    const jsonEnd = jsonText.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
        jsonText = jsonText.slice(jsonStart, jsonEnd + 1);
    }
    try {
        const parsed = JSON.parse(jsonText);
        const competitorSummary = String(parsed.competitorSummary || '').trim();
        const companySummaries = Array.isArray(parsed.companySummaries) ? parsed.companySummaries.map((c) => ({
            company: String(c.company || ''),
            summary: String(c.summary || '')
        })) : [];
        const strategicAction = String(parsed.strategicAction || '').trim();
        return { competitorSummary, companySummaries, strategicAction };
    }
    catch (e) {
        context_1.logger.error('LLM出力のJSON解析に失敗しました', e);
        // フォールバック（空文言）
        return {
            competitorSummary: '今週の動向サマリは取得できませんでした。',
            companySummaries: [],
            strategicAction: '推奨アクションは取得できませんでした。'
        };
    }
}
//# sourceMappingURL=reports.js.map