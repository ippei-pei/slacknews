import { Router } from 'express';
import { NewsCollectionService } from '../services/newsCollectionService.js';
import { NewsRepository } from '../repositories/newsRepository.js';

export const createNewsRouter = (
  newsCollectionService: NewsCollectionService,
  newsRepository: NewsRepository
): Router => {
  const router = Router();

  router.post('/collect', async (req, res, next) => {
    try {
      const result = await newsCollectionService.collect(req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.get('/articles', async (req, res, next) => {
    try {
      const companyIds = req.query.companyIds
        ? String(req.query.companyIds).split(',').filter(Boolean)
        : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const articles = await newsRepository.listNewsArticles({ companyIds, limit });
      res.json({ success: true, data: { articles } });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

