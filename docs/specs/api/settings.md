---
title: 設定 API
description: 情報収集コンテキスト・Slack 配信設定・エラー通知設定の管理 API。
status: draft
---

## 概要
設定画面から情報収集コンテキストや Slack 配信先、エラー通知ユーザーを登録・取得するための API 仕様。Firestore `settings` コレクションを操作する。

## エンドポイント
| Method | Path | 説明 |
|--------|------|------|
| GET | `/settings/context` | 情報収集コンテキスト取得 |
| PUT | `/settings/context` | 情報収集コンテキスト更新 |
| GET | `/settings/slack` | Slack 配信設定取得 |
| PUT | `/settings/slack` | Slack 配信設定更新 |
| GET | `/settings/error-notification` | エラー通知先取得 |
| PUT | `/settings/error-notification` | エラー通知先更新 |

## データ構造
```json
// context document
{
  "id": "context",
  "purpose": "デジタルカード・NFTプラットフォーム競合の動向を把握",
  "priorities": ["新プラットフォーム発表", "パートナーシップ", "技術革新"],
  "focus": ["ユーザー数", "売上", "規制動向"],
  "exclusions": ["個人情報", "プライベート投稿"],
  "updated_at": <timestamp>,
  "updated_by": "user_abc"
}
```

Slack 設定:
```json
{
  "id": "slack",
  "channel_id": "C1234567890",
  "channel_name": "#competitor-news",
  "thread_strategy": "top10-main-rest-thread",
  "updated_at": <timestamp>
}
```

エラー通知設定:
```json
{
  "id": "error_notification",
  "mention_user": "@coo",
  "fallback_channel_id": "C0987654321",
  "updated_at": <timestamp>
}
```

## バリデーション
- `channel_id` は Slack API で検証（`conversations.info`）。
- `mention_user` は `@` プレフィックス必須。
- 更新時は `updated_by` を監査用に記録。

## エラーハンドリング
- Slack API エラー: `SLACK_API_ERROR`（詳細に Slack エラーコードを含める）
- Firestore 書き込みエラー: `INTERNAL_ERROR`
- 認証失敗: `UNAUTHORIZED`

## テスト観点
- 初回アクセスでデフォルト値を返す（設定未登録時）
- Slack チャンネル ID 検証失敗時のエラー
- エラー通知ユーザー未指定時のバリデーション
- Firestore 失敗時のリトライログ

