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
        const title = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
            itemXml.match(/<title>(.*?)<\/title>/);
        const link = itemXml.match(/<link>(.*?)<\/link>/);
        const description = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
            itemXml.match(/<description>(.*?)<\/description>/);
        const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
        if (title) {
            items.push({
                title: (0, text_1.stripHtmlTags)(title[1]),
                link: link ? link[1] : '',
                description: description ? (0, text_1.stripHtmlTags)(description[1]) : '',
                pubDate: pubDate ? pubDate[1] : ''
            });
        }
    }
    return items;
}
//# sourceMappingURL=rss.js.map