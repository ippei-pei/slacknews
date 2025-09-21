import { Router } from 'express';
import { ReportService } from '../services/reportService.js';

export const createReportsRouter = (reportService: ReportService): Router => {
  const router = Router();

  router.post('/daily', async (req, res, next) => {
    try {
      const result = await reportService.sendDailyReport(req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/weekly', async (req, res, next) => {
    try {
      const result = await reportService.sendWeeklyReport(req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

