"use strict";
// テキスト処理ユーティリティ
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripHtmlTags = stripHtmlTags;
exports.truncateText = truncateText;
exports.normalizeWhitespace = normalizeWhitespace;
/**
 * HTMLタグを除去する関数
 * @param html HTML文字列
 * @returns タグが除去されたテキスト
 */
function stripHtmlTags(html) {
    if (!html)
        return '';
    return html
        .replace(/<[^>]*>/g, '') // HTMLタグを除去
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ') // 複数の空白を1つに
        .trim();
}
/**
 * テキストを指定された長さで切り詰める
 * @param text テキスト
 * @param maxLength 最大長
 * @returns 切り詰められたテキスト
 */
function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength)
        return text;
    return text.slice(0, maxLength) + '...';
}
/**
 * 複数の空白を1つの空白に正規化
 * @param text テキスト
 * @returns 正規化されたテキスト
 */
function normalizeWhitespace(text) {
    return text.replace(/\s+/g, ' ').trim();
}
//# sourceMappingURL=text.js.map