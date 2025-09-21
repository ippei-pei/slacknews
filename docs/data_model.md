# データモデル設計書

## 1. データベース概要

### 1.1 データベース選択理由
- **Firestore**: NoSQL、スケーラビリティ、リアルタイム更新、サーバーレス対応
- **代替案**: PostgreSQL (RDS) - より複雑なクエリが必要な場合

### 1.2 設計方針
- **正規化**: 適切な正規化レベルを維持
- **非正規化**: パフォーマンス重視の場合は非正規化も検討
- **スケーラビリティ**: 将来のデータ増加に対応
- **クエリ最適化**: 頻繁なアクセスパターンを考慮

## 2. エンティティ関係図

```
Companies (1) ──── (N) NewsArticles
     │
     └─── (1) ──── (N) DeliveryLogs

Configurations (1) ──── (1) DeliverySettings

NewsArticles (1) ──── (N) AnalysisResults
```

## 3. 詳細データモデル

### 3.1 Companies Collection

#### 3.1.1 スキーマ定義
```typescript
interface Company {
  // 基本情報
  id: string;                    // 自動生成UUID
  name: string;                  // 企業名（必須）
  description?: string;          // 企業説明
  
  // 情報源URL
  urls: string[];               // 企業公式URL一覧
  rss_urls: string[];           // RSS フィードURL一覧
  sns_urls: SNSUrl[];           // SNS URL一覧
  reddit_urls: string[];        // Reddit URL一覧
  news_urls: string[];          // ニュースサイトURL一覧
  
  // SNS詳細情報
  sns_accounts: {
    twitter?: {
      username: string;
      user_id: string;
      verified: boolean;
    };
    linkedin?: {
      company_id: string;
      profile_url: string;
    };
  };
  
  // 設定・状態
  is_active: boolean;           // 有効/無効フラグ
  priority: number;             // 優先度 (1-5)
  category: string;             // 業界カテゴリ
  country: string;              // 所在国
  
  // メタデータ
  created_at: Timestamp;        // 作成日時
  updated_at: Timestamp;        // 更新日時
  created_by: string;           // 作成者
  tags: string[];               // タグ一覧
}

interface SNSUrl {
  platform: 'twitter' | 'linkedin' | 'facebook' | 'instagram';
  url: string;
  account_type: 'official' | 'ceo' | 'pr' | 'other';
}
```

#### 3.1.2 サンプルデータ
```json
{
  "id": "company_apple_inc",
  "name": "Apple Inc.",
  "description": "テクノロジー企業、iPhone等の製造",
  "urls": [
    "https://www.apple.com",
    "https://investor.apple.com"
  ],
  "rss_urls": [
    "https://www.apple.com/newsroom/rss-feed.rss"
  ],
  "sns_urls": [
    {
      "platform": "twitter",
      "url": "https://twitter.com/Apple",
      "account_type": "official"
    },
    {
      "platform": "linkedin",
      "url": "https://linkedin.com/company/apple",
      "account_type": "official"
    }
  ],
  "reddit_urls": [
    "https://reddit.com/r/apple"
  ],
  "sns_accounts": {
    "twitter": {
      "username": "Apple",
      "user_id": "123456789",
      "verified": true
    },
    "linkedin": {
      "company_id": "apple-inc",
      "profile_url": "https://linkedin.com/company/apple"
    }
  },
  "is_active": true,
  "priority": 5,
  "category": "technology",
  "country": "US",
  "created_at": "2024-01-15T00:00:00Z",
  "updated_at": "2024-01-15T00:00:00Z",
  "created_by": "admin_user",
  "tags": ["tech", "smartphone", "innovation"]
}
```

### 3.2 NewsArticles Collection

#### 3.2.1 スキーマ定義
```typescript
interface NewsArticle {
  // 基本情報
  id: string;                    // 自動生成UUID
  company_id: string;            // 関連企業ID
  
  // 記事内容
  title: string;                 // 記事タイトル
  title_jp: string;              // 日本語タイトル（LLM翻訳）
  content: string;               // 本文（HTML/プレーンテキスト）
  content_jp: string;            // 日本語本文（LLM翻訳）
  excerpt: string;               // 抜粋
  excerpt_jp: string;            // 日本語抜粋（LLM翻訳）
  url: string;                   // メイン記事URL
  source_urls: SourceUrl[];      // 情報源URL一覧（統合対応）
  
  // メタデータ
  published_at: Timestamp;       // 公開日時
  collected_at: Timestamp;       // 収集日時
  language: string;              // 言語コード (en, ja, etc.)
  word_count: number;            // 文字数
  
  // 画像・メディア
  images: MediaUrl[];            // 画像URL一覧
  videos: MediaUrl[];            // 動画URL一覧
  
  // AI分析結果
  summary: string;               // 英語サマリ
  summary_jp: string;            // 日本語サマリ（LLM翻訳・200文字）
  news_summary_jp: string;       // ニュースごとの見出し＋要約（50文字前後）
  importance: number;            // 重要度 (0-100点)
  category: string;              // カテゴリ
  sentiment: number;             // 感情分析 (-1 to 1)
  keywords: string[];            // キーワード
  keywords_jp: string[];         // 日本語キーワード（LLM翻訳）
  
  // 戦略分析
  strategic_impact: number;      // 戦略的影響度 (1-5)
  business_impact: BusinessImpact; // 事業への影響
  
  // 重複・統合管理
  is_duplicate: boolean;         // 重複フラグ
  is_merged: boolean;            // 統合済みフラグ
  merged_articles: string[];     // 統合された記事ID一覧
  merge_group_id?: string;       // 統合グループID
  source_priority: number;       // 情報源優先度 (統合時の選択基準)
  quality_score: number;         // 品質スコア (0-1)
  
  // 配信管理
  delivered_daily: boolean;      // 日次配信済みフラグ
  delivered_weekly: boolean;     // 週次配信済みフラグ
  
  // メタデータ
  created_at: Timestamp;         // 作成日時
  updated_at: Timestamp;         // 更新日時
}

interface MediaUrl {
  url: string;
  alt_text?: string;
  caption?: string;
  type: 'image' | 'video';
}

interface SourceUrl {
  url: string;
  title: string;                 // ソース記事のタイトル
  source_name: string;           // 情報源名（RSS、Twitter等）
  source_type: 'rss' | 'twitter' | 'linkedin' | 'reddit' | 'website';
  priority: number;              // 情報源優先度
  collected_at: Timestamp;       // 収集日時
}

interface BusinessImpact {
  revenue: number;               // 収益への影響度 (1-5)
  market: number;                // 市場への影響度 (1-5)
  technology: number;            // 技術への影響度 (1-5)
  competition: number;           // 競合への影響度 (1-5)
}
```

#### 3.2.2 サンプルデータ
```json
{
  "id": "article_apple_iphone16_20240115",
  "company_id": "company_apple_inc",
  "title": "Apple Announces iPhone 16 with Advanced AI Features",
  "title_jp": "Apple、高度なAI機能を搭載したiPhone 16を発表",
  "content": "<p>Apple today announced the iPhone 16...</p>",
  "content_jp": "<p>Appleは本日、iPhone 16を発表しました...</p>",
  "excerpt": "Apple unveils new iPhone with enhanced AI capabilities...",
  "excerpt_jp": "Appleは、強化されたAI機能を搭載した新しいiPhoneを発表しました...",
  "url": "https://www.apple.com/newsroom/2024/01/15/iphone-16-announcement",
  "source_urls": [
    {
      "url": "https://www.apple.com/newsroom/2024/01/15/iphone-16-announcement",
      "title": "Apple Announces iPhone 16 with Advanced AI Features",
      "source_name": "Apple Newsroom",
      "source_type": "rss",
      "priority": 5,
      "collected_at": "2024-01-15T10:05:00Z"
    },
    {
      "url": "https://twitter.com/Apple/status/1234567890",
      "title": "Introducing iPhone 16 with advanced AI features",
      "source_name": "Apple Twitter",
      "source_type": "twitter",
      "priority": 4,
      "collected_at": "2024-01-15T10:10:00Z"
    }
  ],
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
  "summary": "Apple announced iPhone 16 featuring advanced AI capabilities including enhanced Siri and new camera features. The device represents a significant step forward in smartphone AI integration.",
  "summary_jp": "Appleは、強化されたSiriや新しいカメラ機能を含む高度なAI機能を搭載したiPhone 16を発表した。このデバイスは、スマートフォンのAI統合において重要な前進を表している。",
  "news_summary_jp": "【Apple】iPhone 16発表 - AI機能強化でSiriとカメラが大幅アップデート",
  "importance": 85,
  "category": "product_launch",
  "sentiment": 0.8,
  "keywords": ["iPhone", "AI", "Siri", "camera", "innovation"],
  "keywords_jp": ["iPhone", "AI", "Siri", "カメラ", "イノベーション"],
  "strategic_impact": 4,
  "business_impact": {
    "revenue": 5,
    "market": 4,
    "technology": 4,
    "competition": 5
  },
  "is_duplicate": false,
  "is_merged": true,
  "merged_articles": ["article_apple_iphone16_twitter", "article_apple_iphone16_rss"],
  "merge_group_id": "merge_group_iphone16_20240115",
  "source_priority": 5,
  "quality_score": 0.95,
  "delivered_daily": false,
  "delivered_weekly": false,
  "created_at": "2024-01-15T10:05:00Z",
  "updated_at": "2024-01-15T10:05:00Z"
}
```

### 3.3 Configurations Collection

#### 3.3.1 スキーマ定義
```typescript
interface Configuration {
  // 基本情報
  id: string;                    // 自動生成UUID
  name: string;                  // 設定名
  
  // 情報収集コンテキスト
  context: string;               // 目的・コンテキスト（フリーテキスト）
  priority_axes: string[];       // 優先順位の軸
  interests: string[];           // 関心領域
  exclude_conditions: string[];  // 除外条件
  
  // フィルタリング設定
  importance_threshold: number;  // 重要度閾値 (1-5)
  language_preference: string[]; // 言語設定
  category_filter: string[];     // カテゴリフィルタ
  
  // 配信設定
  delivery_settings: DeliverySettings;
  
  // 分析設定
  analysis_settings: AnalysisSettings;
  
  // メタデータ
  created_at: Timestamp;
  updated_at: Timestamp;
  created_by: string;
  is_active: boolean;
}

interface DeliverySettings {
  // Slack設定
  slack: {
    workspace_id: string;
    channel_id: string;
    bot_token: string;
  };
  
  // 配信スケジュール
  daily_delivery: {
    enabled: boolean;
    time: string;                // "09:00"
    timezone: string;            // "Asia/Tokyo"
  };
  
  weekly_delivery: {
    enabled: boolean;
    day: string;                 // "friday"
    time: string;                // "17:00"
    timezone: string;            // "Asia/Tokyo"
  };
  
  // 配信形式
  format: {
    include_summary: boolean;
    include_threads: boolean;
    max_articles_per_day: number;
    priority_order: boolean;
  };
}

interface AnalysisSettings {
  // AI設定
  ai_provider: 'openai' | 'anthropic' | 'google';
  model_version: string;
  
  // 分析深度
  summary_length: number;        // 文字数
  analysis_depth: 'basic' | 'detailed' | 'comprehensive';
  
  // 戦略分析
  strategy_analysis: {
    enabled: boolean;
    comparison_companies: string[];
    analysis_period: number;     // 日数
  };
}
```

### 3.4 MergeGroups Collection

#### 3.4.1 スキーマ定義
```typescript
interface MergeGroup {
  // 基本情報
  id: string;                    // 自動生成UUID
  group_name: string;            // 統合グループ名
  
  // 統合情報
  merged_articles: string[];     // 統合された記事ID一覧
  primary_article_id: string;    // メイン記事ID
  merge_reason: string;          // 統合理由
  similarity_score: number;      // 類似度スコア (0-1)
  
  // 統合結果
  merged_content: {
    title: string;               // 統合後タイトル
    title_jp: string;            // 統合後日本語タイトル
    content: string;             // 統合後本文
    content_jp: string;          // 統合後日本語本文
    excerpt: string;             // 統合後抜粋
    excerpt_jp: string;          // 統合後日本語抜粋
  };
  
  // 統合設定
  merge_settings: {
    similarity_threshold: number; // 類似度閾値
    source_priority_weights: { [key: string]: number }; // 情報源優先度重み
    merge_strategy: 'content_merge' | 'primary_select' | 'ai_merge';
  };
  
  // メタデータ
  created_at: Timestamp;         // 作成日時
  updated_at: Timestamp;         // 更新日時
  created_by: 'system' | 'manual'; // 作成方法
}
```

### 3.5 DeliveryLogs Collection

#### 3.5.1 スキーマ定義
```typescript
interface DeliveryLog {
  // 基本情報
  id: string;                    // 自動生成UUID
  type: 'daily' | 'weekly' | 'test';
  
  // 配信内容
  companies: string[];           // 対象企業ID一覧
  article_count: number;         // 配信記事数
  total_articles: number;        // 収集記事総数
  
  // 配信結果
  status: 'success' | 'failed' | 'partial';
  error_message?: string;        // エラーメッセージ
  retry_count: number;           // リトライ回数
  
  // Slack情報
  slack_message_id?: string;     // Slack メッセージID
  slack_thread_id?: string;      // Slack スレッドID
  
  // パフォーマンス
  processing_time_ms: number;    // 処理時間
  ai_processing_time_ms: number; // AI処理時間
  
  // メタデータ
  sent_at: Timestamp;            // 配信日時
  created_at: Timestamp;         // 作成日時
}
```

### 3.6 AnalysisResults Collection

#### 3.6.1 スキーマ定義
```typescript
interface AnalysisResult {
  // 基本情報
  id: string;                    // 自動生成UUID
  article_id: string;            // 関連記事ID
  company_id: string;            // 関連企業ID
  
  // 分析タイプ
  analysis_type: 'summary' | 'translation' | 'importance' | 'strategy' | 'sentiment';
  
  // 分析結果
  result: any;                   // 分析結果データ
  confidence: number;            // 信頼度 (0-1)
  
  // AI情報
  ai_provider: string;           // AI プロバイダー
  model_version: string;         // モデルバージョン
  processing_time_ms: number;    // 処理時間
  
  // メタデータ
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

## 4. インデックス設計

### 4.1 Firestoreインデックス

#### 4.1.1 複合インデックス
```javascript
// NewsArticles Collection
[
  // 企業別・日付順
  ['company_id', 'published_at', 'desc'],
  
  // 重要度・日付順
  ['importance', 'published_at', 'desc'],
  
  // カテゴリ・日付順
  ['category', 'published_at', 'desc'],
  
  // 配信状況・日付順
  ['delivered_daily', 'published_at', 'desc'],
  ['delivered_weekly', 'published_at', 'desc'],
  
  // 重複・統合管理
  ['is_duplicate', 'collected_at', 'desc'],
  ['is_merged', 'collected_at', 'desc'],
  ['merge_group_id', 'collected_at', 'desc'],
  
  // 戦略的影響・日付順
  ['strategic_impact', 'published_at', 'desc'],
  
  // 企業・重要度・日付順
  ['company_id', 'importance', 'published_at', 'desc'],
  
  // 企業・配信状況・日付順
  ['company_id', 'delivered_daily', 'published_at', 'desc'],
  
  // 統合グループ・日付順
  ['merge_group_id', 'published_at', 'desc']
]

// Companies Collection
[
  // 有効・優先度順
  ['is_active', 'priority', 'desc'],
  
  // カテゴリ・優先度順
  ['category', 'priority', 'desc'],
  
  // 作成日順
  ['created_at', 'desc']
]

// MergeGroups Collection
[
  // 作成日順
  ['created_at', 'desc'],
  
  // 類似度スコア順
  ['similarity_score', 'desc']
]

// DeliveryLogs Collection
[
  // タイプ・配信日順
  ['type', 'sent_at', 'desc'],
  
  // ステータス・配信日順
  ['status', 'sent_at', 'desc']
]
```

#### 4.1.2 単一フィールドインデックス
```javascript
// 自動的に作成されるインデックス
- published_at
- collected_at
- created_at
- updated_at
- company_id
- importance
- category
- is_duplicate
- is_merged
- merge_group_id
- delivered_daily
- delivered_weekly
```

## 5. データアクセスパターン

### 5.1 頻繁なクエリパターン

#### 5.1.1 日次情報収集
```javascript
// 有効な企業一覧取得
const companies = await db.collection('companies')
  .where('is_active', '==', true)
  .orderBy('priority', 'desc')
  .get();
```

#### 5.1.2 配信対象記事取得
```javascript
// 未配信の重要記事取得
const articles = await db.collection('news_articles')
  .where('delivered_daily', '==', false)
  .where('importance', '>=', 3)
  .orderBy('importance', 'desc')
  .orderBy('published_at', 'desc')
  .limit(20)
  .get();
```

#### 5.1.3 週次分析データ取得
```javascript
// 過去1週間の企業別記事取得
const articles = await db.collection('news_articles')
  .where('company_id', '==', companyId)
  .where('published_at', '>=', oneWeekAgo)
  .orderBy('published_at', 'desc')
  .get();
```

#### 5.1.4 重複検出・統合
```javascript
// 類似記事検索
const similarArticles = await db.collection('news_articles')
  .where('title', '>=', similarTitle)
  .where('title', '<=', similarTitle + '\uf8ff')
  .where('published_at', '>=', oneDayAgo)
  .where('is_duplicate', '==', false)
  .get();

// 統合グループ検索
const mergeGroups = await db.collection('merge_groups')
  .where('similarity_score', '>=', threshold)
  .orderBy('similarity_score', 'desc')
  .get();

// 未統合記事検索
const unmergedArticles = await db.collection('news_articles')
  .where('is_merged', '==', false)
  .where('is_duplicate', '==', false)
  .where('published_at', '>=', oneDayAgo)
  .get();
```

### 5.2 パフォーマンス最適化

#### 5.2.1 バッチ処理
```javascript
// 複数記事の一括更新
const batch = db.batch();
articles.forEach(article => {
  const ref = db.collection('news_articles').doc(article.id);
  batch.update(ref, { delivered_daily: true });
});
await batch.commit();
```

#### 5.2.2 ページネーション
```javascript
// カーソルベースページネーション
const articles = await db.collection('news_articles')
  .orderBy('published_at', 'desc')
  .startAfter(lastDoc)
  .limit(50)
  .get();
```

## 6. データ移行・バックアップ

### 6.1 バックアップ戦略

#### 6.1.1 自動バックアップ
- **頻度**: 日次
- **保持期間**: 30日間
- **場所**: Cloud Storage
- **形式**: Firestore Export

#### 6.1.2 手動バックアップ
- **重要データ**: 週次手動バックアップ
- **設定情報**: 変更時即座にバックアップ
- **復旧テスト**: 月次実行

### 6.2 データ移行

#### 6.2.1 スキーマ変更
```javascript
// マイグレーションスクリプト例
async function migrateSchema() {
  const articles = await db.collection('news_articles').get();
  const batch = db.batch();
  
  articles.docs.forEach(doc => {
    const data = doc.data();
    if (!data.strategic_impact) {
      batch.update(doc.ref, {
        strategic_impact: calculateStrategicImpact(data),
        updated_at: FieldValue.serverTimestamp()
      });
    }
  });
  
  await batch.commit();
}
```

## 7. セキュリティ・プライバシー

### 7.1 データ暗号化

#### 7.1.1 保存時暗号化
- **Firestore**: 自動暗号化
- **機密データ**: 追加の暗号化（API Key等）

#### 7.1.2 転送時暗号化
- **HTTPS**: 全通信の暗号化
- **API通信**: TLS 1.3

### 7.2 アクセス制御

#### 7.2.1 Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 企業情報のアクセス制御
    match /companies/{companyId} {
      allow read, write: if request.auth != null && 
        request.auth.token.admin == true;
    }
    
    // 記事情報のアクセス制御
    match /news_articles/{articleId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        request.auth.token.admin == true;
    }
  }
}
```

### 7.3 データ保持・削除

#### 7.3.1 データ保持ポリシー
- **記事データ**: 1年間保持
- **分析結果**: 6ヶ月間保持
- **配信ログ**: 3ヶ月間保持
- **設定情報**: 無期限保持

#### 7.3.2 自動削除
```javascript
// 古いデータの自動削除
async function cleanupOldData() {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  const oldArticles = await db.collection('news_articles')
    .where('published_at', '<', oneYearAgo)
    .get();
  
  const batch = db.batch();
  oldArticles.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
}
```

---

**作成日**: 2024年1月15日  
**バージョン**: 1.0  
**更新履歴**: 初版作成
