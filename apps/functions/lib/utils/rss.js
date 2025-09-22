"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRSSFeed = parseRSSFeed;
const text_1 = require("./text");
/**
 * 簡易RSS解析関数
 * @param xmlText RSSのXMLテキスト
 * @returns 解析されたRSSアイテムの配列
 */
function parseRSSFeed(xmlText) {
    const items = [];
    // 簡易的なXML解析
    const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];
    for (const itemXml of itemMatches) {
        // より柔軟なタイトル抽出
        const title = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
            itemXml.match(/<title>(.*?)<\/title>/) ||
            itemXml.match(/<title[^>]*>(.*?)<\/title>/);
        // より柔軟なリンク抽出
        const link = itemXml.match(/<link>(.*?)<\/link>/) ||
            itemXml.match(/<guid[^>]*>(.*?)<\/guid>/) ||
            itemXml.match(/<guid>(.*?)<\/guid>/);
        // より柔軟な説明抽出
        const description = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
            itemXml.match(/<description>(.*?)<\/description>/) ||
            itemXml.match(/<content><!\[CDATA\[(.*?)\]\]><\/content>/) ||
            itemXml.match(/<content>(.*?)<\/content>/);
        // より柔軟な日付抽出
        const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/) ||
            itemXml.match(/<dc:date>(.*?)<\/dc:date>/) ||
            itemXml.match(/<published>(.*?)<\/published>/);
        if (title && title[1].trim()) {
            const item = {
                title: (0, text_1.stripHtmlTags)(title[1].trim()),
                link: link ? link[1].trim() : '',
                description: description ? (0, text_1.stripHtmlTags)(description[1].trim()) : '',
                pubDate: pubDate ? pubDate[1].trim() : ''
            };
            // 基本的なバリデーション
            if (item.title && item.title.length > 0) {
                items.push(item);
            }
        }
    }
    return items;
}
//# sourceMappingURL=rss.js.map