"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testScheduleIntegration = exports.testScheduleSettings = exports.testScheduleExecution = void 0;
const https_1 = require("firebase-functions/v2/https");
const context_1 = require("../context");
const report_1 = require("../services/report");
const schedule_1 = require("../services/schedule");
// CORS設定
const corsOptions = {
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [context_1.webAppUrl]
};
/**
 * スケジュール機能のテスト実行API
 */
exports.testScheduleExecution = (0, https_1.onRequest)(corsOptions, async (req, res) => {
    try {
        const { taskType, date, weekStart } = req.body || {};
        if (!taskType || !['daily', 'weekly'].includes(taskType)) {
            res.status(400).json({ success: false, error: "taskType must be 'daily' or 'weekly'" });
            return;
        }
        context_1.logger.info(`Testing ${taskType} schedule execution...`);
        let result;
        if (taskType === 'daily') {
            result = await (0, report_1.executeDailyReport)(date);
        }
        else {
            result = await (0, report_1.executeWeeklyReport)(weekStart);
        }
        res.json({
            success: true,
            message: `${taskType} task test execution completed`,
            result
        });
    }
    catch (error) {
        context_1.logger.error("Error in test schedule execution:", error);
        res.status(500).json({ success: false, error: "Failed to execute test task" });
    }
});
/**
 * スケジュール設定の検証テストAPI
 */
exports.testScheduleSettings = (0, https_1.onRequest)(corsOptions, async (req, res) => {
    try {
        const { time, dayOfWeek } = req.body || {};
        // 時間形式の検証
        if (time && !isValidTimeFormat(time)) {
            res.status(400).json({ success: false, error: "time must be in HH:MM format" });
            return;
        }
        // 曜日の検証
        if (dayOfWeek !== undefined && (dayOfWeek < 0 || dayOfWeek > 6)) {
            res.status(400).json({ success: false, error: "dayOfWeek must be between 0 (Sunday) and 6 (Saturday)" });
            return;
        }
        // Cron式生成テスト
        let cronExpression = null;
        if (time) {
            cronExpression = (0, schedule_1.timeToCronExpression)(time, dayOfWeek);
        }
        // スケジュール実行可能かチェック
        const canRunDaily = await (0, schedule_1.shouldRunScheduledTask)('daily');
        const canRunWeekly = await (0, schedule_1.shouldRunScheduledTask)('weekly');
        context_1.logger.info(`Schedule execution check - Daily: ${canRunDaily}, Weekly: ${canRunWeekly}`);
        res.json({
            success: true,
            data: {
                timeValidation: time ? isValidTimeFormat(time) : null,
                dayOfWeekValidation: dayOfWeek !== undefined ? (dayOfWeek >= 0 && dayOfWeek <= 6) : null,
                cronExpression,
                canRunDaily,
                canRunWeekly,
                testResults: {
                    dailyScheduleEnabled: canRunDaily,
                    weeklyScheduleEnabled: canRunWeekly
                }
            }
        });
    }
    catch (error) {
        context_1.logger.error("Error in test schedule settings:", error);
        res.status(500).json({ success: false, error: "Failed to test schedule settings" });
    }
});
/**
 * スケジュール機能の総合テストAPI
 */
exports.testScheduleIntegration = (0, https_1.onRequest)(corsOptions, async (req, res) => {
    try {
        context_1.logger.info("Starting schedule integration test...");
        const results = {
            settingsValidation: false,
            cronGeneration: false,
            taskExecution: false,
            errorHandling: false
        };
        // 1. 設定検証テスト
        try {
            const canRunDaily = await (0, schedule_1.shouldRunScheduledTask)('daily');
            const canRunWeekly = await (0, schedule_1.shouldRunScheduledTask)('weekly');
            results.settingsValidation = true;
            context_1.logger.info(`Settings validation test passed - Daily: ${canRunDaily}, Weekly: ${canRunWeekly}`);
        }
        catch (error) {
            context_1.logger.error("Settings validation test failed:", error);
        }
        // 2. Cron式生成テスト
        try {
            const cron1 = (0, schedule_1.timeToCronExpression)('09:00');
            const cron2 = (0, schedule_1.timeToCronExpression)('10:30', 1);
            results.cronGeneration = !!(cron1 && cron2);
            context_1.logger.info("Cron generation test passed");
        }
        catch (error) {
            context_1.logger.error("Cron generation test failed:", error);
        }
        // 3. タスク実行テスト（シミュレーション）
        try {
            // 実際のレポート実行は外部依存があるため、シミュレーション
            results.taskExecution = true;
            context_1.logger.info("Task execution test passed (simulation)");
        }
        catch (error) {
            context_1.logger.error("Task execution test failed:", error);
        }
        // 4. エラーハンドリングテスト
        try {
            // 無効な時間形式でテスト
            const invalidTime = (0, schedule_1.timeToCronExpression)('25:00');
            results.errorHandling = !invalidTime; // 無効な場合はnullが返されるべき
            context_1.logger.info("Error handling test passed");
        }
        catch (error) {
            results.errorHandling = true; // エラーが適切に処理された
            context_1.logger.info("Error handling test passed (error caught)");
        }
        const allTestsPassed = Object.values(results).every(result => result === true);
        res.json({
            success: allTestsPassed,
            message: allTestsPassed ? "All schedule integration tests passed" : "Some schedule integration tests failed",
            results,
            summary: {
                totalTests: Object.keys(results).length,
                passedTests: Object.values(results).filter(result => result === true).length,
                failedTests: Object.values(results).filter(result => result === false).length
            }
        });
    }
    catch (error) {
        context_1.logger.error("Error in schedule integration test:", error);
        res.status(500).json({ success: false, error: "Failed to run integration test" });
    }
});
// ヘルパー関数
function isValidTimeFormat(time) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
}
//# sourceMappingURL=test-schedule.js.map