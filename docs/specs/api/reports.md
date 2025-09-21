---
title: レポート配信 API
description: Slack への日次・週次レポート配信およびテスト実行 API。
status: draft
---

## 概要
ニュース統合結果から日次/週次レポートを生成し、Slack へ投稿する。手動実行・バッチ実行双方に対応する。

## エンドポイント
| Method | Path | 説明 |
|--------|------|------|
| POST | `/reports/daily` | 日次レポートの生成・配信 |
| POST | `/reports/weekly` | 週次レポートの生成・配信 |
| POST | `/tests/reports/daily` | 日次レポート配信テスト（モックデータ） |
| POST | `/tests/reports/weekly` | 週次レポート配信テスト |

### リクエスト
```json
{
  "companyIds": ["company_pokemon"],
  "overrideChannelId": "C1234567890",
  "simulate": false
}
```
- `companyIds`: 指定しない場合は全企業
- `overrideChannelId`: 管理画面からテスト投稿する際に使用（本番では設定値を利用）
- `simulate`: true の場合は Slack 送信をスキップし、フォーマットのみ返す

### レスポンス（正常）
```json
{
  "success": true,
  "data": {
    "channelId": "C1234567890",
    "messageTs": "1726728000.000100",
    "threadCount": 12,
    "articlesDelivered": 18,
    "reportType": "daily"
  },
  "meta": { "timestamp": "2025-09-19T09:00:05Z", "requestId": "req_daily_456" }
}
```

## Slack 投稿フォーマット
### 日次
- メインメッセージ: `📊 競合情報レポート (XX件)` + 重要度上位 10 件リンク
- スレッド: 残りの記事を順次投稿（重要度順）
- 重要度スコアは表示しない

### 週次
- メインメッセージのみで配信
- セクション: 企業別の基本戦略 / 変更点 / ニュースサマリ / 競合比較 / 参考リンク
- 締め: 市場動向まとめ・推奨アクション

## Firestore ログ
`delivery_logs`
```json
{
  "report_type": "daily",
  "channel_id": "C1234567890",
  "message_ts": "1726728000.000100",
  "companies": ["company_pokemon", "company_dena"],
  "articles": 18,
  "status": "success",
  "error": null,
  "started_at": <timestamp>,
  "completed_at": <timestamp>
}
```

## エラーハンドリング
- Slack API エラー（例: `channel_not_found`, `ratelimited`） → `SLACK_API_ERROR`
- データ不足（対象期間内の記事が存在しない） → `NO_CONTENT`（成功扱いで Slack 投稿スキップ）
- LLM 再実行が必要な場合は `reprocessOnDemand` フラグで再度統合を呼び出す

## テスト観点
- simulate=true で Slack を呼ばずに JSON でフォーマット確認
- overrideChannelId 指定時に設定値を上書き
- Slack rate limit (429) を受けた場合に指数バックオフ + 最大 3 回リトライ
- PostgreSQL 等ほかの依存がないことの確認（FireStore のみ）

