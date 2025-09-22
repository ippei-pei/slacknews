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
