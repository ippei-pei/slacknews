# API仕様書・Slack連携仕様

## 1. API概要

### 1.1 基本情報
- **Base URL**: `https://api.slacknews.com/v1`
- **認証方式**: Bearer Token (JWT)
- **データ形式**: JSON
- **文字エンコーディング**: UTF-8

### 1.2 共通レスポンス形式
```json
{
  "success": boolean,
  "data": any,
  "error": {
    "code": string,
    "message": string,
    "details": any
  },
  "meta": {
    "timestamp": string,
    "request_id": string,
    "version": string
  }
}
```

### 1.3 エラーコード
```javascript
const ERROR_CODES = {
  // 認証・認可
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // リクエスト
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  
  // システム
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // 外部API
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  SLACK_API_ERROR: 'SLACK_API_ERROR',
  AI_API_ERROR: 'AI_API_ERROR'
};
```

## 2. 企業管理API

### 2.1 企業一覧取得

#### 2.1.1 エンドポイント
```
GET /companies
```

#### 2.1.2 リクエストパラメータ
```javascript
{
  // クエリパラメータ
  page?: number;          // ページ番号 (デフォルト: 1)
  limit?: number;         // 1ページあたりの件数 (デフォルト: 20, 最大: 100)
  active_only?: boolean;  // 有効な企業のみ (デフォルト: true)
  category?: string;      // カテゴリフィルタ
  search?: string;        // 検索キーワード
  sort_by?: string;       // ソート項目 (name, priority, created_at)
  sort_order?: string;    // ソート順序 (asc, desc)
}
```

#### 2.1.3 レスポンス例
```json
{
  "success": true,
  "data": {
    "companies": [
      {
        "id": "company_apple_inc",
        "name": "Apple Inc.",
        "description": "テクノロジー企業、iPhone等の製造",
        "urls": ["https://www.apple.com"],
        "rss_urls": ["https://www.apple.com/newsroom/rss-feed.rss"],
        "sns_urls": [
          {
            "platform": "twitter",
            "url": "https://twitter.com/Apple",
            "account_type": "official"
          }
        ],
        "is_active": true,
        "priority": 5,
        "category": "technology",
        "country": "US",
        "created_at": "2024-01-15T00:00:00Z",
        "updated_at": "2024-01-15T00:00:00Z",
        "tags": ["tech", "smartphone"]
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 5,
      "total_items": 87,
      "items_per_page": 20
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:00:00Z",
    "request_id": "req_123456789",
    "version": "1.0"
  }
}
```

### 2.2 企業登録

#### 2.2.1 エンドポイント
```
POST /companies
```

#### 2.2.2 リクエストボディ
```json
{
  "name": "Apple Inc.",
  "description": "テクノロジー企業、iPhone等の製造",
  "urls": ["https://www.apple.com"],
  "rss_urls": ["https://www.apple.com/newsroom/rss-feed.rss"],
  "sns_urls": [
    {
      "platform": "twitter",
      "url": "https://twitter.com/Apple",
      "account_type": "official"
    }
  ],
  "reddit_urls": ["https://reddit.com/r/apple"],
  "priority": 5,
  "category": "technology",
  "country": "US",
  "tags": ["tech", "smartphone"]
}
```

#### 2.2.3 レスポンス例
```json
{
  "success": true,
  "data": {
    "id": "company_apple_inc",
    "name": "Apple Inc.",
    "created_at": "2024-01-15T10:00:00Z",
    "message": "企業が正常に登録されました"
  }
}
```

### 2.3 企業更新

#### 2.3.1 エンドポイント
```
PUT /companies/{company_id}
```

#### 2.3.2 リクエストボディ
```json
{
  "name": "Apple Inc.",
  "description": "更新された説明",
  "priority": 4,
  "is_active": true
}
```

### 2.4 企業削除

#### 2.4.1 エンドポイント
```
DELETE /companies/{company_id}
```

#### 2.4.2 レスポンス例
```json
{
  "success": true,
  "data": {
    "message": "企業が削除されました"
  }
}
```

## 3. ニュース管理API

### 3.1 ニュース一覧取得

#### 3.1.1 エンドポイント
```
GET /news
```

#### 3.1.2 リクエストパラメータ
```javascript
{
  // フィルタリング
  company_id?: string;           // 企業ID
  category?: string;             // カテゴリ
  importance_min?: number;       // 重要度最小値 (0-100)
  date_from?: string;            // 開始日 (ISO 8601)
  date_to?: string;              // 終了日 (ISO 8601)
  language?: string;             // 言語コード
  delivered?: boolean;           // 配信済みフラグ
  is_merged?: boolean;           // 統合済みフラグ
  merge_group_id?: string;       // 統合グループID
  
  // ページネーション
  page?: number;
  limit?: number;
  
  // ソート
  sort_by?: string;              // published_at, importance, created_at
  sort_order?: string;           // asc, desc
}
```

#### 3.1.3 レスポンス例
```json
{
  "success": true,
  "data": {
    "articles": [
      {
        "id": "article_apple_iphone16",
        "company_id": "company_apple_inc",
        "company_name": "Apple Inc.",
        "title": "Apple Announces iPhone 16 with Advanced AI Features",
        "title_jp": "Apple、高度なAI機能を搭載したiPhone 16を発表",
        "excerpt": "Apple unveils new iPhone with enhanced AI capabilities...",
        "excerpt_jp": "Appleは、強化されたAI機能を搭載した新しいiPhoneを発表しました...",
        "url": "https://www.apple.com/newsroom/2024/01/15/iphone-16",
        "source_urls": [
          {
            "url": "https://www.apple.com/newsroom/2024/01/15/iphone-16",
            "title": "Apple Announces iPhone 16 with Advanced AI Features",
            "source_name": "Apple Newsroom",
            "source_type": "rss",
            "priority": 5
          }
        ],
        "published_at": "2024-01-15T10:00:00Z",
        "collected_at": "2024-01-15T10:05:00Z",
        "summary_jp": "Appleは、強化されたSiriや新しいカメラ機能を含む高度なAI機能を搭載したiPhone 16を発表した。",
        "news_summary_jp": "【Apple】iPhone 16発表 - AI機能強化でSiriとカメラが大幅アップデート",
    "news_summary_jp": "【Apple】iPhone 16発表 - AI機能強化でSiriとカメラが大幅アップデート",
        "news_summary_jp": "【Apple】iPhone 16発表 - AI機能強化でSiriとカメラが大幅アップデート",
        "importance": 85,
        "category": "product_launch",
        "sentiment": 0.8,
        "strategic_impact": 4,
        "is_merged": true,
        "merge_group_id": "merge_group_iphone16_20240115",
        "delivered_daily": false,
        "delivered_weekly": false
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 10,
      "total_items": 195,
      "items_per_page": 20
    }
  }
}
```

### 3.2 ニュース詳細取得

#### 3.2.1 エンドポイント
```
GET /news/{article_id}
```

#### 3.2.2 レスポンス例
```json
{
  "success": true,
  "data": {
    "id": "article_apple_iphone16",
    "company_id": "company_apple_inc",
    "company_name": "Apple Inc.",
    "title": "Apple Announces iPhone 16 with Advanced AI Features",
    "content": "<p>Apple today announced the iPhone 16...</p>",
    "excerpt": "Apple unveils new iPhone with enhanced AI capabilities...",
    "url": "https://www.apple.com/newsroom/2024/01/15/iphone-16",
    "source_url": "https://www.apple.com/newsroom/rss-feed.rss",
    "published_at": "2024-01-15T10:00:00Z",
    "collected_at": "2024-01-15T10:05:00Z",
    "language": "en",
    "word_count": 850,
    "images": [
      {
        "url": "https://www.apple.com/newsroom/images/iphone16.jpg",
        "alt_text": "iPhone 16 product image",
        "type": "image"
      }
    ],
    "summary": "Apple announced iPhone 16 featuring advanced AI capabilities...",
    "summary_jp": "Appleは、強化されたSiriや新しいカメラ機能を含む高度なAI機能を搭載したiPhone 16を発表した。",
    "news_summary_jp": "【Apple】iPhone 16発表 - AI機能強化でSiriとカメラが大幅アップデート",
    "importance": 85,
    "category": "product_launch",
    "sentiment": 0.8,
    "keywords": ["iPhone", "AI", "Siri", "camera"],
    "strategic_impact": 4,
    "business_impact": {
      "revenue": 5,
      "market": 4,
      "technology": 4,
      "competition": 5
    },
    "is_duplicate": false,
    "quality_score": 0.95,
    "delivered_daily": false,
    "delivered_weekly": false,
    "created_at": "2024-01-15T10:05:00Z",
    "updated_at": "2024-01-15T10:05:00Z"
  }
}
```

### 3.3 情報収集実行

#### 3.3.1 エンドポイント
```
POST /news/collect
```

#### 3.3.2 リクエストボディ
```json
{
  "company_ids": ["company_apple_inc", "company_google_inc"],
  "force_collect": false,
  "async": true
}
```

#### 3.3.3 レスポンス例
```json
{
  "success": true,
  "data": {
    "job_id": "collect_job_123456789",
    "status": "started",
    "estimated_duration": "5-10 minutes",
    "companies": ["company_apple_inc", "company_google_inc"]
  }
}
```

### 3.4 LLM自動処理

#### 3.4.1 LLM自動処理実行

##### 3.4.1.1 エンドポイント
```
POST /news/llm-auto-process
```

##### 3.4.1.2 リクエストボディ
```json
{
  "company_ids": ["company_apple_inc"],
  "date_range": {
    "from": "2024-01-01",
    "to": "2024-01-31"
  }
}
```

##### 3.4.1.3 レスポンス例
```json
{
  "success": true,
  "data": {
    "job_id": "llm_auto_process_123456789",
    "status": "started",
    "estimated_duration": "10-15 minutes",
    "target_articles": 150,
    "auto_processing_steps": [
      "LLM自動重複検出",
      "LLM自動記事統合",
      "LLM翻訳",
      "LLMサマリ生成",
      "LLM重要度判定",
      "LLMカテゴリ分類"
    ]
  }
}
```


#### 3.4.2 統合グループ一覧取得

##### 3.4.2.1 エンドポイント
```
GET /news/merge-groups
```

##### 3.4.2.2 リクエストパラメータ
```javascript
{
  page?: number;
  limit?: number;
  company_id?: string;
  date_from?: string;
  date_to?: string;
  similarity_min?: number;
}
```

##### 3.4.2.3 レスポンス例
```json
{
  "success": true,
  "data": {
    "merge_groups": [
      {
        "id": "merge_group_iphone16_20240115",
        "group_name": "iPhone 16 Announcement",
        "merged_articles": ["article_1", "article_2", "article_3"],
        "primary_article_id": "article_merged_123456789",
        "similarity_score": 0.92,
        "merge_reason": "High similarity in title and content",
        "created_at": "2024-01-15T10:30:00Z",
        "created_by": "system"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 5,
      "total_items": 23,
      "items_per_page": 20
    }
  }
}
```

### 3.5 収集ジョブ状態確認

#### 3.5.1 エンドポイント
```
GET /news/collect/{job_id}/status
```

#### 3.5.2 レスポンス例
```json
{
  "success": true,
  "data": {
    "job_id": "collect_job_123456789",
    "status": "completed",
    "progress": {
      "total_companies": 2,
      "completed_companies": 2,
      "total_articles": 15,
      "new_articles": 8,
      "duplicate_articles": 7
    },
    "started_at": "2024-01-15T10:00:00Z",
    "completed_at": "2024-01-15T10:05:30Z",
    "duration_seconds": 330
  }
}
```

## 4. AI分析API

### 4.1 サマリ生成

#### 4.1.1 エンドポイント
```
POST /analyze/summary
```

#### 4.1.2 リクエストボディ
```json
{
  "article_id": "article_apple_iphone16",
  "language": "ja",
  "max_length": 200,
  "include_keywords": true,
  "translate_content": true
}
```

#### 4.1.3 レスポンス例
```json
{
  "success": true,
  "data": {
    "article_id": "article_apple_iphone16",
    "summary": "Apple announced iPhone 16 featuring advanced AI capabilities including enhanced Siri and new camera features. The device represents a significant step forward in smartphone AI integration.",
    "summary_jp": "Appleは、強化されたSiriや新しいカメラ機能を含む高度なAI機能を搭載したiPhone 16を発表した。このデバイスは、スマートフォンのAI統合において重要な前進を表している。",
    "keywords": ["iPhone", "AI", "Siri", "camera", "innovation"],
    "keywords_jp": ["iPhone", "AI", "Siri", "カメラ", "イノベーション"],
    "translated_content": {
      "title_jp": "Apple、高度なAI機能を搭載したiPhone 16を発表",
      "content_jp": "Appleは本日、強化されたSiriや新しいカメラ機能を含む高度なAI機能を搭載したiPhone 16を発表しました...",
      "excerpt_jp": "Appleは、強化されたAI機能を搭載した新しいiPhoneを発表しました..."
    },
    "processing_time_ms": 3500,
    "ai_provider": "openai",
    "model_version": "gpt-4-turbo"
  }
}
```

### 4.2 重要度判定

#### 4.2.1 エンドポイント
```
POST /analyze/importance
```

#### 4.2.2 リクエストボディ
```json
{
  "article_id": "article_apple_iphone16",
  "context": "テクノロジー業界の競合分析",
  "priority_axes": ["技術革新", "市場影響", "競合優位性"]
}
```

#### 4.2.3 レスポンス例
```json
{
  "success": true,
  "data": {
    "article_id": "article_apple_iphone16",
    "importance": 85,
    "confidence": 0.85,
    "reasoning": "新製品発表であり、AI技術の進歩を示しているため高重要度",
    "factors": {
      "technical_innovation": 5,
      "market_impact": 4,
      "competitive_advantage": 4
    },
    "processing_time_ms": 1800
  }
}
```

### 4.3 LLM自動統合処理

#### 4.3.1 エンドポイント
```
POST /analyze/llm-auto-comprehensive
```

#### 4.3.2 リクエストボディ
```json
{
  "article_ids": ["article_apple_iphone16"]
}
```

#### 4.3.3 レスポンス例
```json
{
  "success": true,
  "data": {
    "article_id": "article_apple_iphone16",
    "auto_llm_results": {
      "duplicate_analysis": {
        "is_duplicate": false,
        "similar_articles": [],
        "confidence": 0.95
      },
      "translations": {
        "title_jp": "Apple、高度なAI機能を搭載したiPhone 16を発表",
        "content_jp": "Appleは本日、強化されたSiriや新しいカメラ機能を含む高度なAI機能を搭載したiPhone 16を発表しました。",
        "summary_jp": "Appleは、強化されたSiriや新しいカメラ機能を含む高度なAI機能を搭載したiPhone 16を発表した。",
        "news_summary_jp": "【Apple】iPhone 16発表 - AI機能強化でSiriとカメラが大幅アップデート"
      },
      "analysis": {
        "importance": 85,
        "category": "product_launch",
        "keywords_jp": ["iPhone", "AI", "Siri", "カメラ", "イノベーション"]
      }
    },
    "processing_time_ms": 5500,
    "ai_provider": "openai",
    "model_version": "gpt-4-turbo",
    "auto_processing": true
  }
}
```

### 4.4 戦略分析

#### 4.4.1 エンドポイント
```
POST /analyze/strategy
```

#### 4.4.2 リクエストボディ
```json
{
  "company_ids": ["company_apple_inc", "company_google_inc"],
  "analysis_period_days": 7,
  "include_comparison": true
}
```

#### 4.4.3 レスポンス例
```json
{
  "success": true,
  "data": {
    "analysis_id": "strategy_analysis_123",
    "companies": [
      {
        "company_id": "company_apple_inc",
        "company_name": "Apple Inc.",
        "basic_strategy": "ハイエンド製品による差別化戦略",
        "strategy_changes": [
          "AI機能強化への重点シフト",
          "カメラ技術の向上投資"
        ],
        "weekly_summary": "iPhone 16発表により、AI機能強化を明確に示した",
        "strategic_impact": 4
      }
    ],
    "comparison": {
      "common_trends": ["AI技術への投資増加", "ユーザー体験重視"],
      "differentiation": [
        "Apple: ハードウェア統合型AI",
        "Google: クラウドベースAI"
      ]
    },
    "recommendations": [
      "自社のAI戦略の明確化が必要",
      "競合の技術動向を継続監視"
    ],
    "processing_time_ms": 12000
  }
}
```

## 5. Slack連携API

### 5.1 日次レポート配信

#### 5.1.1 エンドポイント
```
POST /slack/daily
```

#### 5.1.2 リクエストボディ
```json
{
  "channel_id": "C1234567890",
  "date": "2024-01-15",
  "companies": ["company_apple_inc"],
  "importance_threshold": 3,
  "max_articles": 10
}
```

#### 5.1.3 レスポンス例
```json
{
  "success": true,
  "data": {
    "message_id": "1234567890.123456",
    "thread_id": "1234567890.123456",
  "articles_count": 8,
  "companies_count": 1,
  "merged_articles_count": 3,
  "delivered_at": "2024-01-15T09:00:00Z"
  }
}
```

### 5.2 週次レポート配信

#### 5.2.1 エンドポイント
```
POST /slack/weekly
```

#### 5.2.2 リクエストボディ
```json
{
  "channel_id": "C1234567890",
  "week_start": "2024-01-08",
  "week_end": "2024-01-14",
  "include_comparison": true
}
```

#### 5.2.3 レスポンス例
```json
{
  "success": true,
  "data": {
    "message_id": "1234567890.123456",
    "report_url": "https://reports.slacknews.com/weekly/2024-01-08",
    "companies_analyzed": 5,
    "articles_analyzed": 45,
    "delivered_at": "2024-01-15T17:00:00Z"
  }
}
```

### 5.3 日次配信

#### 5.3.1 エンドポイント
```
POST /slack/deliver-daily
```

#### 5.3.2 リクエストボディ
```json
{
  "date": "2024-01-15",
  "top_count": 10,
  "channel_id": "C1234567890"
}
```

#### 5.3.3 レスポンス例
```json
{
  "success": true,
  "data": {
    "message_id": "1234567890.123456",
    "articles_delivered": 10,
    "articles_total": 45,
    "delivered_at": "2024-01-15T09:00:00Z",
    "daily_summary": "本日は主要企業から45件のニュースを収集しました。",
    "top_articles": [
      {
        "importance": 92,
        "news_summary_jp": "【Apple】iPhone 16発表 - AI機能強化でSiriとカメラが大幅アップデート",
        "company_name": "Apple Inc."
      }
    ]
  }
}
```

#### 5.3.4 配信形式例
```
【本文投稿】
📊 競合情報レポート (45件)

1. <https://apple.com/newsroom/iphone-16|【Apple】iPhone 16発表 - AI機能強化でSiriとカメラが大幅アップデート>
2. <https://google.com/blog/ai-strategy|【Google】新AI戦略発表 - 検索エンジンの大幅アップデート>
3. <https://microsoft.com/azure/features|【Microsoft】Azure新機能追加 - 企業向けAIツール拡充>
4. <https://aws.amazon.com/new-services|【Amazon】AWS新サービス発表 - 機械学習プラットフォーム強化>
5. <https://meta.com/vr-news|【Meta】VR/AR戦略変更 - メタバース事業方針転換>
6. <https://tesla.com/autopilot-update|【Tesla】自動運転技術向上 - レベル4実現に向けた開発加速>
7. <https://netflix.com/content-strategy|【Netflix】コンテンツ戦略変更 - アジア市場重視の方針>
8. <https://uber.com/delivery-expansion|【Uber】新サービス展開 - 配送事業の拡大計画>
9. <https://airbnb.com/long-term-stays|【Airbnb】事業戦略調整 - 長期滞在プラットフォーム強化>
10. <https://spotify.com/voice-ai|【Spotify】音声AI機能追加 - パーソナライズ機能拡充>

【スレッド投稿】
11. <https://twitter.com/community-features|【Twitter】新機能追加 - コミュニティ機能の拡張>
12. <https://linkedin.com/professional-tools|【LinkedIn】プロフェッショナル向け新ツール発表>
...
45. <https://example.com/other-news|【その他】その他のニュース>
```

### 5.4 テスト配信

#### 5.4.1 エンドポイント
```
POST /slack/test
```

#### 5.4.2 リクエストボディ
```json
{
  "channel_id": "C1234567890",
  "test_type": "daily",
  "sample_data": true
}
```

## 6. 設定管理API

### 6.1 設定取得

#### 6.1.1 エンドポイント
```
GET /configurations
```

#### 6.1.2 レスポンス例
```json
{
  "success": true,
  "data": {
    "id": "config_main",
    "name": "メイン設定",
    "context": "テクノロジー業界の競合分析",
    "priority_axes": ["技術革新", "市場影響", "競合優位性"],
    "interests": ["AI", "スマートフォン", "クラウド"],
    "exclude_conditions": ["人事異動", "株価情報"],
    "importance_threshold": 3,
    "language_preference": ["ja", "en"],
    "category_filter": ["product_launch", "technology", "business"],
    "delivery_settings": {
      "slack": {
        "workspace_id": "T1234567890",
        "channel_id": "C1234567890"
      },
      "daily_delivery": {
        "enabled": true,
        "time": "09:00",
        "timezone": "Asia/Tokyo"
      },
      "weekly_delivery": {
        "enabled": true,
        "day": "friday",
        "time": "17:00",
        "timezone": "Asia/Tokyo"
      }
    },
    "analysis_settings": {
      "ai_provider": "openai",
      "model_version": "gpt-4-turbo",
      "summary_length": 200,
      "analysis_depth": "detailed"
    }
  }
}
```

### 6.2 設定更新

#### 6.2.1 エンドポイント
```
PUT /configurations/{config_id}
```

#### 6.2.2 リクエストボディ
```json
{
  "context": "更新されたコンテキスト",
  "importance_threshold": 4,
  "delivery_settings": {
    "daily_delivery": {
      "time": "08:00"
    }
  }
}
```

## 7. 統計・レポートAPI

### 7.1 統計情報取得

#### 7.1.1 エンドポイント
```
GET /statistics
```

#### 7.1.2 リクエストパラメータ
```javascript
{
  period?: string;        // daily, weekly, monthly
  date_from?: string;     // ISO 8601
  date_to?: string;       // ISO 8601
  company_id?: string;    // 企業ID
}
```

#### 7.1.3 レスポンス例
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2024-01-01",
      "end": "2024-01-31"
    },
    "collection_stats": {
      "total_articles": 1250,
      "new_articles": 890,
      "duplicate_articles": 360,
      "collection_success_rate": 0.96
    },
    "analysis_stats": {
      "articles_analyzed": 890,
      "average_importance": 3.2,
      "high_importance_articles": 156,
      "analysis_success_rate": 0.99
    },
    "delivery_stats": {
      "daily_reports_sent": 31,
      "weekly_reports_sent": 4,
      "delivery_success_rate": 0.98
    },
    "company_stats": [
      {
        "company_id": "company_apple_inc",
        "company_name": "Apple Inc.",
        "articles_count": 45,
        "avg_importance": 3.8,
        "high_importance_count": 12
      }
    ]
  }
}
```

## 8. エラーハンドリング

### 8.1 バリデーションエラー

#### 8.1.1 レスポンス例
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "リクエストの検証に失敗しました",
    "details": {
      "field": "name",
      "message": "企業名は必須です"
    }
  }
}
```

### 8.2 外部APIエラー

#### 8.2.1 レスポンス例
```json
{
  "success": false,
  "error": {
    "code": "SLACK_API_ERROR",
    "message": "Slack API呼び出しに失敗しました",
    "details": {
      "slack_error": "channel_not_found",
      "slack_message": "指定されたチャンネルが見つかりません"
    }
  }
}
```

## 9. レート制限

### 9.1 制限値（小規模運用）
```javascript
const RATE_LIMITS = {
  // API呼び出し制限
  'GET /companies': '50/hour',
  'POST /companies': '5/hour',
  'GET /news': '100/hour',
  'POST /news/collect': '3/hour',
  'POST /analyze/*': '20/hour',
  'POST /slack/*': '5/hour',
  
  // 小規模運用制限
  'companies_limit': 10,
  'daily_articles_limit': 500,
  'users_limit': 10
};
```

### 9.2 レート制限ヘッダー
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1642233600
```

## 10. Webhook仕様

### 10.1 配信完了Webhook

#### 10.1.1 エンドポイント設定
```
POST /webhooks/delivery-completed
```

#### 10.1.2 ペイロード例
```json
{
  "event_type": "delivery.completed",
  "timestamp": "2024-01-15T09:00:00Z",
  "data": {
    "delivery_type": "daily",
    "message_id": "1234567890.123456",
    "channel_id": "C1234567890",
    "articles_count": 8,
    "companies_count": 3,
    "success": true
  }
}
```

### 10.2 エラー通知Webhook

#### 10.2.1 ペイロード例
```json
{
  "event_type": "error.occurred",
  "timestamp": "2024-01-15T09:00:00Z",
  "data": {
    "error_type": "collection_failed",
    "error_code": "EXTERNAL_API_ERROR",
    "error_message": "RSS feed is not accessible",
    "affected_companies": ["company_apple_inc"],
    "retry_count": 3
  }
}
```

---

**作成日**: 2024年1月15日  
**バージョン**: 1.0  
**更新履歴**: 初版作成
