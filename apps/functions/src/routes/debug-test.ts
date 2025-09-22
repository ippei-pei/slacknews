import { onRequest } from "firebase-functions/v2/https";
import { logger, webAppUrl, db } from '../context';
import { parseRSSFeed } from '../utils/rss';
import { config } from '../config';
import { NewsArticle } from '../types';

// デバッグ用テストAPI - 各段階を個別にテスト
export const debugTest = onRequest({
  cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
  secrets: [webAppUrl]
}, async (req, res) => {
  try {
    const { stage } = req.body || {};
    logger.info(`[DebugTest] Starting debug test for stage: ${stage}`);
    
    switch (stage) {
      case 'rss':
        return await testRSSFetch(res);
      case 'parse':
        return await testRSSParsing(res);
      case 'db':
        return await testDBSave(res);
      case 'dedup':
        return await testDeduplication(res);
      default:
        return await testAllStages(res);
    }
  } catch (error) {
    logger.error("[DebugTest] Debug test failed:", error);
    res.status(500).json({
      success: false,
      error: "デバッグテストに失敗しました",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// RSS取得テスト
async function testRSSFetch(res: any) {
  logger.info('[DebugTest] Testing RSS fetch');
  
  // 複数のRSSフィードをテスト
  const testUrls = [
    'https://feeds.bbci.co.uk/news/technology/rss.xml',
    'https://rss.cnn.com/rss/edition_technology.rss',
    'https://news.google.com/rss/search?q=technology&hl=en-US&gl=US&ceid=US:en'
  ];
  
  const results = [];
  
  for (const url of testUrls) {
    try {
      logger.info(`[DebugTest] Testing URL: ${url}`);
      const response = await fetch(url);
      logger.info(`[DebugTest] Response status for ${url}: ${response.status}`);
      
      if (response.ok) {
        const xml = await response.text();
        logger.info(`[DebugTest] XML length for ${url}: ${xml.length} chars`);
        results.push({
          url,
          status: response.status,
          xmlLength: xml.length,
          success: true
        });
      } else {
        results.push({
          url,
          status: response.status,
          error: `HTTP ${response.status}: ${response.statusText}`,
          success: false
        });
      }
    } catch (error) {
      logger.error(`[DebugTest] Error fetching ${url}:`, error);
      results.push({
        url,
        error: error instanceof Error ? error.message : String(error),
        success: false
      });
    }
  }
  
  res.json({
    success: true,
    message: 'RSS取得テスト完了',
    data: { results }
  });
}

// RSS解析テスト
async function testRSSParsing(res: any) {
  logger.info('[DebugTest] Testing RSS parsing');
  
  try {
    const url = 'https://news.google.com/rss/search?q=technology&hl=en-US&gl=US&ceid=US:en';
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    
    const xml = await response.text();
    logger.info(`[DebugTest] XML length: ${xml.length} chars`);
    
    const items = parseRSSFeed(xml);
    logger.info(`[DebugTest] Parsed ${items.length} items`);
    
    const firstItem = items.length > 0 ? items[0] : null;
    
    res.json({
      success: true,
      message: 'RSS解析テスト完了',
      data: {
        xmlLength: xml.length,
        itemCount: items.length,
        firstItem: firstItem ? {
          title: firstItem.title,
          link: firstItem.link,
          description: firstItem.description?.substring(0, 100),
          pubDate: firstItem.pubDate
        } : null
      }
    });
  } catch (error) {
    logger.error('[DebugTest] RSS parsing failed:', error);
    res.status(500).json({
      success: false,
      error: 'RSS解析テストに失敗しました',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

// DB保存テスト
async function testDBSave(res: any) {
  logger.info('[DebugTest] Testing DB save');
  
  try {
    const testArticle: Omit<NewsArticle,'id'> = {
      companyId: config.test.testCompanyId,
      title: 'Test Article - Debug',
      content: 'This is a test article for debugging purposes.',
      url: `https://test.com/debug-${Date.now()}`,
      publishedAt: new Date(),
      importance: 3,
      category: config.test.testCategoryName,
      summary: 'Test summary',
      isDeliveryTarget: true,
      isTranslated: false,
      informationAcquisitionDate: new Date(),
      deliveryStatus: 'pending',
      createdAt: new Date()
    };
    
    logger.info('[DebugTest] Saving test article to Firestore...');
    const docRef = await db.collection('news').add(testArticle);
    logger.info(`[DebugTest] Successfully saved with ID: ${docRef.id}`);
    
    res.json({
      success: true,
      message: 'DB保存テスト完了',
      data: {
        articleId: docRef.id,
        article: testArticle
      }
    });
  } catch (error) {
    logger.error('[DebugTest] DB save failed:', error);
    res.status(500).json({
      success: false,
      error: 'DB保存テストに失敗しました',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

// 重複排除テスト
async function testDeduplication(res: any) {
  logger.info('[DebugTest] Testing deduplication');
  
  try {
    // 既存記事の確認
    const existing = await db.collection('news')
      .where('category', '==', config.test.testCategoryName)
      .get();
    
    logger.info(`[DebugTest] Found ${existing.docs.length} existing articles`);
    
    const existingUrls = new Set<string>();
    existing.docs.forEach(d => {
      const data = d.data() as any;
      if (data.url) {
        existingUrls.add(data.url);
      }
    });
    
    logger.info(`[DebugTest] Found ${existingUrls.size} existing URLs`);
    
    res.json({
      success: true,
      message: '重複排除テスト完了',
      data: {
        totalArticles: existing.docs.length,
        uniqueUrls: existingUrls.size,
        sampleUrls: Array.from(existingUrls).slice(0, 5)
      }
    });
  } catch (error) {
    logger.error('[DebugTest] Deduplication test failed:', error);
    res.status(500).json({
      success: false,
      error: '重複排除テストに失敗しました',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

// 全段階テスト
async function testAllStages(res: any) {
  logger.info('[DebugTest] Testing all stages');
  
  const results = {
    rss: null as any,
    parse: null as any,
    db: null as any,
    dedup: null as any
  };
  
  try {
    // 1. RSS取得
    logger.info('[DebugTest] Stage 1: RSS fetch');
    const rssRes = { json: (data: any) => { results.rss = data; } };
    await testRSSFetch(rssRes);
    
    // 2. RSS解析
    logger.info('[DebugTest] Stage 2: RSS parsing');
    const parseRes = { json: (data: any) => { results.parse = data; } };
    await testRSSParsing(parseRes);
    
    // 3. 重複排除
    logger.info('[DebugTest] Stage 3: Deduplication');
    const dedupRes = { json: (data: any) => { results.dedup = data; } };
    await testDeduplication(dedupRes);
    
    // 4. DB保存（1件のみテスト）
    logger.info('[DebugTest] Stage 4: DB save');
    const dbRes = { json: (data: any) => { results.db = data; } };
    await testDBSave(dbRes);
    
    res.json({
      success: true,
      message: '全段階テスト完了',
      data: results
    });
  } catch (error) {
    logger.error('[DebugTest] All stages test failed:', error);
    res.status(500).json({
      success: false,
      error: '全段階テストに失敗しました',
      details: error instanceof Error ? error.message : String(error),
      partialResults: results
    });
  }
}
