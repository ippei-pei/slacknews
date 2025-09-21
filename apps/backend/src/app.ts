import express from 'express';
import cors from 'cors';
import { httpLogger, logger } from './logger.js';
import { createRoutes } from './routes/index.js';
import { CompanyService } from './services/companyService.js';
import { SettingsService } from './services/settingsService.js';
import { createCompaniesRepository } from './repositories/companiesRepository.js';
import { createSettingsRepository } from './repositories/settingsRepository.js';
import { createNewsRepository } from './repositories/newsRepository.js';
import { getFirestore } from './clients/firestore.js';
import { getConfig } from './config/env.js';
import { LlmService } from './services/llmService.js';
import { NewsCollectionService } from './services/newsCollectionService.js';
import { SlackClient } from './clients/slack.js';
import { ReportService } from './services/reportService.js';

export const createApp = () => {
  const app = express();

  // Google Cloud Functions では cors は onRequest で設定されるため、ローカル開発時のみ
  if (process.env.NODE_ENV !== 'production') {
    app.use(cors());
  }
  app.use(express.json({ limit: '2mb' }));
  app.use(httpLogger);

  // ミドルウェアでサービスを初期化
  app.use(async (req, res, next) => {
    try {
      if (!req.services) {
        const { getConfig } = await import('./config/env.js');
        const config = await getConfig();
        const firestore = getFirestore(config);

        const companyService = new CompanyService(createCompaniesRepository(firestore));
        const settingsService = new SettingsService(createSettingsRepository(firestore));
        const newsRepository = createNewsRepository(firestore);
        const llmService = new LlmService(config);
        const slackClient = new SlackClient(config);
        const newsCollectionService = new NewsCollectionService(companyService, llmService, newsRepository, config, slackClient, settingsService);
        const reportService = new ReportService(settingsService, newsRepository, slackClient);

        req.services = {
          companyService,
          settingsService,
          newsCollectionService,
          newsRepository,
          reportService,
          slackClient
        };
      }
      next();
    } catch (error) {
      logger.error({ err: error }, 'Failed to initialize services');
      res.status(500).json({
        success: false,
        error: {
          code: 'INITIALIZATION_ERROR',
          message: 'Failed to initialize services'
        }
      });
    }
  });

  app.use('/api', createRoutes());

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error'
      }
    });
  });

  return app;
};

