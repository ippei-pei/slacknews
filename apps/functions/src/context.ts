import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";

// Firebase Admin SDK を初期化
initializeApp();

// Secret Managerからシークレットを定義
export const openaiApiKey = defineSecret("openai-api-key");
export const webAppUrl = defineSecret("web-app-url");
export const openaiApiUrl = defineSecret("openai-api-url");
export const googleNewsBaseUrl = defineSecret("google-news-base-url");
export const slackWebhookUrl = defineSecret("SLACK_WEBHOOK_URL");
export const slackBotToken = defineSecret("SLACK_BOT_TOKEN");

// Firestore インスタンス
export const db = getFirestore();

// ロガー
export { logger };
