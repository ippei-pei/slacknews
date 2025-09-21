import { Router } from 'express';
import { CompanyService } from '../services/companyService.js';

export const createCompaniesRouter = (companyService: CompanyService): Router => {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const { search, active_only: activeOnlyParam, page, limit } = req.query;
      const result = await companyService.list({
        search: typeof search === 'string' ? search : undefined,
        activeOnly: activeOnlyParam !== 'false',
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined
      });

      res.json({
        success: true,
        data: {
          companies: result.items,
          pagination: result.pagination
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const { name, urls, rssUrls, redditUrls, snsAccounts, priority, category, country } = req.body;
      if (!name) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'name is required'
          }
        });
      }

      const id = await companyService.create({
        name,
        urls,
        rssUrls,
        redditUrls,
        snsAccounts,
        priority,
        category,
        country
      });

      res.status(201).json({ success: true, data: { id } });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:companyId', async (req, res, next) => {
    try {
      const { companyId } = req.params;
      await companyService.update(companyId, req.body ?? {});
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:companyId', async (req, res, next) => {
    try {
      const { companyId } = req.params;
      await companyService.deactivate(companyId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

