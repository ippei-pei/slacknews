---
title: 企業管理 API
description: 競合企業マスタの CRUD を提供するエンドポイント仕様。
status: draft
---

## 概要
管理画面から監視対象企業を登録・更新・無効化するための REST API。Firestore `companies` コレクションを操作する。

## 主要ユースケース
- 新規企業の追加
- 企業情報の編集（URL 追加、カテゴリ変更、無効化など）
- 企業一覧の取得（検索・フィルタ・ページネーション）
- 企業削除（論理削除フラグ）

## エンドポイント一覧
| Method | Path | 説明 |
|--------|------|------|
| GET | `/companies` | 企業一覧取得（クエリで検索/フィルタ） |
| POST | `/companies` | 企業登録 |
| GET | `/companies/{companyId}` | 企業詳細取得 |
| PATCH | `/companies/{companyId}` | 企業情報更新 |
| DELETE | `/companies/{companyId}` | 論理削除（`is_active=false`） |

## 認証
- 管理画面からのリクエストのみ。初期段階では API Key ヘッダーで制御し、将来的に Slack OAuth セッションと連動。
- `Authorization: Bearer <token>` を必須。

## リクエスト/レスポンス
### 企業一覧取得
```
GET /companies?page=1&limit=20&active_only=true&search=Pokemon
Authorization: Bearer <token>
```
レスポンス:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "company_pokemon",
        "name": "The Pokémon Company International",
        "urls": ["https://www.pokemon.com"],
        "rssUrls": ["https://www.pokemon.com/us/pokemon-news/rss/"],
        "redditUrls": [],
        "snsUrls": [],
        "category": "entertainment",
        "priority": 5,
        "country": "US",
        "isActive": true,
        "createdAt": "2025-09-18T03:00:00Z",
        "updatedAt": "2025-09-18T03:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalPages": 1,
      "totalItems": 3
    }
  },
  "meta": { "requestId": "req_123", "timestamp": "2025-09-19T00:00:00Z" }
}
```

### 企業登録
```
POST /companies
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Niantic, Inc.",
  "urls": ["https://nianticlabs.com"],
  "rssUrls": ["https://nianticlabs.com/blog/"],
  "redditUrls": ["https://reddit.com/r/pokemongo"],
  "snsAccounts": {
    "twitter": { "username": "nianticlabs", "userId": "123", "verified": true }
  },
  "category": "technology",
  "priority": 4,
  "country": "US"
}
```

成功時レスポンス:
```json
{
  "success": true,
  "data": {
    "id": "company_niantic_inc"
  }
}
```

### バリデーション
- `name` は必須、重複不可。
- `urls`, `rssUrls`, `redditUrls` は URL 形式チェック。
- `priority` は 1〜5。
- `country` は ISO 3166-1 alpha-2。

## Firestore モデル
コレクション: `companies`
```json
{
  "name": "The Pokémon Company International",
  "urls": ["https://www.pokemon.com"],
  "rss_urls": ["https://www.pokemon.com/us/pokemon-news/rss/"],
  "sns_urls": [
    {
      "platform": "twitter",
      "url": "https://twitter.com/Pokemon",
      "account_type": "official"
    }
  ],
  "priority": 5,
  "category": "entertainment",
  "country": "US",
  "is_active": true,
  "created_at": <timestamp>,
  "updated_at": <timestamp>
}
```

## エラーハンドリング
- `VALIDATION_ERROR`: 入力不備 → 422
- `NOT_FOUND`: 存在しない ID → 404
- `INTERNAL_ERROR`: Firestore 障害など → 500
- 重大なバリデーション失敗は Slack エラーメンション対象外（クライアント側で補足）

## テスト観点
- 正常系 CRUD
- `active_only=false` で無効企業も含めて取得
- 同名登録の拒否
- URL フォーマットエラー
- Firestore 失敗時のリトライ（クライアント側は 3 回まで）

