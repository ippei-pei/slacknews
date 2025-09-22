import { db, logger } from '../context';
import { config } from '../config';
import { Company, NewsArticle } from '../types';
import { parseRSSFeed } from '../utils/rss';
import { stripHtmlTags } from '../utils/text';
import { toJstStartOfDay, toJstEndOfDay } from '../utils/date';
import { googleNewsBaseUrl } from '../context';

/**
 * RSSフィード収集関数
 * @param company 企業情報
 */
export async function collectRSSFeed(company: Company): Promise<void> {
  try {
    if (!company.rssUrl) {
      logger.warn(`No RSS URL configured for company: ${company.name}`);
      return;
    }

    logger.info(`Collecting RSS for ${company.name}: ${company.rssUrl}`);
    
    // RSSフィードの取得
    const response = await fetch(company.rssUrl);
    logger.info(`RSS response status: ${response.status}`);
    
    const xmlText = await response.text();
    logger.info(`RSS content length: ${xmlText.length}`);
    
    // 簡易的なRSS解析
    const items = parseRSSFeed(xmlText);
    logger.info(`Parsed ${items.length} items from RSS`);
    
    for (const item of items.slice(0, config.test.rssItemLimit)) {
      const newsData: Omit<NewsArticle, "id"> = {
        companyId: company.id,
        title: stripHtmlTags(item.title || 'No title'),
        content: stripHtmlTags(item.description || ''),
        url: item.link || '',
        publishedAt: new Date(item.pubDate || Date.now()),
        importance: 3, // デフォルト重要度
        category: 'RSS',
        summary: stripHtmlTags(item.description || ''),
        isDeliveryTarget: true, // 重複チェック後に設定
        isTranslated: false,
        informationAcquisitionDate: new Date(), // 情報取得日
        deliveryStatus: 'pending', // 配信ステータス
        createdAt: new Date()
      };

      logger.info(`Processing item: ${item.title}`);

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
        logger.info(`Added news: ${item.title} (delivery target: ${newsData.isDeliveryTarget})`);
      } else {
        logger.info(`Skipped duplicate news: ${item.title}`);
      }
    }
    
  } catch (error) {
    logger.error(`Error collecting RSS for ${company.name}:`, error);
  }
}

/**
 * Redditフィード収集関数
 * @param company 企業情報
 */
export async function collectRedditFeed(company: Company): Promise<void> {
  try {
    if (!company.redditUrl) {
      logger.warn(`No Reddit URL configured for company: ${company.name}`);
      return;
    }

    logger.info(`Collecting Reddit for ${company.name}: ${company.redditUrl}`);
    
    // Reddit RSSの取得
    const response = await fetch(company.redditUrl);
    const xmlText = await response.text();
    
    const items = parseRSSFeed(xmlText);
    
    for (const item of items.slice(0, config.test.redditItemLimit)) {
      const newsData: Omit<NewsArticle, "id"> = {
        companyId: company.id,
        title: stripHtmlTags(item.title || 'No title'),
        content: stripHtmlTags(item.description || ''),
        url: item.link || '',
        publishedAt: new Date(item.pubDate || Date.now()),
        importance: 4, // Redditは重要度高め
        category: 'Reddit',
        summary: stripHtmlTags(item.description || ''),
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
        logger.info(`Added Reddit news: ${item.title} (delivery target: ${newsData.isDeliveryTarget})`);
      } else {
        logger.info(`Skipped duplicate Reddit news: ${item.title}`);
      }
    }
    
  } catch (error) {
    logger.error(`Error collecting Reddit for ${company.name}:`, error);
  }
}

/**
 * 【テスト用】Google Newsから直近7日（当日含む）をJSTで分割し、各日5件以上を目標に収集
 * @param minPerDay 1日あたりの最小収集件数
 * @returns 追加された記事数
 */
export async function collectTestRandomGoogleNews(minPerDay: number = 5): Promise<number> {
  try {
    const jstOffsetMs = 9 * 60 * 60 * 1000; // JST(+9:00)
    const baseNow = new Date();

    // 検索キーワード（一般×テック寄り）
    const keywordPools: string[][] = [
      ['technology','tech news','innovation','startup','software','hardware','mobile','internet'],
      ['AI','artificial intelligence','machine learning','data science','cloud computing'],
      ['cybersecurity','blockchain','fintech','ecommerce','social media']
    ];

    // 既存URL（重複保存防止）
    const existingUrls = new Set<string>();
    const existing = await db.collection('news').where('category','==',config.test.testCategoryName).get();
    existing.docs.forEach(d => existingUrls.add((d.data() as any).url));

    // 7日分ループ（当日→過去へ）
    let totalAdded = 0;
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const jstDay = new Date(baseNow.getTime() - dayIdx * 24 * 60 * 60 * 1000);
      const ymd = new Date(jstDay.getTime() + jstOffsetMs).toISOString().split('T')[0];

      // JST日の境界
      const startJST = toJstStartOfDay(ymd);
      const endJST = toJstEndOfDay(ymd);

      logger.info(`[RandomCollect] Target JST day=${ymd}`);

      const collectedForDay: any[] = [];
      let poolIndex = 0;
      let attempts = 0;
      while (collectedForDay.length < minPerDay && attempts < 12) {
        const pool = keywordPools[poolIndex % keywordPools.length];
        const keyword = pool[attempts % pool.length];
        attempts++;
        poolIndex++;

        try {
          const base = googleNewsBaseUrl.value();
          // Google News RSSは厳密な日付指定ができないため、広く取得しpubDateでJST日付にフィルタ
          const url = `${base}?q=${encodeURIComponent(keyword)}&hl=en-US&gl=US&ceid=US:en`;
          const resp = await fetch(url);
          const xml = await resp.text();
          const items = parseRSSFeed(xml);

          // JST日付でフィルタ
          const dayItems = items.filter(it => {
            if (!it.pubDate) return false;
            const d = new Date(it.pubDate);
            return d >= startJST && d <= endJST;
          });

          for (const it of dayItems) {
            if (!it.link || existingUrls.has(it.link)) continue;
            collectedForDay.push(it);
            if (collectedForDay.length >= minPerDay) break;
          }
          await new Promise(r => setTimeout(r, 300));
        } catch (e) {
          logger.warn(`[RandomCollect] keyword fetch failed: ${keyword}`);
        }
      }

      logger.info(`[RandomCollect] Collected for ${ymd}: ${collectedForDay.length}`);

      // 保存
      for (const it of collectedForDay) {
        const newsData: Omit<NewsArticle,'id'> = {
          companyId: config.test.testCompanyId,
          title: stripHtmlTags(it.title || 'No title'),
          content: stripHtmlTags(it.description || ''),
          url: it.link || '',
          publishedAt: new Date(it.pubDate || Date.now()),
          importance: 3,
          category: config.test.testCategoryName,
          summary: stripHtmlTags(it.description || ''),
          isDeliveryTarget: true,
          isTranslated: false,
          informationAcquisitionDate: new Date(),
          deliveryStatus: 'pending',
          createdAt: new Date()
        };
        await db.collection('news').add(newsData);
        existingUrls.add(it.link || '');
        totalAdded++;
      }
      logger.info(`[RandomCollect] Saved for ${ymd}: ${collectedForDay.length}`);
    }
    logger.info(`[RandomCollect] Total added: ${totalAdded}`);
    return totalAdded;
  } catch (error) {
    logger.error('Error collecting test random Google News:', error);
    return 0;
  }
}
