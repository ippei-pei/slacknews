import { RSSItem } from '../types';
import { stripHtmlTags } from './text';

/**
 * 簡易RSS解析関数
 * @param xmlText RSSのXMLテキスト
 * @returns 解析されたRSSアイテムの配列
 */
export function parseRSSFeed(xmlText: string): RSSItem[] {
  const items: RSSItem[] = [];
  
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
        title: stripHtmlTags(title[1]),
        link: link ? link[1] : '',
        description: description ? stripHtmlTags(description[1]) : '',
        pubDate: pubDate ? pubDate[1] : ''
      });
    }
  }
  
  return items;
}
