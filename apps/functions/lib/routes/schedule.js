"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCronExpression = exports.testScheduleTask = exports.updateScheduleSettingsAPI = exports.getScheduleSettings = void 0;
const https_1 = require("firebase-functions/v2/https");
const context_1 = require("../context");
const schedule_1 = require("../services/schedule");
// CORS設定
const corsOptions = {
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [context_1.webAppUrl, context_1.slackBotToken, context_1.openaiApiKey, context_1.openaiApiUrl]
};
/**
 * スケジュール設定を取得するAPI
 */
exports.getScheduleSettings = (0, https_1.onRequest)(corsOptions, async (req, res) => {
    try {
        const doc = await context_1.db.collection("settings").doc("slack").get();
        if (!doc.exists) {
            res.json({ success: true, data: null });
            return;
        }
        const settings = doc.data();
        const scheduleData = {
            dailyReportTime: settings.dailyReportTime || null,
            weeklyReportTime: settings.weeklyReportTime || null,
            weeklyReportDay: settings.weeklyReportDay || null,
            dailyReportEnabled: !!settings.dailyReportTime,
            weeklyReportEnabled: !!(settings.weeklyReportTime && settings.weeklyReportDay !== undefined)
        };
        res.json({ success: true, data: scheduleData });
    }
    catch (error) {
        context_1.logger.error("Error fetching schedule settings:", error);
        res.status(500).json({ success: false, error: "Failed to fetch schedule settings" });
    }
});
/**
 * スケジュール設定を更新するAPI
 */
exports.updateScheduleSettingsAPI = (0, https_1.onRequest)(corsOptions, async (req, res) => {
    try {
        const { dailyReportTime, weeklyReportTime, weeklyReportDay } = req.body || {};
        // 入力値の検証
        if (dailyReportTime && !isValidTimeFormat(dailyReportTime)) {
            res.status(400).json({ success: false, error: "dailyReportTime must be in HH:MM format" });
            return;
        }
        if (weeklyReportTime && !isValidTimeFormat(weeklyReportTime)) {
            res.status(400).json({ success: false, error: "weeklyReportTime must be in HH:MM format" });
            return;
        }
        if (weeklyReportDay !== undefined && (weeklyReportDay < 0 || weeklyReportDay > 6)) {
            res.status(400).json({ success: false, error: "weeklyReportDay must be between 0 (Sunday) and 6 (Saturday)" });
            return;
        }
        // 既存のSlack設定を取得
        const doc = await context_1.db.collection("settings").doc("slack").get();
        const existingSettings = doc.exists ? doc.data() : null;
        // 新しい設定を作成
        const updatedSettings = Object.assign(Object.assign({}, existingSettings), { dailyReportTime: dailyReportTime || null, weeklyReportTime: weeklyReportTime || null, weeklyReportDay: weeklyReportDay !== undefined ? weeklyReportDay : null, updatedAt: new Date(), 
            // 必須フィールドの設定
            channelName: (existingSettings === null || existingSettings === void 0 ? void 0 : existingSettings.channelName) || '', channelId: (existingSettings === null || existingSettings === void 0 ? void 0 : existingSettings.channelId) || null, deliveryMentionUserId: (existingSettings === null || existingSettings === void 0 ? void 0 : existingSettings.deliveryMentionUserId) || null, errorMentionUserId: (existingSettings === null || existingSettings === void 0 ? void 0 : existingSettings.errorMentionUserId) || null });
        // Firestoreに保存
        await context_1.db.collection("settings").doc("slack").set(updatedSettings, { merge: true });
        // スケジュール設定を更新
        await (0, schedule_1.updateScheduleSettings)(updatedSettings);
        context_1.logger.info("Schedule settings updated successfully:", {
            dailyReportTime: updatedSettings.dailyReportTime,
            weeklyReportTime: updatedSettings.weeklyReportTime,
            weeklyReportDay: updatedSettings.weeklyReportDay
        });
        res.json({ success: true, data: updatedSettings });
    }
    catch (error) {
        context_1.logger.error("Error updating schedule settings:", error);
        res.status(500).json({ success: false, error: "Failed to update schedule settings" });
    }
});
/**
 * スケジュールテスト実行API（手動実行用）
 */
exports.testScheduleTask = (0, https_1.onRequest)(corsOptions, async (req, res) => {
    try {
        const { taskType } = req.body || {};
        if (!taskType || !['daily', 'weekly'].includes(taskType)) {
            res.status(400).json({ success: false, error: "taskType must be 'daily' or 'weekly'" });
            return;
        }
        // 設定を確認
        const shouldRun = await (0, schedule_1.shouldRunScheduledTask)(taskType);
        if (!shouldRun) {
            res.status(400).json({
                success: false,
                error: `Scheduled ${taskType} task is not configured or disabled`
            });
            return;
        }
        context_1.logger.info(`Manual test execution of ${taskType} scheduled task`);
        // 実際のタスクを実行（簡略化）
        if (taskType === 'daily') {
            // 日次タスクのテスト実行
            res.json({
                success: true,
                message: "Daily task test execution completed (simulation)"
            });
        }
        else {
            // 週次タスクのテスト実行
            res.json({
                success: true,
                message: "Weekly task test execution completed (simulation)"
            });
        }
    }
    catch (error) {
        context_1.logger.error("Error in test schedule task:", error);
        res.status(500).json({ success: false, error: "Failed to execute test task" });
    }
});
/**
 * スケジュール設定の検証とCron式生成API
 */
exports.generateCronExpression = (0, https_1.onRequest)(corsOptions, async (req, res) => {
    try {
        const { time, dayOfWeek } = req.body || {};
        if (!time || !isValidTimeFormat(time)) {
            res.status(400).json({ success: false, error: "time must be in HH:MM format" });
            return;
        }
        if (dayOfWeek !== undefined && (dayOfWeek < 0 || dayOfWeek > 6)) {
            res.status(400).json({ success: false, error: "dayOfWeek must be between 0 (Sunday) and 6 (Saturday)" });
            return;
        }
        const cronExpression = (0, schedule_1.timeToCronExpression)(time, dayOfWeek);
        const description = dayOfWeek !== undefined
            ? `Every ${getDayName(dayOfWeek)} at ${time} JST`
            : `Every day at ${time} JST`;
        res.json({
            success: true,
            data: {
                cronExpression,
                description,
                time,
                dayOfWeek: dayOfWeek || null
            }
        });
    }
    catch (error) {
        context_1.logger.error("Error generating cron expression:", error);
        res.status(500).json({ success: false, error: "Failed to generate cron expression" });
    }
});
// ヘルパー関数
function isValidTimeFormat(time) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
}
function getDayName(dayOfWeek) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek] || 'Unknown';
}
//# sourceMappingURL=schedule.js.map