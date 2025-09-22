"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCompany = exports.updateCompany = exports.addCompany = exports.getCompanies = void 0;
const https_1 = require("firebase-functions/v2/https");
const context_1 = require("../context");
// CORS設定
const corsOptions = {
    cors: ["http://localhost:3000", "http://localhost:3001", "https://slack-news-63e2e.web.app"],
    secrets: [context_1.webAppUrl]
};
// 企業一覧取得API
exports.getCompanies = (0, https_1.onRequest)(corsOptions, async (req, res) => {
    try {
        // インデックス構築中は簡素なクエリを使用
        const companiesSnapshot = await context_1.db.collection("companies")
            .where("isActive", "==", true)
            .get();
        const companies = companiesSnapshot.docs.map(doc => {
            const data = doc.data();
            return Object.assign({ id: doc.id }, data);
        });
        // 作成日時でソート（クライアント側）
        companies.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        res.json({ success: true, data: companies });
    }
    catch (error) {
        context_1.logger.error("Error fetching companies:", error);
        res.status(500).json({ success: false, error: "Failed to fetch companies" });
    }
});
// 企業追加API
exports.addCompany = (0, https_1.onRequest)(corsOptions, async (req, res) => {
    try {
        const { name, url, rssUrl, redditUrl, priority } = req.body;
        if (!name || !url) {
            res.status(400).json({
                success: false,
                error: "Name and URL are required"
            });
            return;
        }
        const companyData = {
            name,
            url,
            rssUrl: rssUrl || "",
            redditUrl: redditUrl || "",
            priority: priority || 2,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const docRef = await context_1.db.collection("companies").add(companyData);
        res.json({
            success: true,
            data: Object.assign({ id: docRef.id }, companyData)
        });
    }
    catch (error) {
        context_1.logger.error("Error adding company:", error);
        res.status(500).json({ success: false, error: "Failed to add company" });
    }
});
// 企業編集API
exports.updateCompany = (0, https_1.onRequest)(corsOptions, async (req, res) => {
    try {
        const { companyId, name, rssUrl, redditUrl } = req.body;
        if (!companyId) {
            res.status(400).json({
                success: false,
                error: "Company ID is required"
            });
            return;
        }
        if (!name) {
            res.status(400).json({
                success: false,
                error: "Company name is required"
            });
            return;
        }
        const companyData = {
            name,
            rssUrl: rssUrl || null,
            redditUrl: redditUrl || null,
            updatedAt: new Date()
        };
        await context_1.db.collection("companies").doc(companyId).update(companyData);
        res.json({
            success: true,
            message: "企業情報が更新されました",
            data: Object.assign({ id: companyId }, companyData)
        });
    }
    catch (error) {
        context_1.logger.error("Error updating company:", error);
        res.status(500).json({ success: false, error: "Failed to update company" });
    }
});
// 企業削除API
exports.deleteCompany = (0, https_1.onRequest)(corsOptions, async (req, res) => {
    try {
        const { companyId } = req.body;
        if (!companyId) {
            res.status(400).json({
                success: false,
                error: "Company ID is required"
            });
            return;
        }
        await context_1.db.collection("companies").doc(companyId).delete();
        res.json({
            success: true,
            message: "企業が削除されました"
        });
    }
    catch (error) {
        context_1.logger.error("Error deleting company:", error);
        res.status(500).json({ success: false, error: "Failed to delete company" });
    }
});
//# sourceMappingURL=companies.js.map