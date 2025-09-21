# システムアーキテクチャ設計書

## 1. システム全体構成

### 1.1 アーキテクチャ概要

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   情報源        │    │   収集層        │    │   処理層        │
│                 │    │                 │    │                 │
│ • RSS Feed      │───▶│ • Cloud         │───▶│ • AI Analysis   │
│ • 企業公式サイト│    │   Functions     │    │ • GPT-4 API     │
│ • Reddit        │    │ • Scheduler     │    │ • Translation   │
│ • News Sites    │    │ • Queue         │    │ • Summarization │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   配信層        │    │   データ層      │    │   監視層        │
│                 │    │                 │    │                 │
│ • Slack API     │◀───│ • Firestore     │◀───│ • Cloud Logging │
│ • Message       │    │ • Cloud Storage │    │ • Alerts        │
│ • Thread        │    │ • Cache         │    │ • Metrics       │
│ • Notification  │    │ • Backup        │    │ • SecretManager │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 1.2 コンポーネント詳細

#### 1.2.1 情報収集層
- **Google Cloud Functions**
  - RSS Feed Parser
  - 企業公式サイト Web Scraper
  - Reddit API Client
  - Content Preprocessor

#### 1.2.2 LLM自動処理層
- **GPT-4自動統合エンジン**
  - システム側で定義されたプロンプトによる自動処理
  - LLM重複検出（デフォルト設定）
  - LLM記事統合（自動ルール適用）
  - LLM翻訳エンジン
  - LLMサマリ生成
  - LLM重要度判定
  - LLMカテゴリ分類
  - LLM戦略分析

#### 1.2.3 データストレージ層
- **Firestore**
  - 企業情報 (companies)
  - ニュース記事 (統合済み)
  - 統合グループ情報
  - 設定情報
  - 配信ログ
- **Google Cloud Storage**
  - 画像・動画ファイル
  - バックアップデータ
  - 一時ファイル

#### 1.2.4 配信層
- **Slack Integration**
  - Slack API
  - Webhook
  - Message Formatter
  - Thread Manager

## 2. データフロー

### 2.1 日次情報収集フロー

```
1. Scheduler Trigger (毎日 6:00 JST)
   ↓
2. Company List Retrieval
   ↓
3. Parallel Information Collection
   ├── RSS Feed Processing
   ├── 企業公式サイト Web Scraping
   └── Reddit API Calls
   ↓
4. Content Preprocessing
   ├── Text Extraction
   ├── Language Detection
   └── Metadata Enrichment
   ↓
5. LLM Processing Queue
   ├── LLM Duplicate Detection
   ├── LLM Article Merging
   ├── LLM Translation (JP)
   ├── LLM Summary Generation (JP)
   ├── LLM Importance Scoring (100点満点)
   └── LLM Category Classification
   ↓
7. Database Storage (統合記事 + 参考リンク)
   ↓
8. Slack Delivery Preparation (日本語コンテンツ)
   ├── 件数の端的表示生成
   ├── ニュースごとの見出し＋要約生成（50文字前後）
   ├── 重要度100点満点評価・上位10個選定
   └── 統合ソース表示準備
   ↓
9. Message Formatting & Delivery
   ├── メインメッセージ: 件数表示 + 重要度上位10件（リンク付きテキスト）
   └── スレッド: その他のニュース（リンク付きテキスト）
```

### 2.2 LLM重複排除・統合処理フロー

```
1. Article Collection Completion
   ↓
2. LLM Duplicate Detection
   ├── LLMによる類似記事の自動検出
   ├── コンテキスト理解による高精度判定
   └── 重複グループの形成
   ↓
3. LLM Article Merging
   ├── LLMによる最適な記事選択
   ├── 複数ソースの内容統合
   └── 参考リンクの整理
   ↓
4. LLM Content Processing
   ├── LLM翻訳（日本語統一）
   ├── LLMサマリ生成
   ├── LLM重要度判定
   └── LLMカテゴリ分類
   ↓
5. Unified Article Creation
   ├── LLM統合コンテンツ生成
   ├── ソースURL集約
   └── メタデータ統合
   ↓
6. Database Update
   ├── 統合記事の保存
   └── 統合グループの記録
```

### 2.3 週次分析フロー

```
1. Weekly Scheduler (毎週金曜 17:00 JST)
   ↓
2. Weekly Data Aggregation
   ├── Company-wise News Collection
   ├── Strategy Change Detection
   └── Competitive Analysis
   ↓
3. AI Strategy Analysis
   ├── Strategy Pattern Recognition
   ├── Change Point Detection
   └── Impact Assessment
   ↓
4. Report Generation
   ├── Company Strategy Summary
   ├── Competitive Comparison
   └── Strategic Recommendations
   ↓
5. Slack Weekly Report Delivery
```

## 3. 技術スタック詳細

### 3.1 バックエンド技術

#### 3.1.1 サーバーレス関数
- **Runtime**: Node.js 18.x
- **Framework**: Express.js
- **Deployment**: AWS Lambda / Google Cloud Functions
- **Configuration**: Serverless Framework / Firebase CLI
- **スケール**: 小規模運用（10社程度）

#### 3.1.2 スケジューリング
- **AWS**: EventBridge (CloudWatch Events)
- **GCP**: Cloud Scheduler
- **Frequency**: 日次・週次

### 3.2 データベース

#### 3.2.1 Firestore設計
```javascript
// Companies Collection
companies/{companyId} {
  name: string,
  urls: string[],
  rss_urls: string[],
  sns_urls: string[],
  reddit_urls: string[],
  created_at: timestamp,
  updated_at: timestamp,
  is_active: boolean
}

// News Articles Collection
news_articles/{articleId} {
  company_id: string,
  title: string,
  content: string,
  url: string,
  published_at: timestamp,
  collected_at: timestamp,
  summary: string,
  summary_jp: string,
  importance: number, // 1-5
  category: string,
  is_duplicate: boolean,
  language: string
}

// Configurations Collection
configurations/{configId} {
  context: string,
  priority_axes: string,
  interests: string[],
  exclude_conditions: string[],
  delivery_settings: {
    channel: string,
    time: string,
    frequency: string
  }
}

// Delivery Logs Collection
delivery_logs/{logId} {
  type: string, // 'daily' | 'weekly'
  sent_at: timestamp,
  companies: string[],
  article_count: number,
  status: string // 'success' | 'failed'
}
```

#### 3.2.2 インデックス設計
```javascript
// Composite Indexes
news_articles: [
  ['company_id', 'published_at', 'desc'],
  ['importance', 'published_at', 'desc'],
  ['category', 'published_at', 'desc'],
  ['is_duplicate', 'collected_at', 'desc']
]
```

### 3.3 外部API連携

#### 3.3.1 LLM自動統合API
- **OpenAI GPT-4 API**
  - 用途: 自動重複検出、自動記事統合、翻訳、サマリ生成、戦略分析、重要度判定
  - Rate Limit: 10,000 tokens/minute（小規模運用で十分）
  - Cost Optimization: バッチ処理、キャッシュ活用
  - システムプロンプト: コード側で定義された最適化されたプロンプト
  - 統合処理: 複数タスクを一度のAPI呼び出しで実行
  - 想定使用量: 1日500件程度の処理

#### 3.3.2 情報収集API
- **RSS Parser（Phase 1）**
  - 用途: RSS フィード解析
  - コスト: 無料・安定
  - Library: node-rss-parser

- **Web Scraping（Phase 1）**
  - 用途: 企業公式サイト監視
  - コスト: 無料・安定
  - Library: puppeteer, cheerio

- **Reddit API（Phase 2）**
  - 用途: 関連スレッド収集
  - コスト: 無料プランで基本的な取得可能
  - Rate Limit: 60 requests/minute

- **Twitter API v2（Phase 3・後回し）**
  - 用途: 企業アカウント監視
  - コスト: Basicプラン月額$100
  - 現状: 後回し

- **LinkedIn API（Phase 4・後回し）**
  - 用途: 企業投稿監視
  - コスト: 料金未確定
  - 現状: 後回し


## 4. セキュリティ設計

### 4.1 認証・認可

#### 4.1.1 Slack OAuth認証
```javascript
// OAuth Flow
1. Slack App Installation
2. OAuth Token Generation
3. Token Storage (Encrypted)
4. API Request Authentication
```

#### 4.1.2 API セキュリティ
- **API Key Management**: Google Secret Manager
- **Rate Limiting**: Cloud Endpoints
- **CORS Configuration**: 適切なオリジン設定
- **権限管理**: 管理者権限とユーザー権限の切り分けなし

### 4.2 データ暗号化

#### 4.2.1 保存時暗号化
- **Firestore**: 自動暗号化
- **Cloud Storage**: サーバーサイド暗号化

#### 4.2.2 転送時暗号化
- **HTTPS**: 全通信の暗号化

### 4.3 データ保持期間
- **記事データ**: 1ヶ月間保持
- **週次レポート**: 半年間保持

## 5. 監視・ログ設計

### 5.1 監視指標

#### 5.1.1 システム監視
- **可用性**: 99.5%以上
- **レスポンス時間**: 平均 < 5秒
- **エラー率**: < 1%
- **スループット**: 100件/時間（小規模運用）

#### 5.1.2 ビジネス監視
- **情報収集成功率**: > 95%
- **配信成功率**: > 99%
- **重複除去率**: > 90%
- **処理件数**: 1日100件程度（上限500件）

### 5.2 ログ設計

#### 5.2.1 アプリケーションログ
```javascript
// Log Levels
- ERROR: システムエラー、API失敗
- WARN:  警告、リトライ実行
- INFO:  正常処理、重要なイベント
- DEBUG: デバッグ情報、詳細ログ
```

#### 5.2.2 構造化ログ
```javascript
{
  timestamp: "2024-01-15T09:00:00Z",
  level: "INFO",
  service: "news-collector",
  operation: "collect_news",
  company_id: "company_123",
  article_count: 15,
  duration_ms: 2500,
  status: "success"
}
```

## 6. エラーハンドリング

### 6.1 エラー分類

#### 6.1.1 一時的エラー
- **ネットワークエラー**: 自動リトライ (3回)
- **API Rate Limit**: バックオフ戦略
- **一時的サービス停止**: キューローリング

#### 6.1.2 永続的エラー
- **認証エラー**: 管理者通知
- **データ形式エラー**: ログ記録、スキップ
- **設定エラー**: 設定検証、エラー通知

### 6.2 リトライ戦略

#### 6.2.1 Exponential Backoff
```javascript
const retryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1秒
  maxDelay: 30000, // 30秒
  backoffMultiplier: 2
};
```

#### 6.2.2 Circuit Breaker
```javascript
const circuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeout: 60000, // 1分
  monitoringPeriod: 300000 // 5分
};
```

## 7. パフォーマンス最適化

### 7.1 キャッシュ戦略

#### 7.1.1 Redis Cache
- **用途**: 頻繁アクセスデータ
- **TTL**: 1時間
- **データ**: 企業情報、設定情報

#### 7.1.2 CDN Cache
- **用途**: 静的コンテンツ
- **TTL**: 24時間
- **データ**: 画像、ドキュメント

### 7.2 並列処理

#### 7.2.1 情報収集の並列化
```javascript
// 企業ごとの並列処理
const companies = await getActiveCompanies();
const results = await Promise.allSettled(
  companies.map(company => collectNewsForCompany(company))
);
```

#### 7.2.2 AI分析のバッチ処理
```javascript
// 記事のバッチ処理
const articles = await getUnprocessedArticles();
const batches = chunk(articles, 10); // 10件ずつ処理
for (const batch of batches) {
  await processBatchWithAI(batch);
}
```

## 8. コスト最適化

### 8.1 サーバーレス最適化

#### 8.1.1 Lambda/Functions最適化
- **メモリ設定**: 必要最小限
- **実行時間**: タイムアウト設定
- **同時実行数**: 適切な制限

#### 8.1.2 データ転送最適化
- **圧縮**: gzip圧縮の活用
- **バッチ処理**: まとめて送信
- **不要データ**: 除外・フィルタリング

### 8.2 AI API コスト最適化

#### 8.2.1 トークン使用量削減
- **プロンプト最適化**: 簡潔な指示
- **レスポンス制限**: 適切な長さ制限
- **キャッシュ活用**: 類似内容の再利用

#### 8.2.2 処理頻度最適化
- **重複排除**: 事前フィルタリング
- **重要度フィルタ**: 低重要度の除外
- **バッチ処理**: まとめて処理

## 9. デプロイメント戦略

### 9.1 CI/CD パイプライン

#### 9.1.1 開発フロー
```
1. Feature Branch Creation
2. Development & Testing
3. Pull Request & Review
4. Merge to Main Branch
5. Automated Testing
6. Staging Deployment
7. Production Deployment
```

#### 9.1.2 自動化ツール
- **GitHub Actions**: CI/CD
- **AWS CodePipeline**: デプロイ
- **Terraform**: インフラ管理

### 9.2 環境管理

#### 9.2.1 環境分離
- **Development**: 開発環境
- **Staging**: ステージング環境
- **Production**: 本番環境

#### 9.2.2 設定管理
- **環境変数**: 各環境ごとの設定
- **Secrets**: 暗号化された機密情報
- **Feature Flags**: 機能の有効/無効切り替え

---

**作成日**: 2024年1月15日  
**バージョン**: 1.0  
**更新履歴**: 初版作成
