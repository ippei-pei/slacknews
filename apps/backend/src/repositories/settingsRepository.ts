import { Firestore } from '@google-cloud/firestore';
import { ErrorNotificationSettings, SlackSettings } from '../domain/types.js';

const COLLECTION = 'settings';

export type SettingsKey = 'context' | 'slack' | 'error_notification';

export interface SettingsRepository {
  getContext(): Promise<string | null>;
  setContext(value: string, updatedBy?: string): Promise<void>;
  getSlackSettings(): Promise<SlackSettings | null>;
  setSlackSettings(settings: SlackSettings): Promise<void>;
  getErrorNotification(): Promise<ErrorNotificationSettings | null>;
  setErrorNotification(settings: ErrorNotificationSettings): Promise<void>;
}

export const createSettingsRepository = (firestore: Firestore): SettingsRepository => {
  const collection = firestore.collection(COLLECTION);

  return {
    async getContext() {
      const doc = await collection.doc('context').get();
      const data = doc.data();
      if (!data) return null;
      return data.content as string;
    },

    async setContext(value, updatedBy) {
      await collection.doc('context').set(
        {
          content: value,
          updatedAt: new Date(),
          updatedBy
        },
        { merge: true }
      );
    },

    async getSlackSettings() {
      const doc = await collection.doc('slack').get();
      const data = doc.data();
      if (!data) return null;
      return {
        channelId: data.channelId,
        channelName: data.channelName,
        threadStrategy: data.threadStrategy ?? 'top10-main-rest-thread',
        updatedAt: data.updatedAt?.toDate?.() ?? new Date(data.updatedAt),
        updatedBy: data.updatedBy
      };
    },

    async setSlackSettings(settings) {
      await collection.doc('slack').set(
        {
          channelId: settings.channelId,
          channelName: settings.channelName,
          threadStrategy: settings.threadStrategy,
          updatedAt: settings.updatedAt ?? new Date(),
          updatedBy: settings.updatedBy
        },
        { merge: true }
      );
    },

    async getErrorNotification() {
      const doc = await collection.doc('error_notification').get();
      const data = doc.data();
      if (!data) return null;
      return {
        mentionUser: data.mentionUser,
        fallbackChannelId: data.fallbackChannelId,
        updatedAt: data.updatedAt?.toDate?.() ?? new Date(data.updatedAt),
        updatedBy: data.updatedBy
      };
    },

    async setErrorNotification(settings) {
      await collection.doc('error_notification').set(
        {
          mentionUser: settings.mentionUser,
          fallbackChannelId: settings.fallbackChannelId,
          updatedAt: settings.updatedAt ?? new Date(),
          updatedBy: settings.updatedBy
        },
        { merge: true }
      );
    }
  };
};

