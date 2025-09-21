import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import * as dotenv from "dotenv";
import { config } from "./config";

// .envファイルを読み込み
dotenv.config({ path: "../../.env" });

// Secret Managerからシークレットを定義
const openaiApiKey = defineSecret("openai-api-key");
const webAppUrl = defineSecret("web-app-url");
const openaiApiUrl = defineSecret("openai-api-url");
const googleNewsBaseUrl = defineSecret("google-news-base-url");

// Firebase Admin SDK を初期化
initializeApp();
const db = getFirestore();

// 型定義
interface Company {
  id: string;
  name: string;
  url: string;
  rssUrl?: string;
  redditUrl?: string;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface NewsArticle {
  id: string;
  companyId: string;
  title: string;
  content: string;
  url: string;
  publishedAt: Date;
  importance: number;
  category: string;
  summary: string;
  translatedTitle?: string;
  translatedContent?: string;
  translatedSummary?: string;
  isDeliveryTarget: boolean;
  isTranslated: boolean;
  informationAcquisitionDate: Date; // 情報取得日
  deliveryDate?: Date; // 配信日（配信対象のみ）
  deliveryStatus: 'pending' | 'delivered' | 'failed'; // 配信ステータス
  createdAt: Date;
}

// RSSフィード収集関数
async function collectRSSFeed(company: any) {
  try {
    logger.info(`Collecting RSS for ${company.name}: ${company.rssUrl}`);
    
    // RSSフィードの取得
    const response = await fetch(company.rssUrl);
    logger.info(`RSS response status: ${response.status}`);
    
    const xmlText = await response.text();
    logger.info(`RSS content length: ${xmlText.length}`);
    
    // 簡易的なRSS解析
    const items = parseRSSFeed(xmlText);
    logger.info(`Parsed ${items.length} items from RSS`);
    
    for (const item of items.slice(0, config.test.rssItemLimit)) { // 設定ファイルから取得
      const newsData: Omit<NewsArticle, "id"> = {
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

// Redditフィード収集関数
async function collectRedditFeed(company: any) {
  try {
    logger.info(`Collecting Reddit for ${company.name}: ${company.redditUrl}`);
    
    // Reddit RSSの取得
    const response = await fetch(company.redditUrl);
    const xmlText = await response.text();
    
    const items = parseRSSFeed(xmlText);
    
    for (const item of items.slice(0, config.test.redditItemLimit)) { // 設定ファイルから取得
      const newsData: Omit<NewsArticle, "id"> = {
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
        logger.info(`Added Reddit news: ${item.title} (delivery target: ${newsData.isDeliveryTarget})`);
      } else {
        logger.info(`Skipped duplicate Reddit news: ${item.title}`);
      }
    }
    
  } catch (error) {
    logger.error(`Error collecting Reddit for ${company.name}:`, error);
  }
}

// HTMLタグを除去する関数
function stripHtmlTags(html: string): string {
  if (!html) return '';
  
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
async function translateToJapanese(text: string): Promise<string> {
  try {
    logger.info('Starting translation process...');
    
    // Secret ManagerからAPIキーとURLを取得
    const OPENAI_API_KEY = openaiApiKey.value();
    const OPENAI_API_URL = openaiApiUrl.value();
    
    logger.info(`API Key exists: ${!!OPENAI_API_KEY}`);
    logger.info(`API Key length: ${OPENAI_API_KEY ? OPENAI_API_KEY.length : 0}`);
    logger.info(`API Key prefix: ${OPENAI_API_KEY ? OPENAI_API_KEY.substring(0, 10) + '...' : 'N/A'}`);
    
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key is required for translation. Please set openai-api-key secret in Secret Manager.');
    }

    logger.info(`Translating text: ${text.substring(0, config.text.maxTitleLength)}...`);

    const requestBody = {
      model: config.ai.model,
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
      max_tokens: config.ai.maxTokens,
      temperature: config.ai.temperature,
    };

    logger.info(`Request body: ${JSON.stringify(requestBody, null, 2)}`);

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    logger.info(`Response status: ${response.status}`);
    logger.info(`Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`OpenAI API error response: ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status} - ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    logger.info(`Response data: ${JSON.stringify(data, null, 2)}`);
    
    const translatedText = data.choices[0]?.message?.content?.trim();
    
    if (!translatedText) {
      logger.error('No translation received from OpenAI API');
      throw new Error('No translation received from OpenAI API');
    }

    logger.info(`Translation successful: ${translatedText.substring(0, config.text.maxTitleLength)}...`);
    return translatedText;
    
  } catch (error) {
    logger.error('Translation error:', error);
    throw error;
  }
}


// 【テスト用】Google Newsから過去一週間のランダム記事を取得する関数
// 企業非依存で、テスト目的の記事収集を行う
async function collectTestRandomGoogleNews(count: number = config.test.randomArticleCount) {
  try {
    logger.info(`Collecting ${count} random Google News articles from the past week`);
    
    // 過去一週間の日付範囲を取得
    const today = new Date();
    const oneWeekAgo = new Date(today.getTime() - config.time.pastWeekDays * 24 * 60 * 60 * 1000);
    const todayStr = today.toISOString().split('T')[0];
    const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];
    
    logger.info(`Searching for articles from ${oneWeekAgoStr} to ${todayStr}`);
    
    // 様々なキーワードでGoogle Newsを検索（過去一週間）
    const keywords = [
      'technology', 'AI', 'artificial intelligence', 'startup', 'innovation',
      'software', 'hardware', 'mobile', 'internet', 'cybersecurity',
      'blockchain', 'cryptocurrency', 'fintech', 'ecommerce', 'social media',
      'tech news', 'breaking news', 'latest technology', 'digital transformation',
      'cloud computing', 'machine learning', 'data science', 'programming'
    ];
    
    let allArticles: any[] = [];
    
    // 複数のキーワードで検索して記事を集める
    for (let i = 0; i < Math.min(keywords.length, 8); i++) {
      const keyword = keywords[i];
      const googleNewsBaseUrlValue = googleNewsBaseUrl.value();
      const googleNewsUrl = `${googleNewsBaseUrlValue}?q=${encodeURIComponent(keyword)}&hl=en-US&gl=US&ceid=US:en&when:7d`;
      
      logger.info(`Searching with keyword: ${keyword}`);
      
      try {
        const response = await fetch(googleNewsUrl);
        const xmlText = await response.text();
        
        const items = parseRSSFeed(xmlText);
        logger.info(`Found ${items.length} articles for keyword: ${keyword}`);
        
        // 過去一週間の記事をフィルタリング
        const recentItems = items.filter(item => {
          if (!item.pubDate) return false;
          const itemDate = new Date(item.pubDate);
          return itemDate >= oneWeekAgo && itemDate <= today;
        });
        
        logger.info(`Found ${recentItems.length} recent articles for keyword: ${keyword}`);
        allArticles = allArticles.concat(recentItems);
        
        // 少し待機してAPI制限を避ける
        await new Promise(resolve => setTimeout(resolve, config.ai.apiWaitTime));
        
      } catch (error) {
        logger.error(`Error fetching articles for keyword ${keyword}:`, error);
      }
    }
    
    // 重複を除去（URLベース）
    const uniqueArticles = allArticles.filter((article, index, self) => 
      index === self.findIndex(a => a.link === article.link)
    );
    
    logger.info(`Total unique recent articles found: ${uniqueArticles.length}`);
    
    // ランダムに記事を選択（最大count件）
    const shuffledItems = uniqueArticles.sort(() => 0.5 - Math.random());
    const selectedItems = shuffledItems.slice(0, count);
    
    logger.info(`Selected ${selectedItems.length} random articles`);
    
    // 既存のテスト用ランダム記事をチェックして重複を避ける
    const existingUrls = new Set<string>();
    const existingNewsSnapshot = await db.collection("news")
      .where("category", "==", config.test.testCategoryName)
      .get();
    
    existingNewsSnapshot.docs.forEach(doc => {
      const data = doc.data() as NewsArticle;
      existingUrls.add(data.url);
    });
    
    logger.info(`Found ${existingUrls.size} existing test random articles`);
    
    let addedCount = 0;
    for (const item of selectedItems) {
      // 重複チェック（URLベース）
      if (existingUrls.has(item.link || '')) {
        logger.info(`Skipped duplicate article: ${item.title}`);
        continue;
      }
      
      const newsData: Omit<NewsArticle, "id"> = {
        companyId: config.test.testCompanyId, // テスト用ランダム記事の識別子
        title: stripHtmlTags(item.title || 'No title'),
        content: stripHtmlTags(item.description || item.content || ''),
        url: item.link || '',
        publishedAt: new Date(item.pubDate || Date.now()),
        importance: Math.floor(Math.random() * 5) + 1, // ランダム重要度
        category: config.test.testCategoryName, // テスト用ランダム記事であることを明示
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
      logger.info(`Added test random news: ${item.title}`);
    }
    
    logger.info(`Successfully added ${addedCount} new test random articles`);
    
  } catch (error) {
    logger.error(`Error collecting test random Google News:`, error);
  }
}


// 簡易RSS解析関数
function parseRSSFeed(xmlText: string) {
  const items: any[] = [];
  
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
export const getCompanies = onRequest({ 
  cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
  secrets: [webAppUrl]
}, async (req, res) => {
  try {
    // インデックス構築中は簡素なクエリを使用
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

    // 作成日時でソート（クライアント側）
    companies.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ success: true, data: companies });
  } catch (error) {
    logger.error("Error fetching companies:", error);
    res.status(500).json({ success: false, error: "Failed to fetch companies" });
  }
});

// 企業追加API
export const addCompany = onRequest({ 
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

    const companyData: Omit<Company, "id"> = {
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
      data: { id: docRef.id, ...companyData }
    });
  } catch (error) {
    logger.error("Error adding company:", error);
    res.status(500).json({ success: false, error: "Failed to add company" });
  }
});

// 企業編集API
export const updateCompany = onRequest({ 
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
      data: { id: companyId, ...companyData }
    });
  } catch (error) {
    logger.error("Error updating company:", error);
    res.status(500).json({ success: false, error: "Failed to update company" });
  }
});

// 企業削除API
export const deleteCompany = onRequest({ 
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
  } catch (error) {
    logger.error("Error deleting company:", error);
    res.status(500).json({ success: false, error: "Failed to delete company" });
  }
});

// 全ニュース記事削除API（テスト用）
export const clearAllNews = onRequest({ 
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
  } catch (error) {
    logger.error("Error clearing news:", error);
    res.status(500).json({ success: false, error: "Failed to clear news" });
  }
});

// 記事クリーンナップAPI（完全削除・デバッグ用）
export const cleanupNews = onRequest({ 
  cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
  secrets: [webAppUrl]
}, async (req, res) => {
  try {
    logger.info("Starting news cleanup process...");
    
    // 全記事を取得
    const newsSnapshot = await db.collection("news").get();
    const totalArticles = newsSnapshot.docs.length;
    
    logger.info(`Found ${totalArticles} articles to delete`);
    
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
      
      logger.info(`Deleted batch: ${deletedCount}/${totalArticles} articles`);
    }
    
    logger.info(`News cleanup completed. Deleted ${deletedCount} articles`);
    
    res.json({
      success: true,
      message: `Successfully deleted ${deletedCount} articles from the database`
    });
  } catch (error) {
    logger.error("Error during news cleanup:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to cleanup news articles" 
    });
  }
});

// 配信対象記事の翻訳処理API
export const translateDeliveryTargetNews = onRequest({ 
  cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
  secrets: [openaiApiKey, openaiApiUrl]
}, async (req, res) => {
  try {
    logger.info("Starting translation process for delivery target news...");
    logger.info(`Environment variables check: OPENAI_API_KEY exists: ${!!process.env.OPENAI_API_KEY}`);

    // 全記事を取得してからフィルタリング（複合クエリのインデックス問題を回避）
    const newsSnapshot = await db.collection("news").get();
    
    logger.info(`Total articles found: ${newsSnapshot.docs.length}`);
    
    // 配信対象で未翻訳の記事をフィルタリング
    const targetNews = newsSnapshot.docs.filter(doc => {
      const data = doc.data() as NewsArticle;
      const isTarget = data.isDeliveryTarget === true && data.isTranslated === false;
      logger.info(`Article ${doc.id}: isDeliveryTarget=${data.isDeliveryTarget}, isTranslated=${data.isTranslated}, isTarget=${isTarget}, title=${data.title.substring(0, 50)}...`);
      return isTarget;
    });

    logger.info(`Found ${targetNews.length} articles to translate`);

    if (targetNews.length === 0) {
      logger.warn("No articles found for translation. Checking all articles...");
      newsSnapshot.docs.forEach(doc => {
        const data = doc.data() as NewsArticle;
        logger.info(`Article ${doc.id}: isDeliveryTarget=${data.isDeliveryTarget}, isTranslated=${data.isTranslated}, title=${data.title.substring(0, 50)}...`);
      });
    }

    let translatedCount = 0;

    for (const doc of targetNews) {
      const article = doc.data() as NewsArticle;
      
      try {
        logger.info(`Starting translation for article: ${article.title.substring(0, 100)}...`);
        
        // 翻訳処理（エラー時はフォールバック翻訳を使用）
        const translatedTitle = await translateToJapanese(article.title);
        logger.info(`Title translation completed: ${translatedTitle.substring(0, 100)}...`);
        
        const translatedContent = await translateToJapanese(article.content);
        logger.info(`Content translation completed: ${translatedContent.substring(0, 100)}...`);
        
        const translatedSummary = await translateToJapanese(article.summary);
        logger.info(`Summary translation completed: ${translatedSummary.substring(0, 100)}...`);

        // 翻訳結果をDBに保存
        await doc.ref.update({
          translatedTitle,
          translatedContent,
          translatedSummary,
          isTranslated: true
        });

        translatedCount++;
        logger.info(`Successfully translated and saved article: ${article.title} -> ${translatedTitle}`);
      } catch (translateError) {
        logger.error(`Error translating article ${article.title}:`, translateError);
        // 翻訳エラーの場合はスキップ（フォールバック処理は禁止）
        logger.warn(`Skipping translation for article: ${article.title}`);
      }
    }

    logger.info(`Translation process completed. Translated ${translatedCount} articles.`);

    res.json({
      success: true,
      message: `${translatedCount}件の記事を翻訳しました`
    });
  } catch (error) {
    logger.error("Error in translation process:", error);
    res.status(500).json({ success: false, error: "Failed to translate articles" });
  }
});

// 配信処理API（Slack送信）
export const deliverNews = onRequest({ 
  cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
  secrets: [webAppUrl]
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
        // Slack送信処理（TODO: 実際のSlack API実装）
        const slackMessage = {
          title: article.translatedTitle || article.title,
          content: article.translatedContent || article.translatedSummary || article.content,
          url: article.url,
          category: article.category,
          acquisitionDate: article.informationAcquisitionDate
        };

        // TODO: 実際のSlack API呼び出し
        logger.info(`Delivering to Slack: ${slackMessage.title}`);

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

// ニュース記事一覧取得API（配信対象の記事のみ）
export const getNews = onRequest({ 
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
    } else {
      newsSnapshot = await db.collection("news").get();
    }

    const news = newsSnapshot.docs.map(doc => {
      const data = doc.data() as Omit<NewsArticle, "id">;
      return {
        id: doc.id,
        ...data
      };
    });

    // 配信対象の記事のみをフィルタリング
    const deliveryTargetNews = news.filter(article => article.isDeliveryTarget === true);

    // 公開日時でソート（クライアント側）
    deliveryTargetNews.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    // 制限を適用
    const limitedNews = deliveryTargetNews.slice(0, Number(limit));

    res.json({ success: true, data: limitedNews });
  } catch (error) {
    logger.error("Error fetching news:", error);
    res.status(500).json({ success: false, error: "Failed to fetch news" });
  }
});

// 情報収集実行API
export const runCollection = onRequest({ 
  cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
  secrets: [webAppUrl]
}, async (req, res) => {
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
    
    // 【テスト用】ランダム記事収集（企業非依存、20件）
    // テスト目的で、過去一週間のGoogle Newsからランダムに記事を収集
    await collectTestRandomGoogleNews(20);
    collectedCount++;

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

// 日次レポート送信API
export const sendDailyReport = onRequest({ 
  cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
  secrets: [webAppUrl]
}, async (req, res) => {
  try {
    logger.info("日次レポートが送信されました (モック)");
    // ここに実際の日次レポート送信ロジックを実装
    res.json({ success: true, message: "日次レポートが送信されました (モック)" });
  } catch (error) {
    logger.error("Error sending daily report:", error);
    res.status(500).json({ success: false, error: "Failed to send daily report" });
  }
});

// 週次レポート送信API
export const sendWeeklyReport = onRequest({ 
  cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
  secrets: [webAppUrl]
}, async (req, res) => {
  try {
    logger.info("週次レポートが送信されました (モック)");
    // ここに実際の週次レポート送信ロジックを実装
    res.json({ success: true, message: "週次レポートが送信されました (モック)" });
  } catch (error) {
    logger.error("Error sending weekly report:", error);
    res.status(500).json({ success: false, error: "Failed to send weekly report" });
  }
});

// 実データ収集API（テスト用）
export const collectRealData = onRequest({ 
  cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
  secrets: [webAppUrl]
}, async (req, res) => {
  try {
    logger.info("Starting real data collection...");

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

    // 各企業に対して実データを収集
    for (const company of companies) {
      try {
        logger.info(`Collecting real data for ${company.name}...`);
        
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
        logger.error(`Error collecting real data for ${company.name}:`, error);
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

  } catch (error) {
    logger.error("Error in collectRealData:", error);
    res.status(500).json({ 
      success: false, 
      error: "実データ収集中にエラーが発生しました" 
    });
  }
});

// 定期実行される情報収集 (毎日午前9時)
export const scheduledCollection = onSchedule(config.schedule.collectionTime, async (event) => {
  logger.info("定期情報収集が実行されました", event);
  try {
    // ここに実際の情報収集ロジックを実装
    // runCollection関数を呼び出すなど
    const dummyCompanySnapshot = await db.collection("companies").limit(1).get();
    let companyId = "dummy-company-id";
    if (!dummyCompanySnapshot.empty) {
      companyId = dummyCompanySnapshot.docs[0].id;
    } else {
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

    const dummyNews: Omit<NewsArticle, "id"> = {
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

    logger.info("定期情報収集が完了しました");
  } catch (error) {
    logger.error("定期情報収集中にエラーが発生しました:", error);
  }
});