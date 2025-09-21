import { Router } from 'express';
import { createCompaniesRouter } from './companies.js';
import { createSettingsRouter } from './settings.js';
import { createNewsRouter } from './news.js';
import { createReportsRouter } from './reports.js';
import { CompanyService } from '../services/companyService.js';
import { SettingsService } from '../services/settingsService.js';
import { NewsCollectionService } from '../services/newsCollectionService.js';
import { NewsRepository } from '../repositories/newsRepository.js';
import { ReportService } from '../services/reportService.js';
import { SlackClient } from '../clients/slack.js';

export interface RoutesDeps {
  companyService: CompanyService;
  settingsService: SettingsService;
  newsCollectionService: NewsCollectionService;
  newsRepository: NewsRepository;
  reportService: ReportService;
  slackClient: SlackClient;
}

export const createRoutes = (): Router => {
  const router = Router();

  router.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.use('/companies', (req, res, next) => {
    if (!req.services) {
      return res.status(500).json({ error: 'Services not initialized' });
    }
    createCompaniesRouter(req.services.companyService)(req, res, next);
  });

  router.use('/settings', (req, res, next) => {
    if (!req.services) {
      return res.status(500).json({ error: 'Services not initialized' });
    }
    createSettingsRouter(req.services.settingsService, req.services.slackClient)(req, res, next);
  });

  router.use('/news', (req, res, next) => {
    if (!req.services) {
      return res.status(500).json({ error: 'Services not initialized' });
    }
    createNewsRouter(req.services.newsCollectionService, req.services.newsRepository)(req, res, next);
  });

  router.use('/reports', (req, res, next) => {
    if (!req.services) {
      return res.status(500).json({ error: 'Services not initialized' });
    }
    createReportsRouter(req.services.reportService)(req, res, next);
  });

  return router;
};

