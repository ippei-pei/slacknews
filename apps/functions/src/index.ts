import * as dotenv from "dotenv";

// .envファイルを読み込み
dotenv.config({ path: "../../.env" });

// 各ルートから関数を再エクスポート
export {
  // 設定管理
  getSlackSettings,
  updateSlackSettings,
  listSlackChannels,
  listSlackChannelMembers
} from './routes/settings';

export {
  // 企業管理
  getCompanies,
  addCompany,
  updateCompany,
  deleteCompany
} from './routes/companies';

export {
  // ニュース管理
  getNews,
  cleanupNews
} from './routes/news';

export {
  // 情報収集
  runCollection
} from './routes/collect';

export {
  // 翻訳処理
  translateDeliveryTargetNews
} from './routes/translate';

export {
  // 配信処理
  deliverNews,
  deliverDailyReport,
  deliverWeeklyReport
} from './routes/reports';

export {
  // スケジュール管理
  getScheduleSettings,
  updateScheduleSettingsAPI,
  testScheduleTask,
  generateCronExpression
} from './routes/schedule';

export {
  // スケジュール実行
  scheduledDailyTask,
  scheduledWeeklyTask
} from './services/schedule';

export {
  // スケジュールテスト
  testScheduleExecution,
  testScheduleSettings,
  testScheduleIntegration
} from './routes/test-schedule';

// export {
//   // テスト用
//   testRandomCollection
// } from './routes/test-collect';

// export {
//   // シンプルテスト用
//   simpleTest
// } from './routes/simple-test';

// export {
//   // デバッグテスト用
//   debugTest
// } from './routes/debug-test';
