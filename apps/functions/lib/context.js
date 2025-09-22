"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.db = exports.slackBotToken = exports.slackWebhookUrl = exports.googleNewsBaseUrl = exports.openaiApiUrl = exports.webAppUrl = exports.openaiApiKey = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const firebase_functions_1 = require("firebase-functions");
Object.defineProperty(exports, "logger", { enumerable: true, get: function () { return firebase_functions_1.logger; } });
const params_1 = require("firebase-functions/params");
// Firebase Admin SDK を初期化
(0, app_1.initializeApp)();
// Secret Managerからシークレットを定義
exports.openaiApiKey = (0, params_1.defineSecret)("openai-api-key");
exports.webAppUrl = (0, params_1.defineSecret)("web-app-url");
exports.openaiApiUrl = (0, params_1.defineSecret)("openai-api-url");
exports.googleNewsBaseUrl = (0, params_1.defineSecret)("google-news-base-url");
exports.slackWebhookUrl = (0, params_1.defineSecret)("SLACK_WEBHOOK_URL");
exports.slackBotToken = (0, params_1.defineSecret)("SLACK_BOT_TOKEN");
// Firestore インスタンス
exports.db = (0, firestore_1.getFirestore)();
//# sourceMappingURL=context.js.map