import { onRequest } from "firebase-functions/v2/https";
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
const slackWebhookUrl = defineSecret("SLACK_WEBHOOK_URL");

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

// Slack設定の型
interface SlackSettings {
  channelName: string;           // 表示用（実際の配信先はSecretのWebhook）
  deliveryMentionUserId?: string; // 配信時に先頭へ付与（任意）
  errorMentionUserId?: string;   // 例: U123ABCDEF（<@...>でメンション）
  webhookUrl?: string;           // 画面で登録されたWebhook（あれば優先使用）
  updatedAt: Date;
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

// Slack設定取得API
export const getSlackSettings = onRequest({
  cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
  secrets: [webAppUrl]
}, async (req, res) => {
  try {
    const doc = await db.collection("settings").doc("slack").get();
    if (!doc.exists) {
      res.json({ success: true, data: null });
      return;
    }
    res.json({ success: true, data: doc.data() });
  } catch (error) {
    logger.error("Error fetching slack settings:", error);
    res.status(500).json({ success: false, error: "Failed to fetch slack settings" });
  }
});

// Slack設定更新API
export const updateSlackSettings = onRequest({
  cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
  secrets: [webAppUrl]
}, async (req, res) => {
  try {
    const { channelName, deliveryMentionUserId, errorMentionUserId, webhookUrl } = req.body || {};
    if (!channelName) {
      res.status(400).json({ success: false, error: "channelName is required" });
      return;
    }
    const payload: SlackSettings = {
      channelName,
      deliveryMentionUserId: deliveryMentionUserId || null,
      errorMentionUserId: errorMentionUserId || null,
      webhookUrl: webhookUrl || null,
      updatedAt: new Date(),
    } as any;
    await db.collection("settings").doc("slack").set(payload, { merge: true });
    res.json({ success: true, data: payload });
  } catch (error) {
    logger.error("Error updating slack settings:", error);
    res.status(500).json({ success: false, error: "Failed to update slack settings" });
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
  secrets: [webAppUrl, slackWebhookUrl]
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


// collectRealData は runCollection に統合済みのため削除

// 定期実行される情報収集 (毎日午前9時)
// scheduledCollection はダミー実装を削除済み（将来の実装時に再追加）

// 日次レポート配信API
export const deliverDailyReport = onRequest({ 
  cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
  secrets: [webAppUrl, slackWebhookUrl, openaiApiKey, openaiApiUrl]
}, async (req, res) => {
  try {
    const { date } = req.body;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    logger.info(`Starting daily report delivery for ${targetDate}...`);

    // 指定日の記事を取得
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const newsSnapshot = await db.collection("news").get();
    const dailyNews = newsSnapshot.docs.filter(doc => {
      const data = doc.data() as NewsArticle;
      const articleDate = new Date(data.publishedAt);
      return articleDate >= startOfDay && articleDate <= endOfDay;
    }).map(doc => doc.data() as NewsArticle);

    // LLMで日次サマリを生成
    const articlesForPrompt = dailyNews.map(a => ({
      id: a.id,
      company: a.companyId,
      title: a.isTranslated ? (a.translatedTitle || a.title) : a.title,
      content: ((a.isTranslated ? (a.translatedContent || a.translatedSummary) : (a.content || a.summary)) || '').slice(0, 400),
      category: a.category,
      publishedAt: a.publishedAt
    }));

    const OPENAI_API_KEY = openaiApiKey.value();
    const OPENAI_API_URL = openaiApiUrl.value();
    const model = config.ai.model;

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
      dailySummary = (data.choices?.[0]?.message?.content || '').trim();
    } catch (e) {
      logger.error('daily summary generation failed', e);
      dailySummary = dailyNews.length > 0 ? '本日の主要動向については記事をご確認ください。' : '本日は該当する記事がありませんでした。';
    }

    // 日次レポートメッセージを生成（重要度表記なし）
    const slackMessage = {
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
    } as any;

    // 主要記事（最大5件、重要度文言を削除）
    if (dailyNews.length > 0) {
      slackMessage.blocks.push({ type: "section", text: { type: "mrkdwn", text: "*📋 主要記事:*" } });
      dailyNews.slice(0, 5).forEach((article: NewsArticle) => {
        slackMessage.blocks.push({
          type: "section",
          text: { type: "mrkdwn", text: `*${article.isTranslated ? (article.translatedTitle || article.title) : article.title}*\n${article.isTranslated ? (article.translatedContent || article.translatedSummary || '') : (article.content || article.summary)}` }
        });
      });
      if (dailyNews.length > 5) {
        slackMessage.blocks.push({ type: "section", text: { type: "mrkdwn", text: `...他 ${dailyNews.length - 5} 件` } });
      }
    } else {
      slackMessage.blocks.push({ type: "section", text: { type: "mrkdwn", text: "本日の記事はありません。" } });
    }

    // Slack送信
    // エラー時メンション設定を読み込み
    let mention = '';
    try {
      const settingsDoc = await db.collection("settings").doc("slack").get();
      const settings = (settingsDoc.exists ? settingsDoc.data() : null) as SlackSettings | null;
      if (settings?.errorMentionUserId) mention = `<@${settings.errorMentionUserId}> `;
    } catch {}

    // 設定の参照（Webhook/メンション）
    let mentionPrefix = '';
    let webhook = slackWebhookUrl.value();
    try {
      const settingsDoc = await db.collection("settings").doc("slack").get();
      const settings = (settingsDoc.exists ? settingsDoc.data() : null) as SlackSettings | null;
      if (settings?.deliveryMentionUserId) mentionPrefix = `<@${settings.deliveryMentionUserId}> `;
      if (settings?.webhookUrl) webhook = settings.webhookUrl;
    } catch {}

    // 本文先頭にメンションを付与（任意）
    if (mentionPrefix) {
      slackMessage.blocks.unshift({ type: 'section', text: { type: 'mrkdwn', text: `${mentionPrefix}` } });
    }

    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage)
    });

    if (!response.ok) {
      // エラー時にメンション付き通知を試行
      try {
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: `${mention}日次レポート配信に失敗しました（${response.status} ${response.statusText}）` })
        });
      } catch {}
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
    }

    logger.info(`Daily report delivered successfully for ${targetDate}`);

    res.json({ success: true, message: `日次レポートを配信しました（${dailyNews.length}件の記事）` });

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
    const targetWeekStart = weekStart || new Date().toISOString().split('T')[0];
    
    logger.info(`Starting weekly report delivery for week starting ${targetWeekStart}...`);

    // 指定週の記事を取得
    const startOfWeek = new Date(targetWeekStart);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const newsSnapshot = await db.collection("news").get();
    const weeklyNews = newsSnapshot.docs.filter(doc => {
      const data = doc.data() as NewsArticle;
      const articleDate = new Date(data.publishedAt);
      return articleDate >= startOfWeek && articleDate <= endOfWeek;
    }).map(doc => doc.data() as NewsArticle);

    // const translatedNews = weeklyNews.filter(article => article.isTranslated);

    // （LLM生成に切り替えたため会社別グルーピングは不要）

    // LLMで文生成
    const llm = await generateWeeklyReportWithLLM(weeklyNews);
    const competitorSummary = llm.competitorSummary;
    const companySummaries = llm.companySummaries;
    const strategicAction = llm.strategicAction;

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
            text: `*${company.company || ''}*\n${company.summary}`
          }
        });
      });
    } else {
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
    // 設定の参照（メンション用）
    let mention = '';
    try {
      const settingsDoc = await db.collection("settings").doc("slack").get();
      const settings = (settingsDoc.exists ? settingsDoc.data() : null) as SlackSettings | null;
      if (settings?.errorMentionUserId) mention = `<@${settings.errorMentionUserId}> `;
    } catch {}

    // 設定の参照（Webhook/メンション）
    let mentionPrefix = '';
    let webhook = slackWebhookUrl.value();
    try {
      const settingsDoc = await db.collection("settings").doc("slack").get();
      const settings = (settingsDoc.exists ? settingsDoc.data() : null) as SlackSettings | null;
      if (settings?.deliveryMentionUserId) mentionPrefix = `<@${settings.deliveryMentionUserId}> `;
      if (settings?.webhookUrl) webhook = settings.webhookUrl;
    } catch {}

    if (mentionPrefix) {
      slackMessage.blocks.unshift({ type: 'section', text: { type: 'mrkdwn', text: `${mentionPrefix}` } });
    }

    const response = await fetch(webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slackMessage)
    });

    if (!response.ok) {
      // エラー時にメンション付き通知を試行
      try {
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: `${mention}週次レポート配信に失敗しました（${response.status} ${response.statusText}）` })
        });
      } catch {}
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
    }

    logger.info(`Weekly report delivered successfully for week starting ${targetWeekStart}`);

    res.json({
      success: true,
      message: `週次レポートを配信しました（${weeklyNews.length}件の記事）`
    });

  } catch (error) {
    logger.error("Error in weekly report delivery:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to deliver weekly report" 
    });
  }
});

// ヘルパー関数（LLMによる文生成）
async function generateWeeklyReportWithLLM(weeklyNews: NewsArticle[]): Promise<{
  competitorSummary: string;
  companySummaries: { company: string; summary: string }[];
  strategicAction: string;
}> {
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
  const OPENAI_API_KEY = openaiApiKey.value();
  const OPENAI_API_URL = openaiApiUrl.value();
  const model = config.ai.model;

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
    logger.error(`OpenAI API error (weekly report): ${errorText}`);
    throw new Error(`OpenAI API error: ${response.status} - ${response.statusText}`);
  }

  const data = await response.json();
  const content: string | undefined = data.choices?.[0]?.message?.content;
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
    const companySummaries = Array.isArray(parsed.companySummaries) ? parsed.companySummaries.map((c: any) => ({
      company: String(c.company || ''),
      summary: String(c.summary || '')
    })) : [];
    const strategicAction = String(parsed.strategicAction || '').trim();
    return { competitorSummary, companySummaries, strategicAction };
  } catch (e) {
    logger.error('LLM出力のJSON解析に失敗しました', e);
    // フォールバック（空文言）
    return {
      competitorSummary: '今週の動向サマリは取得できませんでした。',
      companySummaries: [],
      strategicAction: '推奨アクションは取得できませんでした。'
    };
  }
}