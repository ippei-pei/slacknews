// テキスト処理ユーティリティ

/**
 * HTMLタグを除去する関数
 * @param html HTML文字列
 * @returns タグが除去されたテキスト
 */
export function stripHtmlTags(html: string): string {
  if (!html) return '';
  
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
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * 複数の空白を1つの空白に正規化
 * @param text テキスト
 * @returns 正規化されたテキスト
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
