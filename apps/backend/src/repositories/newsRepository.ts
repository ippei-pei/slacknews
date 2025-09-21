import { Firestore } from '@google-cloud/firestore';
import { CollectionLog, DeliveryLog, NewsArticle } from '../domain/types.js';

const RAW_COLLECTION = 'raw_articles';
const NEWS_COLLECTION = 'news_articles';
const LOG_COLLECTION = 'collection_logs';
const DELIVERY_COLLECTION = 'delivery_logs';

export interface NewsRepository {
  saveRawArticles(articles: any[]): Promise<void>;
  saveNewsArticles(articles: NewsArticle[]): Promise<void>;
  listNewsArticles(params: { companyIds?: string[]; limit?: number }): Promise<NewsArticle[]>;
  appendCollectionLog(log: CollectionLog): Promise<void>;
  appendDeliveryLog(log: DeliveryLog): Promise<void>;
}

const toFirestore = (article: NewsArticle) => ({
  companyId: article.companyId,
  titleOriginal: article.titleOriginal,
  titleJp: article.titleJp,
  summaryJp: article.summaryJp,
  newsSummaryJp: article.newsSummaryJp,
  importance: article.importance,
  categories: article.categories,
  publishedAt: article.publishedAt,
  sourceLinks: article.sourceLinks,
  llmVersion: article.llmVersion,
  createdAt: article.createdAt,
  updatedAt: article.updatedAt
});

const fromFirestore = (doc: FirebaseFirestore.DocumentSnapshot): NewsArticle => {
  const data = doc.data();
  if (!data) {
    throw new Error('Empty news article document');
  }
  return {
    id: doc.id,
    companyId: data.companyId,
    titleOriginal: data.titleOriginal,
    titleJp: data.titleJp,
    summaryJp: data.summaryJp,
    newsSummaryJp: data.newsSummaryJp,
    importance: data.importance,
    categories: data.categories ?? [],
    publishedAt: data.publishedAt?.toDate?.() ?? new Date(data.publishedAt),
    sourceLinks: data.sourceLinks ?? [],
    llmVersion: data.llmVersion ?? 'manual',
    createdAt: data.createdAt?.toDate?.() ?? new Date(data.createdAt),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(data.updatedAt)
  };
};

export const createNewsRepository = (firestore: Firestore): NewsRepository => {
  const rawCollection = firestore.collection(RAW_COLLECTION);
  const newsCollection = firestore.collection(NEWS_COLLECTION);
  const logCollection = firestore.collection(LOG_COLLECTION);
  const deliveryCollection = firestore.collection(DELIVERY_COLLECTION);

  return {
    async saveRawArticles(articles) {
      const batch = firestore.batch();
      for (const article of articles) {
        const ref = rawCollection.doc();
        batch.set(ref, {
          ...article,
          createdAt: new Date()
        });
      }
      await batch.commit();
    },

    async saveNewsArticles(articles) {
      const batch = firestore.batch();
      for (const article of articles) {
        const ref = newsCollection.doc(article.id);
        batch.set(ref, toFirestore(article), { merge: true });
      }
      await batch.commit();
    },

    async listNewsArticles({ companyIds, limit = 50 }) {
      let query: FirebaseFirestore.Query = newsCollection.orderBy('publishedAt', 'desc').limit(limit);
      if (companyIds?.length) {
        query = query.where('companyId', 'in', companyIds.slice(0, 10));
      }
      const snapshot = await query.get();
      return snapshot.docs.map(fromFirestore);
    },

    async appendCollectionLog(log) {
      await logCollection.add({
        companyId: log.companyId,
        status: log.status,
        articlesFetched: log.articlesFetched,
        llmTokens: log.llmTokens,
        errorCode: log.errorCode,
        errorMessage: log.errorMessage,
        startedAt: log.startedAt,
        completedAt: log.completedAt,
        createdAt: new Date()
      });
    },

    async appendDeliveryLog(log: DeliveryLog) {
      await deliveryCollection.add({
        ...log,
        createdAt: new Date()
      });
    }
  };
};

