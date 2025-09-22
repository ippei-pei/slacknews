"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliverWeeklyReport = exports.deliverDailyReport = exports.deliverNews = exports.translateDeliveryTargetNews = exports.runCollection = exports.cleanupNews = exports.getNews = exports.deleteCompany = exports.updateCompany = exports.addCompany = exports.getCompanies = exports.listSlackChannelMembers = exports.listSlackChannels = exports.updateSlackSettings = exports.getSlackSettings = void 0;
const dotenv = __importStar(require("dotenv"));
// .envファイルを読み込み
dotenv.config({ path: "../../.env" });
// 各ルートから関数を再エクスポート
var settings_1 = require("./routes/settings");
// 設定管理
Object.defineProperty(exports, "getSlackSettings", { enumerable: true, get: function () { return settings_1.getSlackSettings; } });
Object.defineProperty(exports, "updateSlackSettings", { enumerable: true, get: function () { return settings_1.updateSlackSettings; } });
Object.defineProperty(exports, "listSlackChannels", { enumerable: true, get: function () { return settings_1.listSlackChannels; } });
Object.defineProperty(exports, "listSlackChannelMembers", { enumerable: true, get: function () { return settings_1.listSlackChannelMembers; } });
var companies_1 = require("./routes/companies");
// 企業管理
Object.defineProperty(exports, "getCompanies", { enumerable: true, get: function () { return companies_1.getCompanies; } });
Object.defineProperty(exports, "addCompany", { enumerable: true, get: function () { return companies_1.addCompany; } });
Object.defineProperty(exports, "updateCompany", { enumerable: true, get: function () { return companies_1.updateCompany; } });
Object.defineProperty(exports, "deleteCompany", { enumerable: true, get: function () { return companies_1.deleteCompany; } });
var news_1 = require("./routes/news");
// ニュース管理
Object.defineProperty(exports, "getNews", { enumerable: true, get: function () { return news_1.getNews; } });
Object.defineProperty(exports, "cleanupNews", { enumerable: true, get: function () { return news_1.cleanupNews; } });
var collect_1 = require("./routes/collect");
// 情報収集
Object.defineProperty(exports, "runCollection", { enumerable: true, get: function () { return collect_1.runCollection; } });
var translate_1 = require("./routes/translate");
// 翻訳処理
Object.defineProperty(exports, "translateDeliveryTargetNews", { enumerable: true, get: function () { return translate_1.translateDeliveryTargetNews; } });
var reports_1 = require("./routes/reports");
// 配信処理
Object.defineProperty(exports, "deliverNews", { enumerable: true, get: function () { return reports_1.deliverNews; } });
Object.defineProperty(exports, "deliverDailyReport", { enumerable: true, get: function () { return reports_1.deliverDailyReport; } });
Object.defineProperty(exports, "deliverWeeklyReport", { enumerable: true, get: function () { return reports_1.deliverWeeklyReport; } });
//# sourceMappingURL=index.js.map