import { createApp } from './app.js';
import { getConfig } from './config/env.js';
import { logger } from './logger.js';
import { onRequest } from 'firebase-functions/v2/https';

let config: Awaited<ReturnType<typeof getConfig>>;
let app: ReturnType<typeof createApp>;

// Google Cloud Functions では非同期で初期化
const initializeApp = async () => {
  if (!config) {
    config = await getConfig();
    app = createApp();
  }
  return { config, app };
};

// Google Cloud Functions エントリーポイント
export const api = onRequest({
  cors: true,
  region: 'asia-northeast1'
}, async (req, res) => {
  const { app } = await initializeApp();
  app(req, res);
});

// ローカル開発用（Functions エミュレータ）
if (process.env.NODE_ENV !== 'production') {
  initializeApp().then(({ config, app }) => {
    app.listen(config.port, () => {
      logger.info({ port: config.port }, 'Backend server started (local development)');
    });
  }).catch((error) => {
    logger.error({ err: error }, 'Failed to initialize app');
    process.exit(1);
  });
}

