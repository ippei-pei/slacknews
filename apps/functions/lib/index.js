"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledCollection = exports.collectRealData = exports.sendWeeklyReport = exports.sendDailyReport = exports.runCollection = exports.getNews = exports.deliverNews = exports.translateDeliveryTargetNews = exports.clearAllNews = exports.deleteCompany = exports.addCompany = exports.getCompanies = void 0;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const firebase_functions_1 = require("firebase-functions");
const dotenv = __importStar(require("dotenv"));
// .envファイルを読み込み
dotenv.config({ path: "../../.env" });
// Firebase Admin SDK を初期化
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
// RSSフィード収集関数
async function collectRSSFeed(company) {
    try {
        firebase_functions_1.logger.info(`Collecting RSS for ${company.name}: ${company.rssUrl}`);
        // RSSフィードの取得
        const response = await fetch(company.rssUrl);
        firebase_functions_1.logger.info(`RSS response status: ${response.status}`);
        const xmlText = await response.text();
        firebase_functions_1.logger.info(`RSS content length: ${xmlText.length}`);
        // 簡易的なRSS解析
        const items = parseRSSFeed(xmlText);
        firebase_functions_1.logger.info(`Parsed ${items.length} items from RSS`);
        for (const item of items.slice(0, 5)) { // 最新5件のみ
            const newsData = {
                companyId: company.id,
                title: stripHtmlTags(item.title || 'No title'),
                content: stripHtmlTags(item.description || item.content || ''),
                url: item.link || '',
                publishedAt: new Date(item.pubDate || Date.now()),
                importance: 3, // デフォルト重要度
                category: 'RSS',
                summary: stripHtmlTags(item.description || item.content || ''),
                isDeliveryTarget: true, // 重複チェック後に設定
                isTranslated: false,
                informationAcquisitionDate: new Date(), // 情報取得日
                deliveryStatus: 'pending', // 配信ステータス
                createdAt: new Date()
            };
            firebase_functions_1.logger.info(`Processing item: ${item.title}`);
            // 重複チェック（同じURLの記事が既に存在するか）
            const existingNews = await db.collection("news")
                .where("companyId", "==", company.id)
                .where("url", "==", newsData.url)
                .limit(1)
                .get();
            if (existingNews.empty) {
                // 配信対象判定（現在は重複していないもののみ、将来的には重要度などで判定）
                newsData.isDeliveryTarget = true;
                await db.collection("news").add(newsData);
                firebase_functions_1.logger.info(`Added news: ${item.title} (delivery target: ${newsData.isDeliveryTarget})`);
            }
            else {
                firebase_functions_1.logger.info(`Skipped duplicate news: ${item.title}`);
            }
        }
    }
    catch (error) {
        firebase_functions_1.logger.error(`Error collecting RSS for ${company.name}:`, error);
    }
}
// Redditフィード収集関数
async function collectRedditFeed(company) {
    try {
        firebase_functions_1.logger.info(`Collecting Reddit for ${company.name}: ${company.redditUrl}`);
        // Reddit RSSの取得
        const response = await fetch(company.redditUrl);
        const xmlText = await response.text();
        const items = parseRSSFeed(xmlText);
        for (const item of items.slice(0, 3)) { // 最新3件のみ
            const newsData = {
                companyId: company.id,
                title: stripHtmlTags(item.title || 'No title'),
                content: stripHtmlTags(item.description || item.content || ''),
                url: item.link || '',
                publishedAt: new Date(item.pubDate || Date.now()),
                importance: 4, // Redditは重要度高め
                category: 'Reddit',
                summary: stripHtmlTags(item.description || item.content || ''),
                isDeliveryTarget: true, // 重複チェック後に設定
                isTranslated: false,
                informationAcquisitionDate: new Date(), // 情報取得日
                deliveryStatus: 'pending', // 配信ステータス
                createdAt: new Date()
            };
            // 重複チェック
            const existingNews = await db.collection("news")
                .where("companyId", "==", company.id)
                .where("url", "==", newsData.url)
                .limit(1)
                .get();
            if (existingNews.empty) {
                // 配信対象判定（現在は重複していないもののみ、将来的には重要度などで判定）
                newsData.isDeliveryTarget = true;
                await db.collection("news").add(newsData);
                firebase_functions_1.logger.info(`Added Reddit news: ${item.title} (delivery target: ${newsData.isDeliveryTarget})`);
            }
            else {
                firebase_functions_1.logger.info(`Skipped duplicate Reddit news: ${item.title}`);
            }
        }
    }
    catch (error) {
        firebase_functions_1.logger.error(`Error collecting Reddit for ${company.name}:`, error);
    }
}
// HTMLタグを除去する関数
function stripHtmlTags(html) {
    if (!html)
        return '';
    return html
        .replace(/<[^>]*>/g, '') // HTMLタグを除去
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ') // 複数の空白を1つに
        .trim();
}
// gpt-5 nanoを使用した日本語翻訳関数
async function translateToJapanese(text) {
    var _a, _b, _c;
    // .envファイルからAPIキーを取得
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key is required for translation. Please set OPENAI_API_KEY in .env file.');
    }
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-5-nano',
            messages: [
                {
                    role: 'system',
                    content: 'あなたは英語から日本語への翻訳専門家です。ニュース記事のタイトルや内容を自然で読みやすい日本語に翻訳してください。'
                },
                {
                    role: 'user',
                    content: `以下のテキストを日本語に翻訳してください:\n\n${text}`
                }
            ],
            max_tokens: 1000,
            temperature: 0.3,
        }),
    });
    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} - ${response.statusText}`);
    }
    const data = await response.json();
    const translatedText = (_c = (_b = (_a = data.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.trim();
    if (!translatedText) {
        throw new Error('No translation received from OpenAI API');
    }
    return translatedText;
}
// Google Newsから当日記事を取得する関数
async function collectTodaysGoogleNews(company, count = 20) {
    try {
        firebase_functions_1.logger.info(`Collecting today's Google News for ${company.name}`);
        // 当日の日付を取得
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD形式
        // 様々なキーワードでGoogle Newsを検索（当日の記事のみ）
        const keywords = [
            'technology', 'AI', 'artificial intelligence', 'startup', 'innovation',
            'software', 'hardware', 'mobile', 'internet', 'cybersecurity',
            'blockchain', 'cryptocurrency', 'fintech', 'ecommerce', 'social media',
            'tech news', 'breaking news', 'latest technology', 'digital transformation',
            'cloud computing', 'machine learning', 'data science', 'programming'
        ];
        let allArticles = [];
        // 複数のキーワードで検索して記事を集める
        for (let i = 0; i < Math.min(keywords.length, 8); i++) {
            const keyword = keywords[i];
            const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=en-US&gl=US&ceid=US:en&when:1d`;
            firebase_functions_1.logger.info(`Searching with keyword: ${keyword}`);
            try {
                const response = await fetch(googleNewsUrl);
                const xmlText = await response.text();
                const items = parseRSSFeed(xmlText);
                firebase_functions_1.logger.info(`Found ${items.length} articles for keyword: ${keyword}`);
                // 当日の記事のみをフィルタリング
                const todayItems = items.filter(item => {
                    if (!item.pubDate)
                        return false;
                    const itemDate = new Date(item.pubDate);
                    const itemDateStr = itemDate.toISOString().split('T')[0];
                    return itemDateStr === todayStr;
                });
                firebase_functions_1.logger.info(`Found ${todayItems.length} today's articles for keyword: ${keyword}`);
                allArticles = allArticles.concat(todayItems);
                // 少し待機してAPI制限を避ける
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            catch (error) {
                firebase_functions_1.logger.error(`Error fetching articles for keyword ${keyword}:`, error);
            }
        }
        // 重複を除去（URLベース）
        const uniqueArticles = allArticles.filter((article, index, self) => index === self.findIndex(a => a.link === article.link));
        firebase_functions_1.logger.info(`Total unique today's articles found: ${uniqueArticles.length}`);
        // ランダムに記事を選択（最大count件）
        const shuffledItems = uniqueArticles.sort(() => 0.5 - Math.random());
        const selectedItems = shuffledItems.slice(0, count);
        firebase_functions_1.logger.info(`Selected ${selectedItems.length} articles for ${company.name}`);
        for (const item of selectedItems) {
            const newsData = {
                companyId: company.id,
                title: stripHtmlTags(item.title || 'No title'),
                content: stripHtmlTags(item.description || item.content || ''),
                url: item.link || '',
                publishedAt: new Date(item.pubDate || Date.now()),
                importance: Math.floor(Math.random() * 5) + 1, // ランダム重要度
                category: 'Google News Today',
                summary: stripHtmlTags(item.description || item.content || ''),
                isDeliveryTarget: true,
                isTranslated: false,
                informationAcquisitionDate: new Date(),
                deliveryStatus: 'pending',
                createdAt: new Date()
            };
            // 重複チェック
            const existingNews = await db.collection("news")
                .where("companyId", "==", company.id)
                .where("url", "==", newsData.url)
                .limit(1)
                .get();
            if (existingNews.empty) {
                await db.collection("news").add(newsData);
                firebase_functions_1.logger.info(`Added today's news: ${item.title}`);
            }
            else {
                firebase_functions_1.logger.info(`Skipped duplicate today's news: ${item.title}`);
            }
        }
    }
    catch (error) {
        firebase_functions_1.logger.error(`Error collecting today's Google News for ${company.name}:`, error);
    }
}
// 簡易RSS解析関数
function parseRSSFeed(xmlText) {
    const items = [];
    // 簡易的なXML解析
    const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];
    for (const itemXml of itemMatches) {
        const title = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
            itemXml.match(/<title>(.*?)<\/title>/);
        const link = itemXml.match(/<link>(.*?)<\/link>/);
        const description = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
            itemXml.match(/<description>(.*?)<\/description>/);
        const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
        if (title) {
            items.push({
                title: stripHtmlTags(title[1]),
                link: link ? link[1] : '',
                description: description ? stripHtmlTags(description[1]) : '',
                pubDate: pubDate ? pubDate[1] : ''
            });
        }
    }
    return items;
}
// 企業一覧取得API
exports.getCompanies = (0, https_1.onRequest)({
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"]
}, async (req, res) => {
    try {
        // インデックス構築中は簡素なクエリを使用
        const companiesSnapshot = await db.collection("companies")
            .where("isActive", "==", true)
            .get();
        const companies = companiesSnapshot.docs.map(doc => {
            const data = doc.data();
            return Object.assign({ id: doc.id }, data);
        });
        // 作成日時でソート（クライアント側）
        companies.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        res.json({ success: true, data: companies });
    }
    catch (error) {
        firebase_functions_1.logger.error("Error fetching companies:", error);
        res.status(500).json({ success: false, error: "Failed to fetch companies" });
    }
});
// 企業追加API
exports.addCompany = (0, https_1.onRequest)({
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"]
}, async (req, res) => {
    try {
        const { name, url, rssUrl, redditUrl, priority } = req.body;
        if (!name || !url) {
            res.status(400).json({
                success: false,
                error: "Name and URL are required"
            });
            return;
        }
        const companyData = {
            name,
            url,
            rssUrl: rssUrl || "",
            redditUrl: redditUrl || "",
            priority: priority || 2,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const docRef = await db.collection("companies").add(companyData);
        res.json({
            success: true,
            data: Object.assign({ id: docRef.id }, companyData)
        });
    }
    catch (error) {
        firebase_functions_1.logger.error("Error adding company:", error);
        res.status(500).json({ success: false, error: "Failed to add company" });
    }
});
// 企業削除API
exports.deleteCompany = (0, https_1.onRequest)({
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"]
}, async (req, res) => {
    try {
        const { companyId } = req.body;
        if (!companyId) {
            res.status(400).json({
                success: false,
                error: "Company ID is required"
            });
            return;
        }
        await db.collection("companies").doc(companyId).delete();
        res.json({
            success: true,
            message: "企業が削除されました"
        });
    }
    catch (error) {
        firebase_functions_1.logger.error("Error deleting company:", error);
        res.status(500).json({ success: false, error: "Failed to delete company" });
    }
});
// 全ニュース記事削除API（テスト用）
exports.clearAllNews = (0, https_1.onRequest)({
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"]
}, async (req, res) => {
    try {
        const newsSnapshot = await db.collection("news").get();
        const batch = db.batch();
        newsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        res.json({
            success: true,
            message: `${newsSnapshot.docs.length}件の記事が削除されました`
        });
    }
    catch (error) {
        firebase_functions_1.logger.error("Error clearing news:", error);
        res.status(500).json({ success: false, error: "Failed to clear news" });
    }
});
// 配信対象記事の翻訳処理API
exports.translateDeliveryTargetNews = (0, https_1.onRequest)({
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"]
}, async (req, res) => {
    try {
        firebase_functions_1.logger.info("Starting translation process for delivery target news...");
        // 全記事を取得してからフィルタリング（複合クエリのインデックス問題を回避）
        const newsSnapshot = await db.collection("news").get();
        firebase_functions_1.logger.info(`Total articles found: ${newsSnapshot.docs.length}`);
        // 配信対象で未翻訳の記事をフィルタリング
        const targetNews = newsSnapshot.docs.filter(doc => {
            const data = doc.data();
            const isTarget = data.isDeliveryTarget === true && data.isTranslated === false;
            firebase_functions_1.logger.info(`Article ${doc.id}: isDeliveryTarget=${data.isDeliveryTarget}, isTranslated=${data.isTranslated}, isTarget=${isTarget}`);
            return isTarget;
        });
        firebase_functions_1.logger.info(`Found ${targetNews.length} articles to translate`);
        let translatedCount = 0;
        for (const doc of targetNews) {
            const article = doc.data();
            try {
                // 翻訳処理（エラー時はフォールバック翻訳を使用）
                const translatedTitle = await translateToJapanese(article.title);
                const translatedContent = await translateToJapanese(article.content);
                const translatedSummary = await translateToJapanese(article.summary);
                // 翻訳結果をDBに保存
                await doc.ref.update({
                    translatedTitle,
                    translatedContent,
                    translatedSummary,
                    isTranslated: true
                });
                translatedCount++;
                firebase_functions_1.logger.info(`Translated article: ${article.title} -> ${translatedTitle}`);
            }
            catch (translateError) {
                firebase_functions_1.logger.error(`Error translating article ${article.title}:`, translateError);
                // 翻訳エラーの場合はスキップ（フォールバック処理は禁止）
                firebase_functions_1.logger.warn(`Skipping translation for article: ${article.title}`);
            }
        }
        res.json({
            success: true,
            message: `${translatedCount}件の記事を翻訳しました`
        });
    }
    catch (error) {
        firebase_functions_1.logger.error("Error in translation process:", error);
        res.status(500).json({ success: false, error: "Failed to translate articles" });
    }
});
// 配信処理API（Slack送信）
exports.deliverNews = (0, https_1.onRequest)({
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"]
}, async (req, res) => {
    try {
        firebase_functions_1.logger.info("Starting news delivery process...");
        // 全記事を取得してからフィルタリング
        const newsSnapshot = await db.collection("news").get();
        // 配信対象で翻訳済み、未配信の記事をフィルタリング
        const targetNews = newsSnapshot.docs.filter(doc => {
            const data = doc.data();
            return data.isDeliveryTarget === true &&
                data.isTranslated === true &&
                data.deliveryStatus === "pending";
        });
        firebase_functions_1.logger.info(`Found ${targetNews.length} articles to deliver`);
        let deliveredCount = 0;
        for (const doc of targetNews) {
            const article = doc.data();
            try {
                // Slack送信処理（TODO: 実際のSlack API実装）
                const slackMessage = {
                    title: article.translatedTitle || article.title,
                    content: article.translatedContent || article.translatedSummary || article.content,
                    url: article.url,
                    category: article.category,
                    acquisitionDate: article.informationAcquisitionDate
                };
                // TODO: 実際のSlack API呼び出し
                firebase_functions_1.logger.info(`Delivering to Slack: ${slackMessage.title}`);
                // 配信ステータスを更新
                await doc.ref.update({
                    deliveryStatus: 'delivered',
                    deliveryDate: new Date()
                });
                deliveredCount++;
                firebase_functions_1.logger.info(`Delivered article: ${article.title}`);
            }
            catch (deliveryError) {
                firebase_functions_1.logger.error(`Error delivering article ${article.title}:`, deliveryError);
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
        firebase_functions_1.logger.error("Error in delivery process:", error);
        res.status(500).json({ success: false, error: "Failed to deliver articles" });
    }
});
// ニュース記事一覧取得API（配信対象の記事のみ）
exports.getNews = (0, https_1.onRequest)({
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"]
}, async (req, res) => {
    try {
        const { companyId, limit = 10 } = req.query;
        let newsSnapshot;
        if (companyId) {
            newsSnapshot = await db.collection("news")
                .where("companyId", "==", companyId)
                .get();
        }
        else {
            newsSnapshot = await db.collection("news").get();
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
        firebase_functions_1.logger.error("Error fetching news:", error);
        res.status(500).json({ success: false, error: "Failed to fetch news" });
    }
});
// 情報収集実行API
exports.runCollection = (0, https_1.onRequest)({
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"]
}, async (req, res) => {
    try {
        firebase_functions_1.logger.info("Starting news collection process...");
        // アクティブな企業を取得
        const companiesSnapshot = await db.collection("companies")
            .where("isActive", "==", true)
            .get();
        const companies = companiesSnapshot.docs.map(doc => {
            const data = doc.data();
            return Object.assign({ id: doc.id }, data);
        });
        firebase_functions_1.logger.info(`Found ${companies.length} active companies`);
        let collectedCount = 0;
        // 各企業のRSSフィードを収集
        for (const company of companies) {
            try {
                firebase_functions_1.logger.info(`Collecting news for ${company.name}...`);
                // RSSフィードが設定されている場合のみ処理
                if (company.rssUrl) {
                    await collectRSSFeed(company);
                    collectedCount++;
                }
                if (company.redditUrl) {
                    await collectRedditFeed(company);
                    collectedCount++;
                }
                // 実データ：当日のGoogle News記事を収集
                await collectTodaysGoogleNews(company, 20);
                collectedCount++;
            }
            catch (error) {
                firebase_functions_1.logger.error(`Error collecting news for ${company.name}:`, error);
            }
        }
        res.json({
            success: true,
            message: `${companies.length}社から${collectedCount}件の情報収集が完了しました`
        });
    }
    catch (error) {
        firebase_functions_1.logger.error("Error in runCollection:", error);
        res.status(500).json({
            success: false,
            error: "情報収集の実行中にエラーが発生しました"
        });
    }
});
// 日次レポート送信API
exports.sendDailyReport = (0, https_1.onRequest)({
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"]
}, async (req, res) => {
    try {
        firebase_functions_1.logger.info("日次レポートが送信されました (モック)");
        // ここに実際の日次レポート送信ロジックを実装
        res.json({ success: true, message: "日次レポートが送信されました (モック)" });
    }
    catch (error) {
        firebase_functions_1.logger.error("Error sending daily report:", error);
        res.status(500).json({ success: false, error: "Failed to send daily report" });
    }
});
// 週次レポート送信API
exports.sendWeeklyReport = (0, https_1.onRequest)({
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"]
}, async (req, res) => {
    try {
        firebase_functions_1.logger.info("週次レポートが送信されました (モック)");
        // ここに実際の週次レポート送信ロジックを実装
        res.json({ success: true, message: "週次レポートが送信されました (モック)" });
    }
    catch (error) {
        firebase_functions_1.logger.error("Error sending weekly report:", error);
        res.status(500).json({ success: false, error: "Failed to send weekly report" });
    }
});
// 実データ収集API（テスト用）
exports.collectRealData = (0, https_1.onRequest)({
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"]
}, async (req, res) => {
    try {
        firebase_functions_1.logger.info("Starting real data collection...");
        // アクティブな企業を取得
        const companiesSnapshot = await db.collection("companies")
            .where("isActive", "==", true)
            .get();
        const companies = companiesSnapshot.docs.map(doc => {
            const data = doc.data();
            return Object.assign({ id: doc.id }, data);
        });
        firebase_functions_1.logger.info(`Found ${companies.length} active companies`);
        let collectedCount = 0;
        // 各企業に対して実データを収集
        for (const company of companies) {
            try {
                firebase_functions_1.logger.info(`Collecting real data for ${company.name}...`);
                // RSSフィードが設定されている場合のみ処理
                if (company.rssUrl) {
                    await collectRSSFeed(company);
                    collectedCount++;
                }
                if (company.redditUrl) {
                    await collectRedditFeed(company);
                    collectedCount++;
                }
                // 当日のGoogle News記事を収集
                await collectTodaysGoogleNews(company, 20);
                collectedCount++;
            }
            catch (error) {
                firebase_functions_1.logger.error(`Error collecting real data for ${company.name}:`, error);
            }
        }
        res.json({
            success: true,
            message: `${companies.length}社から${collectedCount}件の実データを収集しました`
        });
    }
    catch (error) {
        firebase_functions_1.logger.error("Error in collectRealData:", error);
        res.status(500).json({
            success: false,
            error: "実データ収集中にエラーが発生しました"
        });
    }
});
// 定期実行される情報収集 (毎日午前9時)
exports.scheduledCollection = (0, scheduler_1.onSchedule)("every day 09:00", async (event) => {
    firebase_functions_1.logger.info("定期情報収集が実行されました", event);
    try {
        // ここに実際の情報収集ロジックを実装
        // runCollection関数を呼び出すなど
        const dummyCompanySnapshot = await db.collection("companies").limit(1).get();
        let companyId = "dummy-company-id";
        if (!dummyCompanySnapshot.empty) {
            companyId = dummyCompanySnapshot.docs[0].id;
        }
        else {
            const newCompanyRef = await db.collection("companies").add({
                name: "Scheduled Dummy Company",
                url: "http://scheduled-dummy.com",
                priority: 2,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            companyId = newCompanyRef.id;
        }
        const dummyNews = {
            companyId: companyId,
            title: `定期収集ダミーニュース ${new Date().toLocaleString()}`,
            content: "これは定期収集されたダミーのニュース記事です。",
            url: `http://scheduled-dummy.com/news/${Date.now()}`,
            publishedAt: new Date(),
            importance: Math.floor(Math.random() * 5) + 1,
            category: "市場動向",
            summary: "これは定期収集されたダミーのニュース記事です。",
            isDeliveryTarget: true,
            isTranslated: false,
            informationAcquisitionDate: new Date(),
            deliveryStatus: 'pending',
            createdAt: new Date()
        };
        await db.collection("news").add(dummyNews);
        firebase_functions_1.logger.info("定期情報収集が完了しました");
    }
    catch (error) {
        firebase_functions_1.logger.error("定期情報収集中にエラーが発生しました:", error);
    }
});
//# sourceMappingURL=index.js.map