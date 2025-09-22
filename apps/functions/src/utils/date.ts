// JST日付境界生成ユーティリティ

/**
 * JSTの指定日の開始時刻を生成
 * @param date 日付文字列 (YYYY-MM-DD) または Date オブジェクト
 * @returns JSTの開始時刻
 */
export function toJstStartOfDay(date: string | Date): Date {
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
  return new Date(`${dateStr}T00:00:00+09:00`);
}

/**
 * JSTの指定日の終了時刻を生成
 * @param date 日付文字列 (YYYY-MM-DD) または Date オブジェクト
 * @returns JSTの終了時刻
 */
export function toJstEndOfDay(date: string | Date): Date {
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
  return new Date(`${dateStr}T23:59:59+09:00`);
}

/**
 * 週の開始日（日曜日）を取得
 * @param date 基準日
 * @returns 週の開始日
 */
export function getWeekStart(date: Date): Date {
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

/**
 * 週の終了日（土曜日）を取得
 * @param date 基準日
 * @returns 週の終了日
 */
export function getWeekEnd(date: Date): Date {
  const weekEnd = new Date(date);
  weekEnd.setDate(date.getDate() + (6 - date.getDay()));
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

/**
 * 現在のJST日付を文字列で取得
 * @returns YYYY-MM-DD形式の日付文字列
 */
export function getCurrentJstDateString(): string {
  const jstOffsetMs = 9 * 60 * 60 * 1000; // JST(+9:00)
  const now = new Date();
  return new Date(now.getTime() + jstOffsetMs).toISOString().split('T')[0];
}
