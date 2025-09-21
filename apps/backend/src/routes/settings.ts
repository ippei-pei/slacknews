import { Router } from 'express';
import { SettingsService } from '../services/settingsService.js';
import { SlackClient } from '../clients/slack.js';

export const createSettingsRouter = (settingsService: SettingsService, slackClient: SlackClient): Router => {
  const router = Router();

  router.get('/context', async (_req, res, next) => {
    try {
      const context = await settingsService.getContext();
      res.json({ success: true, data: { context } });
    } catch (error) {
      next(error);
    }
  });

  router.put('/context', async (req, res, next) => {
    try {
      const { context, updatedBy } = req.body;
      if (!context || typeof context !== 'string') {
        return res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'context is required'
          }
        });
      }
      await settingsService.setContext(context, updatedBy);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  router.get('/slack', async (_req, res, next) => {
    try {
      const settings = await settingsService.getSlackSettings();
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  });

  router.get('/slack/channels', async (_req, res, next) => {
    try {
      const result = await slackClient.listConversations();
      const channels = (result.channels || []).map((channel: any) => ({
        id: channel.id,
        name: channel.name
      }));
      res.json({ success: true, data: { channels } });
    } catch (error) {
      next(error);
    }
  });

  router.put('/slack', async (req, res, next) => {
    try {
      const { channelId, channelName, threadStrategy, updatedBy } = req.body;
      if (!channelId || !channelName) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'channelId and channelName are required'
          }
        });
      }
      await settingsService.setSlackSettings({
        channelId,
        channelName,
        threadStrategy: threadStrategy ?? 'top10-main-rest-thread',
        updatedAt: new Date(),
        updatedBy
      });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  router.get('/error-notification', async (_req, res, next) => {
    try {
      const settings = await settingsService.getErrorNotification();
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  });

  router.put('/error-notification', async (req, res, next) => {
    try {
      const { mentionUser, fallbackChannelId, updatedBy } = req.body;
      if (!mentionUser || !mentionUser.startsWith('@')) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'mentionUser must start with @'
          }
        });
      }
      await settingsService.setErrorNotification({
        mentionUser,
        fallbackChannelId,
        updatedAt: new Date(),
        updatedBy
      });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

