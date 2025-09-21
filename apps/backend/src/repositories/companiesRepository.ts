import { Firestore } from '@google-cloud/firestore';
import { Company } from '../domain/types.js';

const COLLECTION = 'companies';

const toCompany = (doc: FirebaseFirestore.DocumentSnapshot): Company => {
  const data = doc.data();
  if (!data) {
    throw new Error('Document snapshot is empty');
  }

  return {
    id: doc.id,
    name: data.name,
    urls: data.urls ?? [],
    rssUrls: data.rssUrls ?? [],
    redditUrls: data.redditUrls ?? [],
    snsAccounts: data.snsAccounts,
    priority: data.priority ?? 3,
    category: data.category,
    country: data.country,
    isActive: data.isActive ?? true,
    createdAt: data.createdAt?.toDate?.() ?? new Date(data.createdAt),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(data.updatedAt)
  };
};

export interface CompaniesRepository {
  list(params: {
    search?: string;
    activeOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Company[]; total: number }>;
  findById(id: string): Promise<Company | null>;
  listAllActive(): Promise<Company[]>;
  create(data: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>;
  update(id: string, data: Partial<Omit<Company, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void>;
  deactivate(id: string): Promise<void>;
}

export const createCompaniesRepository = (firestore: Firestore): CompaniesRepository => {
  const collection = firestore.collection(COLLECTION);

  return {
    async list({ search, activeOnly = true, limit = 20, offset = 0 }) {
      let query: FirebaseFirestore.Query = collection;

      if (activeOnly) {
        query = query.where('isActive', '==', true);
      }

      if (search) {
        query = query.where('nameKeywords', 'array-contains', search.toLowerCase());
      }

      const snapshot = await query.orderBy('createdAt', 'desc').offset(offset).limit(limit).get();
      const items = snapshot.docs.map(toCompany);

      const totalSnapshot = await query.count().get();
      return {
        items,
        total: totalSnapshot.data().count
      };
    },

    async findById(id) {
      const doc = await collection.doc(id).get();
      if (!doc.exists) {
        return null;
      }
      return toCompany(doc);
    },

    async listAllActive() {
      const snapshot = await collection.where('isActive', '==', true).get();
      return snapshot.docs.map(toCompany);
    },

    async create(data) {
      const now = new Date();
      const ref = collection.doc();
      const nameKeywords = data.name
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

      await ref.set({
        ...data,
        nameKeywords,
        isActive: data.isActive ?? true,
        createdAt: now,
        updatedAt: now
      });

      return ref.id;
    },

    async update(id, data) {
      const ref = collection.doc(id);
      const updateData = {
        ...data,
        updatedAt: new Date()
      };

      if (data?.name) {
        Reflect.set(updateData, 'nameKeywords', data.name
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean));
      }

      await ref.update(updateData);
    },

    async deactivate(id) {
      await collection.doc(id).update({
        isActive: false,
        updatedAt: new Date()
      });
    }
  };
};

