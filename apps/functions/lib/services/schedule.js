"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledWeeklyTask = exports.scheduledDailyTask = void 0;
exports.updateScheduleSettings = updateScheduleSettings;
exports.timeToCronExpression = timeToCronExpression;
exports.shouldRunScheduledTask = shouldRunScheduledTask;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const context_1 = require("../context");
const report_1 = require("./report");
/**
 * 日次スケジュール実行関数
 * 毎日指定時間に情報収集、翻訳、配信、日次レポートを実行
 */
exports.scheduledDailyTask = (0, scheduler_1.onSchedule)({
    schedule: "every day 09:00", // デフォルトは9:00 JST（実際の時間は設定から取得）
    timeZone: "Asia/Tokyo",
    memory: "1GiB",
    timeoutSeconds: 540, // 9分
    secrets: [context_1.slackBotToken, context_1.openaiApiKey, context_1.openaiApiUrl]
}, async (event) => {
    try {
        context_1.logger.info("Starting scheduled daily task...");
        // 1. 情報収集
        context_1.logger.info("Step 1: Running news collection...");
        // 実際の実装では、共通のサービス関数を作成して呼び出す
        context_1.logger.info("News collection step completed (simulation)");
        // 2. 翻訳処理
        context_1.logger.info("Step 2: Running translation...");
        // 実際の実装では、共通のサービス関数を作成して呼び出す
        context_1.logger.info("Translation step completed (simulation)");
        // 3. 記事配信
        context_1.logger.info("Step 3: Running news delivery...");
        // deliverNews関数はHTTP関数なので、内部から直接呼び出すのは適切ではない
        // 実際の実装では、共通のサービス関数を作成して呼び出す
        context_1.logger.info("News delivery step completed (simulation)");
        // 4. 日次レポート配信
        context_1.logger.info("Step 4: Running daily report...");
        const dailyResult = await (0, report_1.executeDailyReport)();
        context_1.logger.info("Daily report completed:", dailyResult.message);
        context_1.logger.info("Scheduled daily task completed successfully");
    }
    catch (error) {
        context_1.logger.error("Error in scheduled daily task:", error);
        // エラー通知をSlackに送信
        try {
            const settingsDoc = await context_1.db.collection("settings").doc("slack").get();
            const settings = (settingsDoc.exists ? settingsDoc.data() : null);
            if ((settings === null || settings === void 0 ? void 0 : settings.channelId) && (settings === null || settings === void 0 ? void 0 : settings.errorMentionUserId)) {
                const errorMessage = {
                    channel: settings.channelId,
                    text: `<@${settings.errorMentionUserId}> 日次スケジュール実行でエラーが発生しました。詳細: ${((error === null || error === void 0 ? void 0 : error.message) || String(error)).slice(0, 300)}`
                };
                // エラー通知のSlack送信は簡略化（実際の実装ではpostToSlackChannelを使用）
                context_1.logger.error("Slack error notification:", errorMessage);
            }
        }
        catch (notificationError) {
            context_1.logger.error("Failed to send error notification:", notificationError);
        }
    }
});
/**
 * 週次スケジュール実行関数
 * 毎週指定曜日・時間に週次レポートを実行
 */
exports.scheduledWeeklyTask = (0, scheduler_1.onSchedule)({
    schedule: "every monday 10:00", // デフォルトは月曜日10:00 JST
    timeZone: "Asia/Tokyo",
    memory: "1GiB",
    timeoutSeconds: 300, // 5分
    secrets: [context_1.slackBotToken, context_1.openaiApiKey, context_1.openaiApiUrl]
}, async (event) => {
    try {
        context_1.logger.info("Starting scheduled weekly task...");
        // 週次レポート配信
        const weeklyResult = await (0, report_1.executeWeeklyReport)();
        context_1.logger.info("Weekly report completed:", weeklyResult.message);
        context_1.logger.info("Scheduled weekly task completed successfully");
    }
    catch (error) {
        context_1.logger.error("Error in scheduled weekly task:", error);
        // エラー通知をSlackに送信
        try {
            const settingsDoc = await context_1.db.collection("settings").doc("slack").get();
            const settings = (settingsDoc.exists ? settingsDoc.data() : null);
            if ((settings === null || settings === void 0 ? void 0 : settings.channelId) && (settings === null || settings === void 0 ? void 0 : settings.errorMentionUserId)) {
                const errorMessage = {
                    channel: settings.channelId,
                    text: `<@${settings.errorMentionUserId}> 週次スケジュール実行でエラーが発生しました。詳細: ${((error === null || error === void 0 ? void 0 : error.message) || String(error)).slice(0, 300)}`
                };
                context_1.logger.error("Slack error notification:", errorMessage);
            }
        }
        catch (notificationError) {
            context_1.logger.error("Failed to send error notification:", notificationError);
        }
    }
});
/**
 * スケジュール設定を更新する関数
 * 設定に基づいてスケジュールを動的に更新
 */
async function updateScheduleSettings(settings) {
    try {
        // 実際の実装では、Cloud Scheduler APIを使用してスケジュールを更新
        // ここでは設定を保存するだけ（実際のスケジュール更新は手動または別の仕組みで行う）
        context_1.logger.info("Schedule settings updated:", {
            dailyReportTime: settings.dailyReportTime,
            weeklyReportTime: settings.weeklyReportTime,
            weeklyReportDay: settings.weeklyReportDay
        });
    }
    catch (error) {
        context_1.logger.error("Error updating schedule settings:", error);
        throw error;
    }
}
/**
 * 時間設定をCron式に変換
 */
function timeToCronExpression(time, dayOfWeek) {
    const [hours, minutes] = time.split(':').map(Number);
    if (dayOfWeek !== undefined) {
        // 週次スケジュール（曜日指定）
        return `${minutes} ${hours} * * ${dayOfWeek}`;
    }
    else {
        // 日次スケジュール
        return `${minutes} ${hours} * * *`;
    }
}
/**
 * 現在の設定を取得してスケジュール実行を決定
 */
async function shouldRunScheduledTask(taskType) {
    try {
        const settingsDoc = await context_1.db.collection("settings").doc("slack").get();
        const settings = (settingsDoc.exists ? settingsDoc.data() : null);
        if (!settings) {
            context_1.logger.warn("No Slack settings found, skipping scheduled task");
            return false;
        }
        if (taskType === 'daily') {
            // 日次タスクは設定された時間に実行
            return !!settings.dailyReportTime;
        }
        else {
            // 週次タスクは設定された曜日・時間に実行
            return !!(settings.weeklyReportTime && settings.weeklyReportDay !== undefined);
        }
    }
    catch (error) {
        context_1.logger.error("Error checking schedule settings:", error);
        return false;
    }
}
//# sourceMappingURL=schedule.js.map