import { db, logger } from '../context';
import { config } from '../config';
import { Company, NewsArticle } from '../types';
import { parseRSSFeed } from '../utils/rss';
import { stripHtmlTags } from '../utils/text';
// import { toJstStartOfDay, toJstEndOfDay } from '../utils/date'; // 一時的に無効化
// import { googleNewsBaseUrl } from '../context'; // 一時的に無効化

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
    logger.info(`[RandomCollect] Starting collection with minPerDay=${minPerDay}`);
    
    // 既存URL（重複保存防止）
    logger.info(`[RandomCollect] Loading existing URLs for category: ${config.test.testCategoryName}`);
    const existingUrls = new Set<string>();
    const existing = await db.collection('news').where('category','==',config.test.testCategoryName).get();
    existing.docs.forEach(d => existingUrls.add((d.data() as any).url));
    logger.info(`[RandomCollect] Found ${existingUrls.size} existing URLs to avoid duplicates`);

    // 代替RSSフィードを使用
    const alternativeFeeds = [
      'https://feeds.bbci.co.uk/news/technology/rss.xml',
      'https://rss.cnn.com/rss/edition_technology.rss',
      'https://feeds.feedburner.com/oreilly/radar/atom'
    ];
    
    let totalAdded = 0;
    const allCollectedArticles: any[] = [];
    
    // 複数のフィードから記事を収集
    for (let feedIndex = 0; feedIndex < alternativeFeeds.length && allCollectedArticles.length < minPerDay * 7; feedIndex++) {
      const url = alternativeFeeds[feedIndex];
      logger.info(`[RandomCollect] Fetching from feed ${feedIndex + 1}/${alternativeFeeds.length}: ${url}`);
      
      try {
        const resp = await fetch(url);
        logger.info(`[RandomCollect] Response status: ${resp.status}`);
        
        if (!resp.ok) {
          logger.warn(`[RandomCollect] HTTP error ${resp.status}: ${resp.statusText}`);
          continue;
        }
        
        const xml = await resp.text();
        logger.info(`[RandomCollect] XML length: ${xml.length} chars`);
        
        const items = parseRSSFeed(xml);
        logger.info(`[RandomCollect] Parsed ${items.length} RSS items`);
        
        if (items.length > 0) {
          logger.info(`[RandomCollect] First item: ${items[0].title}`);
        }
        
        // 記事をグローバルリストに追加
        for (const it of items) {
          if (!it.link) {
            logger.debug(`[RandomCollect] Skipping item without link: ${it.title}`);
            continue;
          }
          if (existingUrls.has(it.link)) {
            logger.debug(`[RandomCollect] Skipping duplicate URL: ${it.link}`);
            continue;
          }
          
          // 既に収集済みでないかチェック
          if (!allCollectedArticles.some(existing => existing.link === it.link)) {
            allCollectedArticles.push(it);
            existingUrls.add(it.link);
            logger.info(`[RandomCollect] Added item ${allCollectedArticles.length}: ${it.title}`);
          }
          
          // 十分な記事が集まったら終了
          if (allCollectedArticles.length >= minPerDay * 7) {
            logger.info(`[RandomCollect] Reached target: ${allCollectedArticles.length} articles`);
            break;
          }
        }
        
        await new Promise(r => setTimeout(r, 1000)); // レート制限対策
        
      } catch (e) {
        logger.error(`[RandomCollect] Feed fetch failed for "${url}":`, e);
      }
    }
    
    logger.info(`[RandomCollect] Collection summary: ${allCollectedArticles.length} articles collected`);
    
    // 保存処理
    logger.info(`[RandomCollect] Starting to save ${allCollectedArticles.length} articles`);
    for (let i = 0; i < allCollectedArticles.length; i++) {
      const it = allCollectedArticles[i];
      try {
        logger.info(`[RandomCollect] Saving article ${i + 1}/${allCollectedArticles.length}: ${it.title}`);
        
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
        totalAdded++;
        logger.info(`[RandomCollect] Successfully saved article ${totalAdded}: ${newsData.title}`);
      } catch (saveError) {
        logger.error(`[RandomCollect] Failed to save article ${i + 1}: ${it.title}`, saveError);
      }
    }
    
    logger.info(`[RandomCollect] Collection completed. Total added: ${totalAdded}`);
    return totalAdded;
  } catch (error) {
    logger.error('Error collecting test random Google News:', error);
    return 0;
  }
}
