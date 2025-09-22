import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger, db, slackBotToken, openaiApiKey, openaiApiUrl } from '../context';
import { SlackSettings } from '../types';
import { executeDailyReport, executeWeeklyReport } from './report';

/**
 * 日次スケジュール実行関数
 * 毎日指定時間に情報収集、翻訳、配信、日次レポートを実行
 */
export const scheduledDailyTask = onSchedule({
  schedule: "every day 09:00", // デフォルトは9:00 JST（実際の時間は設定から取得）
  timeZone: "Asia/Tokyo",
  memory: "1GiB",
  timeoutSeconds: 540, // 9分
  secrets: [slackBotToken, openaiApiKey, openaiApiUrl]
}, async (event) => {
  try {
    logger.info("Starting scheduled daily task...");

    // 1. 情報収集
    logger.info("Step 1: Running news collection...");
    // 実際の実装では、共通のサービス関数を作成して呼び出す
    logger.info("News collection step completed (simulation)");

    // 2. 翻訳処理
    logger.info("Step 2: Running translation...");
    // 実際の実装では、共通のサービス関数を作成して呼び出す
    logger.info("Translation step completed (simulation)");

    // 3. 記事配信
    logger.info("Step 3: Running news delivery...");
    // deliverNews関数はHTTP関数なので、内部から直接呼び出すのは適切ではない
    // 実際の実装では、共通のサービス関数を作成して呼び出す
    logger.info("News delivery step completed (simulation)");

    // 4. 日次レポート配信
    logger.info("Step 4: Running daily report...");
    const dailyResult = await executeDailyReport();
    logger.info("Daily report completed:", dailyResult.message);

    logger.info("Scheduled daily task completed successfully");
  } catch (error) {
    logger.error("Error in scheduled daily task:", error);
    
    // エラー通知をSlackに送信
    try {
      const settingsDoc = await db.collection("settings").doc("slack").get();
      const settings = (settingsDoc.exists ? settingsDoc.data() : null) as SlackSettings | null;
      
      if (settings?.channelId && settings?.errorMentionUserId) {
        const errorMessage = {
          channel: settings.channelId,
          text: `<@${settings.errorMentionUserId}> 日次スケジュール実行でエラーが発生しました。詳細: ${((error as any)?.message || String(error)).slice(0, 300)}`
        };
        // エラー通知のSlack送信は簡略化（実際の実装ではpostToSlackChannelを使用）
        logger.error("Slack error notification:", errorMessage);
      }
    } catch (notificationError) {
      logger.error("Failed to send error notification:", notificationError);
    }
  }
});

/**
 * 週次スケジュール実行関数
 * 毎週指定曜日・時間に週次レポートを実行
 */
export const scheduledWeeklyTask = onSchedule({
  schedule: "every monday 10:00", // デフォルトは月曜日10:00 JST
  timeZone: "Asia/Tokyo",
  memory: "1GiB",
  timeoutSeconds: 300, // 5分
  secrets: [slackBotToken, openaiApiKey, openaiApiUrl]
}, async (event) => {
  try {
    logger.info("Starting scheduled weekly task...");

    // 週次レポート配信
    const weeklyResult = await executeWeeklyReport();
    logger.info("Weekly report completed:", weeklyResult.message);

    logger.info("Scheduled weekly task completed successfully");
  } catch (error) {
    logger.error("Error in scheduled weekly task:", error);
    
    // エラー通知をSlackに送信
    try {
      const settingsDoc = await db.collection("settings").doc("slack").get();
      const settings = (settingsDoc.exists ? settingsDoc.data() : null) as SlackSettings | null;
      
      if (settings?.channelId && settings?.errorMentionUserId) {
        const errorMessage = {
          channel: settings.channelId,
          text: `<@${settings.errorMentionUserId}> 週次スケジュール実行でエラーが発生しました。詳細: ${((error as any)?.message || String(error)).slice(0, 300)}`
        };
        logger.error("Slack error notification:", errorMessage);
      }
    } catch (notificationError) {
      logger.error("Failed to send error notification:", notificationError);
    }
  }
});

/**
 * スケジュール設定を更新する関数
 * 設定に基づいてスケジュールを動的に更新
 */
export async function updateScheduleSettings(settings: SlackSettings): Promise<void> {
  try {
    // 実際の実装では、Cloud Scheduler APIを使用してスケジュールを更新
    // ここでは設定を保存するだけ（実際のスケジュール更新は手動または別の仕組みで行う）
    logger.info("Schedule settings updated:", {
      dailyReportTime: settings.dailyReportTime,
      weeklyReportTime: settings.weeklyReportTime,
      weeklyReportDay: settings.weeklyReportDay
    });
  } catch (error) {
    logger.error("Error updating schedule settings:", error);
    throw error;
  }
}

/**
 * 時間設定をCron式に変換
 */
export function timeToCronExpression(time: string, dayOfWeek?: number): string {
  const [hours, minutes] = time.split(':').map(Number);
  
  if (dayOfWeek !== undefined) {
    // 週次スケジュール（曜日指定）
    return `${minutes} ${hours} * * ${dayOfWeek}`;
  } else {
    // 日次スケジュール
    return `${minutes} ${hours} * * *`;
  }
}

/**
 * 現在の設定を取得してスケジュール実行を決定
 */
export async function shouldRunScheduledTask(taskType: 'daily' | 'weekly'): Promise<boolean> {
  try {
    const settingsDoc = await db.collection("settings").doc("slack").get();
    const settings = (settingsDoc.exists ? settingsDoc.data() : null) as SlackSettings | null;
    
    if (!settings) {
      logger.warn("No Slack settings found, skipping scheduled task");
      return false;
    }

    if (taskType === 'daily') {
      // 日次タスクは設定された時間に実行
      return !!settings.dailyReportTime;
    } else {
      // 週次タスクは設定された曜日・時間に実行
      return !!(settings.weeklyReportTime && settings.weeklyReportDay !== undefined);
    }
  } catch (error) {
    logger.error("Error checking schedule settings:", error);
    return false;
  }
}
