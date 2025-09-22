"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectRSSFeed = collectRSSFeed;
exports.collectRedditFeed = collectRedditFeed;
exports.collectTestRandomGoogleNews = collectTestRandomGoogleNews;
const context_1 = require("../context");
const config_1 = require("../config");
const rss_1 = require("../utils/rss");
const text_1 = require("../utils/text");
const date_1 = require("../utils/date");
const context_2 = require("../context");
/**
 * RSSフィード収集関数
 * @param company 企業情報
 */
async function collectRSSFeed(company) {
    try {
        if (!company.rssUrl) {
            context_1.logger.warn(`No RSS URL configured for company: ${company.name}`);
            return;
        }
        context_1.logger.info(`Collecting RSS for ${company.name}: ${company.rssUrl}`);
        // RSSフィードの取得
        const response = await fetch(company.rssUrl);
        context_1.logger.info(`RSS response status: ${response.status}`);
        const xmlText = await response.text();
        context_1.logger.info(`RSS content length: ${xmlText.length}`);
        // 簡易的なRSS解析
        const items = (0, rss_1.parseRSSFeed)(xmlText);
        context_1.logger.info(`Parsed ${items.length} items from RSS`);
        for (const item of items.slice(0, config_1.config.test.rssItemLimit)) {
            const newsData = {
                companyId: company.id,
                title: (0, text_1.stripHtmlTags)(item.title || 'No title'),
                content: (0, text_1.stripHtmlTags)(item.description || ''),
                url: item.link || '',
                publishedAt: new Date(item.pubDate || Date.now()),
                importance: 3, // デフォルト重要度
                category: 'RSS',
                summary: (0, text_1.stripHtmlTags)(item.description || ''),
                isDeliveryTarget: true, // 重複チェック後に設定
                isTranslated: false,
                informationAcquisitionDate: new Date(), // 情報取得日
                deliveryStatus: 'pending', // 配信ステータス
                createdAt: new Date()
            };
            context_1.logger.info(`Processing item: ${item.title}`);
            // 重複チェック（同じURLの記事が既に存在するか）
            const existingNews = await context_1.db.collection("news")
                .where("companyId", "==", company.id)
                .where("url", "==", newsData.url)
                .limit(1)
                .get();
            if (existingNews.empty) {
                // 配信対象判定（現在は重複していないもののみ、将来的には重要度などで判定）
                newsData.isDeliveryTarget = true;
                await context_1.db.collection("news").add(newsData);
                context_1.logger.info(`Added news: ${item.title} (delivery target: ${newsData.isDeliveryTarget})`);
            }
            else {
                context_1.logger.info(`Skipped duplicate news: ${item.title}`);
            }
        }
    }
    catch (error) {
        context_1.logger.error(`Error collecting RSS for ${company.name}:`, error);
    }
}
/**
 * Redditフィード収集関数
 * @param company 企業情報
 */
async function collectRedditFeed(company) {
    try {
        if (!company.redditUrl) {
            context_1.logger.warn(`No Reddit URL configured for company: ${company.name}`);
            return;
        }
        context_1.logger.info(`Collecting Reddit for ${company.name}: ${company.redditUrl}`);
        // Reddit RSSの取得
        const response = await fetch(company.redditUrl);
        const xmlText = await response.text();
        const items = (0, rss_1.parseRSSFeed)(xmlText);
        for (const item of items.slice(0, config_1.config.test.redditItemLimit)) {
            const newsData = {
                companyId: company.id,
                title: (0, text_1.stripHtmlTags)(item.title || 'No title'),
                content: (0, text_1.stripHtmlTags)(item.description || ''),
                url: item.link || '',
                publishedAt: new Date(item.pubDate || Date.now()),
                importance: 4, // Redditは重要度高め
                category: 'Reddit',
                summary: (0, text_1.stripHtmlTags)(item.description || ''),
                isDeliveryTarget: true, // 重複チェック後に設定
                isTranslated: false,
                informationAcquisitionDate: new Date(), // 情報取得日
                deliveryStatus: 'pending', // 配信ステータス
                createdAt: new Date()
            };
            // 重複チェック
            const existingNews = await context_1.db.collection("news")
                .where("companyId", "==", company.id)
                .where("url", "==", newsData.url)
                .limit(1)
                .get();
            if (existingNews.empty) {
                // 配信対象判定（現在は重複していないもののみ、将来的には重要度などで判定）
                newsData.isDeliveryTarget = true;
                await context_1.db.collection("news").add(newsData);
                context_1.logger.info(`Added Reddit news: ${item.title} (delivery target: ${newsData.isDeliveryTarget})`);
            }
            else {
                context_1.logger.info(`Skipped duplicate Reddit news: ${item.title}`);
            }
        }
    }
    catch (error) {
        context_1.logger.error(`Error collecting Reddit for ${company.name}:`, error);
    }
}
/**
 * 【テスト用】Google Newsから直近7日（当日含む）をJSTで分割し、各日5件以上を目標に収集
 * @param minPerDay 1日あたりの最小収集件数
 * @returns 追加された記事数
 */
async function collectTestRandomGoogleNews(minPerDay = 5) {
    try {
        const jstOffsetMs = 9 * 60 * 60 * 1000; // JST(+9:00)
        const baseNow = new Date();
        // 検索キーワード（一般×テック寄り）
        const keywordPools = [
            ['technology', 'tech news', 'innovation', 'startup', 'software', 'hardware', 'mobile', 'internet'],
            ['AI', 'artificial intelligence', 'machine learning', 'data science', 'cloud computing'],
            ['cybersecurity', 'blockchain', 'fintech', 'ecommerce', 'social media']
        ];
        // 既存URL（重複保存防止）
        const existingUrls = new Set();
        const existing = await context_1.db.collection('news').where('category', '==', config_1.config.test.testCategoryName).get();
        existing.docs.forEach(d => existingUrls.add(d.data().url));
        // 7日分ループ（当日→過去へ）
        let totalAdded = 0;
        for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
            const jstDay = new Date(baseNow.getTime() - dayIdx * 24 * 60 * 60 * 1000);
            const ymd = new Date(jstDay.getTime() + jstOffsetMs).toISOString().split('T')[0];
            // JST日の境界
            const startJST = (0, date_1.toJstStartOfDay)(ymd);
            const endJST = (0, date_1.toJstEndOfDay)(ymd);
            context_1.logger.info(`[RandomCollect] Target JST day=${ymd}`);
            const collectedForDay = [];
            let poolIndex = 0;
            let attempts = 0;
            while (collectedForDay.length < minPerDay && attempts < 12) {
                const pool = keywordPools[poolIndex % keywordPools.length];
                const keyword = pool[attempts % pool.length];
                attempts++;
                poolIndex++;
                try {
                    const base = context_2.googleNewsBaseUrl.value();
                    // Google News RSSは厳密な日付指定ができないため、広く取得しpubDateでJST日付にフィルタ
                    const url = `${base}?q=${encodeURIComponent(keyword)}&hl=en-US&gl=US&ceid=US:en`;
                    const resp = await fetch(url);
                    const xml = await resp.text();
                    const items = (0, rss_1.parseRSSFeed)(xml);
                    // JST日付でフィルタ
                    const dayItems = items.filter(it => {
                        if (!it.pubDate)
                            return false;
                        const d = new Date(it.pubDate);
                        return d >= startJST && d <= endJST;
                    });
                    for (const it of dayItems) {
                        if (!it.link || existingUrls.has(it.link))
                            continue;
                        collectedForDay.push(it);
                        if (collectedForDay.length >= minPerDay)
                            break;
                    }
                    await new Promise(r => setTimeout(r, 300));
                }
                catch (e) {
                    context_1.logger.warn(`[RandomCollect] keyword fetch failed: ${keyword}`);
                }
            }
            context_1.logger.info(`[RandomCollect] Collected for ${ymd}: ${collectedForDay.length}`);
            // 保存
            for (const it of collectedForDay) {
                const newsData = {
                    companyId: config_1.config.test.testCompanyId,
                    title: (0, text_1.stripHtmlTags)(it.title || 'No title'),
                    content: (0, text_1.stripHtmlTags)(it.description || ''),
                    url: it.link || '',
                    publishedAt: new Date(it.pubDate || Date.now()),
                    importance: 3,
                    category: config_1.config.test.testCategoryName,
                    summary: (0, text_1.stripHtmlTags)(it.description || ''),
                    isDeliveryTarget: true,
                    isTranslated: false,
                    informationAcquisitionDate: new Date(),
                    deliveryStatus: 'pending',
                    createdAt: new Date()
                };
                await context_1.db.collection('news').add(newsData);
                existingUrls.add(it.link || '');
                totalAdded++;
            }
            context_1.logger.info(`[RandomCollect] Saved for ${ymd}: ${collectedForDay.length}`);
        }
        context_1.logger.info(`[RandomCollect] Total added: ${totalAdded}`);
        return totalAdded;
    }
    catch (error) {
        context_1.logger.error('Error collecting test random Google News:', error);
        return 0;
    }
}
//# sourceMappingURL=collect.js.map