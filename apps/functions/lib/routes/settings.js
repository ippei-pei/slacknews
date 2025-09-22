"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSlackChannelMembers = exports.listSlackChannels = exports.updateSlackSettings = exports.getSlackSettings = void 0;
const https_1 = require("firebase-functions/v2/https");
const context_1 = require("../context");
const slack_1 = require("../utils/slack");
// CORS設定
const corsOptions = {
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [context_1.webAppUrl]
};
// Slack設定取得API
exports.getSlackSettings = (0, https_1.onRequest)(corsOptions, async (req, res) => {
    try {
        const doc = await context_1.db.collection("settings").doc("slack").get();
        if (!doc.exists) {
            res.json({ success: true, data: null });
            return;
        }
        res.json({ success: true, data: doc.data() });
    }
    catch (error) {
        context_1.logger.error("Error fetching slack settings:", error);
        res.status(500).json({ success: false, error: "Failed to fetch slack settings" });
    }
});
// Slack設定更新API
exports.updateSlackSettings = (0, https_1.onRequest)(corsOptions, async (req, res) => {
    try {
        const { channelName, channelId, deliveryMentionUserId, errorMentionUserId } = req.body || {};
        if (!channelName) {
            res.status(400).json({ success: false, error: "channelName is required" });
            return;
        }
        const payload = {
            channelName,
            channelId: channelId || null,
            deliveryMentionUserId: deliveryMentionUserId || null,
            errorMentionUserId: errorMentionUserId || null,
            updatedAt: new Date(),
        };
        await context_1.db.collection("settings").doc("slack").set(payload, { merge: true });
        res.json({ success: true, data: payload });
    }
    catch (error) {
        context_1.logger.error("Error updating slack settings:", error);
        res.status(500).json({ success: false, error: "Failed to update slack settings" });
    }
});
// Slackチャンネル一覧API
exports.listSlackChannels = (0, https_1.onRequest)({
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [context_1.slackBotToken]
}, async (req, res) => {
    try {
        const token = context_1.slackBotToken.value();
        const channels = await (0, slack_1.fetchSlackChannels)(token);
        res.json({
            success: true,
            data: channels.map((c) => ({
                id: c.id,
                name: `#${c.name}`,
                is_private: c.is_private
            }))
        });
    }
    catch (e) {
        context_1.logger.error('listSlackChannels failed', e);
        res.status(500).json({ success: false, error: 'Failed to list channels' });
    }
});
// Slackチャンネルメンバー一覧API
exports.listSlackChannelMembers = (0, https_1.onRequest)({
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [context_1.slackBotToken]
}, async (req, res) => {
    try {
        const token = context_1.slackBotToken.value();
        const { channelId } = req.query;
        if (!channelId) {
            res.status(400).json({ success: false, error: 'channelId is required' });
            return;
        }
        const members = await (0, slack_1.fetchSlackChannelMembers)(token, channelId);
        res.json({ success: true, data: members });
    }
    catch (e) {
        context_1.logger.error('listSlackChannelMembers failed', e);
        res.status(500).json({ success: false, error: 'Failed to list channel members' });
    }
});
//# sourceMappingURL=settings.js.map