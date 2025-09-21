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
exports.deliverWeeklyReport = exports.deliverDailyReport = exports.scheduledCollection = exports.collectRealData = exports.sendWeeklyReport = exports.sendDailyReport = exports.runCollection = exports.getNews = exports.deliverNews = exports.translateDeliveryTargetNews = exports.cleanupNews = exports.clearAllNews = exports.deleteCompany = exports.updateCompany = exports.addCompany = exports.getCompanies = void 0;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const firebase_functions_1 = require("firebase-functions");
const params_1 = require("firebase-functions/params");
const dotenv = __importStar(require("dotenv"));
const config_1 = require("./config");
// .envファイルを読み込み
dotenv.config({ path: "../../.env" });
// Secret Managerからシークレットを定義
const openaiApiKey = (0, params_1.defineSecret)("openai-api-key");
const webAppUrl = (0, params_1.defineSecret)("web-app-url");
const openaiApiUrl = (0, params_1.defineSecret)("openai-api-url");
const googleNewsBaseUrl = (0, params_1.defineSecret)("google-news-base-url");
const slackWebhookUrl = (0, params_1.defineSecret)("slack-webhook-url");
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
        for (const item of items.slice(0, config_1.config.test.rssItemLimit)) { // 設定ファイルから取得
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
        for (const item of items.slice(0, config_1.config.test.redditItemLimit)) { // 設定ファイルから取得
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
// 設定ファイルとSecret Managerを使用した日本語翻訳関数
async function translateToJapanese(text) {
    var _a, _b, _c;
    try {
        firebase_functions_1.logger.info('Starting translation process...');
        // Secret ManagerからAPIキーとURLを取得
        const OPENAI_API_KEY = openaiApiKey.value();
        const OPENAI_API_URL = openaiApiUrl.value();
        firebase_functions_1.logger.info(`API Key exists: ${!!OPENAI_API_KEY}`);
        firebase_functions_1.logger.info(`API Key length: ${OPENAI_API_KEY ? OPENAI_API_KEY.length : 0}`);
        firebase_functions_1.logger.info(`API Key prefix: ${OPENAI_API_KEY ? OPENAI_API_KEY.substring(0, 10) + '...' : 'N/A'}`);
        if (!OPENAI_API_KEY) {
            throw new Error('OpenAI API key is required for translation. Please set openai-api-key secret in Secret Manager.');
        }
        firebase_functions_1.logger.info(`Translating text: ${text.substring(0, config_1.config.text.maxTitleLength)}...`);
        const requestBody = {
            model: config_1.config.ai.model,
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
            max_tokens: config_1.config.ai.maxTokens,
            temperature: config_1.config.ai.temperature,
        };
        firebase_functions_1.logger.info(`Request body: ${JSON.stringify(requestBody, null, 2)}`);
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });
        firebase_functions_1.logger.info(`Response status: ${response.status}`);
        firebase_functions_1.logger.info(`Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);
        if (!response.ok) {
            const errorText = await response.text();
            firebase_functions_1.logger.error(`OpenAI API error response: ${errorText}`);
            throw new Error(`OpenAI API error: ${response.status} - ${response.statusText} - ${errorText}`);
        }
        const data = await response.json();
        firebase_functions_1.logger.info(`Response data: ${JSON.stringify(data, null, 2)}`);
        const translatedText = (_c = (_b = (_a = data.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.trim();
        if (!translatedText) {
            firebase_functions_1.logger.error('No translation received from OpenAI API');
            throw new Error('No translation received from OpenAI API');
        }
        firebase_functions_1.logger.info(`Translation successful: ${translatedText.substring(0, config_1.config.text.maxTitleLength)}...`);
        return translatedText;
    }
    catch (error) {
        firebase_functions_1.logger.error('Translation error:', error);
        throw error;
    }
}
// 【テスト用】Google Newsから過去一週間のランダム記事を取得する関数
// 企業非依存で、テスト目的の記事収集を行う
async function collectTestRandomGoogleNews(count = config_1.config.test.randomArticleCount) {
    try {
        firebase_functions_1.logger.info(`Collecting ${count} random Google News articles from the past week`);
        // 過去一週間の日付範囲を取得
        const today = new Date();
        const oneWeekAgo = new Date(today.getTime() - config_1.config.time.pastWeekDays * 24 * 60 * 60 * 1000);
        const todayStr = today.toISOString().split('T')[0];
        const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];
        firebase_functions_1.logger.info(`Searching for articles from ${oneWeekAgoStr} to ${todayStr}`);
        // 様々なキーワードでGoogle Newsを検索（過去一週間）
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
            const googleNewsBaseUrlValue = googleNewsBaseUrl.value();
            const googleNewsUrl = `${googleNewsBaseUrlValue}?q=${encodeURIComponent(keyword)}&hl=en-US&gl=US&ceid=US:en&when:7d`;
            firebase_functions_1.logger.info(`Searching with keyword: ${keyword}`);
            try {
                const response = await fetch(googleNewsUrl);
                const xmlText = await response.text();
                const items = parseRSSFeed(xmlText);
                firebase_functions_1.logger.info(`Found ${items.length} articles for keyword: ${keyword}`);
                // 過去一週間の記事をフィルタリング
                const recentItems = items.filter(item => {
                    if (!item.pubDate)
                        return false;
                    const itemDate = new Date(item.pubDate);
                    return itemDate >= oneWeekAgo && itemDate <= today;
                });
                firebase_functions_1.logger.info(`Found ${recentItems.length} recent articles for keyword: ${keyword}`);
                allArticles = allArticles.concat(recentItems);
                // 少し待機してAPI制限を避ける
                await new Promise(resolve => setTimeout(resolve, config_1.config.ai.apiWaitTime));
            }
            catch (error) {
                firebase_functions_1.logger.error(`Error fetching articles for keyword ${keyword}:`, error);
            }
        }
        // 重複を除去（URLベース）
        const uniqueArticles = allArticles.filter((article, index, self) => index === self.findIndex(a => a.link === article.link));
        firebase_functions_1.logger.info(`Total unique recent articles found: ${uniqueArticles.length}`);
        // ランダムに記事を選択（最大count件）
        const shuffledItems = uniqueArticles.sort(() => 0.5 - Math.random());
        const selectedItems = shuffledItems.slice(0, count);
        firebase_functions_1.logger.info(`Selected ${selectedItems.length} random articles`);
        // 既存のテスト用ランダム記事をチェックして重複を避ける
        const existingUrls = new Set();
        const existingNewsSnapshot = await db.collection("news")
            .where("category", "==", config_1.config.test.testCategoryName)
            .get();
        existingNewsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            existingUrls.add(data.url);
        });
        firebase_functions_1.logger.info(`Found ${existingUrls.size} existing test random articles`);
        let addedCount = 0;
        for (const item of selectedItems) {
            // 重複チェック（URLベース）
            if (existingUrls.has(item.link || '')) {
                firebase_functions_1.logger.info(`Skipped duplicate article: ${item.title}`);
                continue;
            }
            const newsData = {
                companyId: config_1.config.test.testCompanyId, // テスト用ランダム記事の識別子
                title: stripHtmlTags(item.title || 'No title'),
                content: stripHtmlTags(item.description || item.content || ''),
                url: item.link || '',
                publishedAt: new Date(item.pubDate || Date.now()),
                importance: Math.floor(Math.random() * 5) + 1, // ランダム重要度
                category: config_1.config.test.testCategoryName, // テスト用ランダム記事であることを明示
                summary: stripHtmlTags(item.description || item.content || ''),
                isDeliveryTarget: true,
                isTranslated: false,
                informationAcquisitionDate: new Date(),
                deliveryStatus: 'pending',
                createdAt: new Date()
            };
            await db.collection("news").add(newsData);
            existingUrls.add(item.link || '');
            addedCount++;
            firebase_functions_1.logger.info(`Added test random news: ${item.title}`);
        }
        firebase_functions_1.logger.info(`Successfully added ${addedCount} new test random articles`);
    }
    catch (error) {
        firebase_functions_1.logger.error(`Error collecting test random Google News:`, error);
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
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [webAppUrl]
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
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [webAppUrl]
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
// 企業編集API
exports.updateCompany = (0, https_1.onRequest)({
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [webAppUrl]
}, async (req, res) => {
    try {
        const { companyId, name, rssUrl, redditUrl } = req.body;
        if (!companyId) {
            res.status(400).json({
                success: false,
                error: "Company ID is required"
            });
            return;
        }
        if (!name) {
            res.status(400).json({
                success: false,
                error: "Company name is required"
            });
            return;
        }
        const companyData = {
            name,
            rssUrl: rssUrl || null,
            redditUrl: redditUrl || null,
            updatedAt: new Date()
        };
        await db.collection("companies").doc(companyId).update(companyData);
        res.json({
            success: true,
            message: "企業情報が更新されました",
            data: Object.assign({ id: companyId }, companyData)
        });
    }
    catch (error) {
        firebase_functions_1.logger.error("Error updating company:", error);
        res.status(500).json({ success: false, error: "Failed to update company" });
    }
});
// 企業削除API
exports.deleteCompany = (0, https_1.onRequest)({
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [webAppUrl]
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
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [webAppUrl]
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
// 記事クリーンナップAPI（完全削除・デバッグ用）
exports.cleanupNews = (0, https_1.onRequest)({
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [webAppUrl]
}, async (req, res) => {
    try {
        firebase_functions_1.logger.info("Starting news cleanup process...");
        // 全記事を取得
        const newsSnapshot = await db.collection("news").get();
        const totalArticles = newsSnapshot.docs.length;
        firebase_functions_1.logger.info(`Found ${totalArticles} articles to delete`);
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
            const batch = db.batch();
            const batchDocs = newsSnapshot.docs.slice(i, i + batchSize);
            batchDocs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            deletedCount += batchDocs.length;
            firebase_functions_1.logger.info(`Deleted batch: ${deletedCount}/${totalArticles} articles`);
        }
        firebase_functions_1.logger.info(`News cleanup completed. Deleted ${deletedCount} articles`);
        res.json({
            success: true,
            message: `Successfully deleted ${deletedCount} articles from the database`
        });
    }
    catch (error) {
        firebase_functions_1.logger.error("Error during news cleanup:", error);
        res.status(500).json({
            success: false,
            error: "Failed to cleanup news articles"
        });
    }
});
// 配信対象記事の翻訳処理API
exports.translateDeliveryTargetNews = (0, https_1.onRequest)({
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [openaiApiKey, openaiApiUrl]
}, async (req, res) => {
    try {
        firebase_functions_1.logger.info("Starting translation process for delivery target news...");
        firebase_functions_1.logger.info(`Environment variables check: OPENAI_API_KEY exists: ${!!process.env.OPENAI_API_KEY}`);
        // 全記事を取得してからフィルタリング（複合クエリのインデックス問題を回避）
        const newsSnapshot = await db.collection("news").get();
        firebase_functions_1.logger.info(`Total articles found: ${newsSnapshot.docs.length}`);
        // 配信対象で未翻訳の記事をフィルタリング
        const targetNews = newsSnapshot.docs.filter(doc => {
            const data = doc.data();
            const isTarget = data.isDeliveryTarget === true && data.isTranslated === false;
            firebase_functions_1.logger.info(`Article ${doc.id}: isDeliveryTarget=${data.isDeliveryTarget}, isTranslated=${data.isTranslated}, isTarget=${isTarget}, title=${data.title.substring(0, 50)}...`);
            return isTarget;
        });
        firebase_functions_1.logger.info(`Found ${targetNews.length} articles to translate`);
        if (targetNews.length === 0) {
            firebase_functions_1.logger.warn("No articles found for translation. Checking all articles...");
            newsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                firebase_functions_1.logger.info(`Article ${doc.id}: isDeliveryTarget=${data.isDeliveryTarget}, isTranslated=${data.isTranslated}, title=${data.title.substring(0, 50)}...`);
            });
        }
        let translatedCount = 0;
        for (const doc of targetNews) {
            const article = doc.data();
            try {
                firebase_functions_1.logger.info(`Starting translation for article: ${article.title.substring(0, 100)}...`);
                // 翻訳処理（エラー時はフォールバック翻訳を使用）
                const translatedTitle = await translateToJapanese(article.title);
                firebase_functions_1.logger.info(`Title translation completed: ${translatedTitle.substring(0, 100)}...`);
                const translatedContent = await translateToJapanese(article.content);
                firebase_functions_1.logger.info(`Content translation completed: ${translatedContent.substring(0, 100)}...`);
                const translatedSummary = await translateToJapanese(article.summary);
                firebase_functions_1.logger.info(`Summary translation completed: ${translatedSummary.substring(0, 100)}...`);
                // 翻訳結果をDBに保存
                await doc.ref.update({
                    translatedTitle,
                    translatedContent,
                    translatedSummary,
                    isTranslated: true
                });
                translatedCount++;
                firebase_functions_1.logger.info(`Successfully translated and saved article: ${article.title} -> ${translatedTitle}`);
            }
            catch (translateError) {
                firebase_functions_1.logger.error(`Error translating article ${article.title}:`, translateError);
                // 翻訳エラーの場合はスキップ（フォールバック処理は禁止）
                firebase_functions_1.logger.warn(`Skipping translation for article: ${article.title}`);
            }
        }
        firebase_functions_1.logger.info(`Translation process completed. Translated ${translatedCount} articles.`);
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
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [webAppUrl, slackWebhookUrl]
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
                // Slack送信処理
                const slackMessage = {
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
                // Slack Webhook API呼び出し
                try {
                    const response = await fetch(slackWebhookUrl.value(), {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(slackMessage)
                    });
                    if (!response.ok) {
                        throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
                    }
                    firebase_functions_1.logger.info(`Successfully delivered to Slack: ${slackMessage.text}`);
                }
                catch (slackError) {
                    firebase_functions_1.logger.error(`Slack delivery failed: ${slackError}`);
                    throw slackError;
                }
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
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [webAppUrl]
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
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [webAppUrl]
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
            }
            catch (error) {
                firebase_functions_1.logger.error(`Error collecting news for ${company.name}:`, error);
            }
        }
        // 【テスト用】ランダム記事収集（企業非依存、20件）
        // テスト目的で、過去一週間のGoogle Newsからランダムに記事を収集
        await collectTestRandomGoogleNews(20);
        collectedCount++;
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
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [webAppUrl]
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
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [webAppUrl]
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
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [webAppUrl]
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
            }
            catch (error) {
                firebase_functions_1.logger.error(`Error collecting real data for ${company.name}:`, error);
            }
        }
        // 【テスト用】ランダム記事収集（企業非依存、20件）
        // テスト目的で、過去一週間のGoogle Newsからランダムに記事を収集
        await collectTestRandomGoogleNews(20);
        collectedCount++;
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
exports.scheduledCollection = (0, scheduler_1.onSchedule)(config_1.config.schedule.collectionTime, async (event) => {
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
// 日次レポート配信API
exports.deliverDailyReport = (0, https_1.onRequest)({
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [webAppUrl, slackWebhookUrl]
}, async (req, res) => {
    try {
        const { date } = req.body;
        const targetDate = date || new Date().toISOString().split('T')[0];
        firebase_functions_1.logger.info(`Starting daily report delivery for ${targetDate}...`);
        // 指定日の記事を取得
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);
        const newsSnapshot = await db.collection("news").get();
        const dailyNews = newsSnapshot.docs.filter(doc => {
            const data = doc.data();
            const articleDate = new Date(data.publishedAt);
            return articleDate >= startOfDay && articleDate <= endOfDay;
        }).map(doc => doc.data());
        const translatedNews = dailyNews.filter(article => article.isTranslated);
        const untranslatedNews = dailyNews.filter(article => !article.isTranslated);
        // 日次レポートメッセージを生成
        const slackMessage = {
            text: `📰 日次ニュースレポート - ${targetDate}`,
            blocks: [
                {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: `📰 日次ニュースレポート - ${targetDate}`
                    }
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `本日 ${dailyNews.length} 件の記事を確認しました。\n（翻訳済み: ${translatedNews.length}件、未翻訳: ${untranslatedNews.length}件）`
                    }
                }
            ]
        };
        // 主要記事を追加（最大5件）
        if (dailyNews.length > 0) {
            slackMessage.blocks.push({
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "*📋 主要記事:*"
                }
            });
            dailyNews.slice(0, 5).forEach(article => {
                slackMessage.blocks.push({
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*${article.isTranslated ? article.translatedTitle : article.title}*\n${article.isTranslated ? article.translatedContent : article.content}`
                    }
                });
                slackMessage.blocks.push({
                    type: "context",
                    elements: [
                        {
                            type: "mrkdwn",
                            text: `重要度: ${article.importance}/5 | ${article.category} | ${article.isTranslated ? '翻訳済み' : '未翻訳'}`
                        }
                    ]
                });
            });
            if (dailyNews.length > 5) {
                slackMessage.blocks.push({
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `...他 ${dailyNews.length - 5} 件`
                    }
                });
            }
        }
        else {
            slackMessage.blocks.push({
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "本日の記事はありません。"
                }
            });
        }
        // Slack送信
        const response = await fetch(slackWebhookUrl.value(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(slackMessage)
        });
        if (!response.ok) {
            throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
        }
        firebase_functions_1.logger.info(`Daily report delivered successfully for ${targetDate}`);
        res.json({
            success: true,
            message: `日次レポートを配信しました（${dailyNews.length}件の記事）`
        });
    }
    catch (error) {
        firebase_functions_1.logger.error("Error in daily report delivery:", error);
        res.status(500).json({
            success: false,
            error: "Failed to deliver daily report"
        });
    }
});
// 週次レポート配信API
exports.deliverWeeklyReport = (0, https_1.onRequest)({
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [webAppUrl, slackWebhookUrl]
}, async (req, res) => {
    try {
        const { weekStart } = req.body;
        const targetWeekStart = weekStart || new Date().toISOString().split('T')[0];
        firebase_functions_1.logger.info(`Starting weekly report delivery for week starting ${targetWeekStart}...`);
        // 指定週の記事を取得
        const startOfWeek = new Date(targetWeekStart);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        const newsSnapshot = await db.collection("news").get();
        const weeklyNews = newsSnapshot.docs.filter(doc => {
            const data = doc.data();
            const articleDate = new Date(data.publishedAt);
            return articleDate >= startOfWeek && articleDate <= endOfWeek;
        }).map(doc => doc.data());
        // const translatedNews = weeklyNews.filter(article => article.isTranslated);
        // 企業別に記事をグループ化
        const newsByCompany = weeklyNews.reduce((acc, article) => {
            const companyId = article.companyId;
            if (!acc[companyId])
                acc[companyId] = [];
            acc[companyId].push(article);
            return acc;
        }, {});
        // 競合の動きサマリ生成
        const competitorSummary = generateCompetitorSummary(weeklyNews);
        // 各社の動きサマリ生成
        const companySummaries = Object.entries(newsByCompany).map(([companyId, articles]) => {
            const companyName = companyId === 'TEST_RANDOM' ? 'テスト用ランダム記事' : `企業ID: ${companyId}`;
            return {
                companyId,
                companyName,
                summary: generateCompanySummary(articles)
            };
        });
        // 自社が取るべき動き生成
        const strategicAction = generateStrategicAction(weeklyNews, companySummaries);
        // 週次レポートメッセージを生成
        const slackMessage = {
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
                        text: `*${company.companyName}*\n${company.summary}`
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
        // Slack送信
        const response = await fetch(slackWebhookUrl.value(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(slackMessage)
        });
        if (!response.ok) {
            throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
        }
        firebase_functions_1.logger.info(`Weekly report delivered successfully for week starting ${targetWeekStart}`);
        res.json({
            success: true,
            message: `週次レポートを配信しました（${weeklyNews.length}件の記事）`
        });
    }
    catch (error) {
        firebase_functions_1.logger.error("Error in weekly report delivery:", error);
        res.status(500).json({
            success: false,
            error: "Failed to deliver weekly report"
        });
    }
});
// ヘルパー関数
function generateCompetitorSummary(weeklyNews) {
    if (weeklyNews.length === 0) {
        return "今週は競合の動きに関する記事はありませんでした。";
    }
    const categories = weeklyNews.reduce((acc, article) => {
        acc[article.category] = (acc[article.category] || 0) + 1;
        return acc;
    }, {});
    const topCategories = Object.entries(categories)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([category, count]) => `${category}(${count}件)`)
        .join('、');
    const highImportanceCount = weeklyNews.filter(a => a.importance >= 4).length;
    const highImportanceText = highImportanceCount > 0 ? `特に重要度の高い記事が${highImportanceCount}件` : '';
    return `今週は競合から${weeklyNews.length}件の記事が確認されました。主な分野は${topCategories}です。${highImportanceText}。市場では技術革新や新サービス発表が活発で、競合各社が積極的な動きを見せています。`;
}
function generateCompanySummary(articles) {
    if (articles.length === 0) {
        return "今週の動きはありませんでした。";
    }
    const translatedArticles = articles.filter(a => a.isTranslated);
    const mainTopics = articles.slice(0, 2).map(a => a.isTranslated ? a.translatedTitle : a.title).join('、');
    return `${articles.length}件の記事を確認。主な内容は「${mainTopics}」など。${translatedArticles.length}件が翻訳済み。`;
}
function generateStrategicAction(weeklyNews, companySummaries) {
    if (weeklyNews.length === 0) {
        return "今週は競合の動きが少なく、現状維持を継続することを推奨します。市場の動向を引き続き監視し、次週以降の動きに備えてください。";
    }
    const highImportanceArticles = weeklyNews.filter(a => a.importance >= 4);
    const activeCompanies = companySummaries.filter(c => c.summary !== "今週の動きはありませんでした。");
    let action = "今週の競合動向を踏まえ、以下の対応を推奨します：";
    if (highImportanceArticles.length > 0) {
        action += ` 高重要度記事${highImportanceArticles.length}件について詳細分析を実施し、`;
    }
    if (activeCompanies.length > 0) {
        action += ` 特に活発な${activeCompanies.length}社の動向を重点監視し、`;
    }
    action += " 自社の戦略的ポジションを再評価することをお勧めします。市場の変化に迅速に対応できる体制を整備してください。";
    return action;
}
//# sourceMappingURL=index.js.map