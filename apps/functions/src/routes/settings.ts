import { onRequest } from "firebase-functions/v2/https";
import { db, logger, webAppUrl, slackBotToken } from '../context';
import { SlackSettings } from '../types';
import { fetchSlackChannels, fetchSlackChannelMembers } from '../utils/slack';

// CORS設定
const corsOptions = {
  cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
  secrets: [webAppUrl]
};

// Slack設定取得API
export const getSlackSettings = onRequest(corsOptions, async (req, res) => {
  try {
    const doc = await db.collection("settings").doc("slack").get();
    if (!doc.exists) {
      res.json({ success: true, data: null });
      return;
    }
    res.json({ success: true, data: doc.data() });
  } catch (error) {
    logger.error("Error fetching slack settings:", error);
    res.status(500).json({ success: false, error: "Failed to fetch slack settings" });
  }
});

// Slack設定更新API
export const updateSlackSettings = onRequest(corsOptions, async (req, res) => {
  try {
    const { channelName, channelId, deliveryMentionUserId, errorMentionUserId } = req.body || {};
    if (!channelName) {
      res.status(400).json({ success: false, error: "channelName is required" });
      return;
    }
    const payload: SlackSettings = {
      channelName,
      channelId: channelId || null,
      deliveryMentionUserId: deliveryMentionUserId || null,
      errorMentionUserId: errorMentionUserId || null,
      updatedAt: new Date(),
    } as any;
    await db.collection("settings").doc("slack").set(payload, { merge: true });
    res.json({ success: true, data: payload });
  } catch (error) {
    logger.error("Error updating slack settings:", error);
    res.status(500).json({ success: false, error: "Failed to update slack settings" });
  }
});

// Slackチャンネル一覧API
export const listSlackChannels = onRequest({
  cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
  secrets: [slackBotToken]
}, async (req, res) => {
  try {
    const token = slackBotToken.value();
    const channels = await fetchSlackChannels(token);
    res.json({ 
      success: true, 
      data: channels.map((c: any) => ({ 
        id: c.id, 
        name: `#${c.name}`, 
        is_private: c.is_private 
      })) 
    });
  } catch (e) {
    logger.error('listSlackChannels failed', e);
    res.status(500).json({ success: false, error: 'Failed to list channels' });
  }
});

// Slackチャンネルメンバー一覧API
export const listSlackChannelMembers = onRequest({
  cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
  secrets: [slackBotToken]
}, async (req, res) => {
  try {
    const token = slackBotToken.value();
    const { channelId } = req.query as any;
    if (!channelId) { 
      res.status(400).json({ success: false, error: 'channelId is required' }); 
      return; 
    }
    
    const members = await fetchSlackChannelMembers(token, channelId);
    res.json({ success: true, data: members });
  } catch (e) {
    logger.error('listSlackChannelMembers failed', e);
    res.status(500).json({ success: false, error: 'Failed to list channel members' });
  }
});
