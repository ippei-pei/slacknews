---
title: 情報収集・統合 API
description: 企業ニュースの収集・LLM統合・テスト実行を提供するエンドポイント。
status: draft
---

## 概要
日次バッチおよび管理画面からのテスト実行でニュース記事を収集し、LLM で統合処理を行うための API とバッチ仕様。

## トリガー分類
1. **自動収集（バッチ）**: Cloud Scheduler → Pub/Sub → Cloud Functions
2. **手動実行（API）**: 管理画面から `POST /news/collect` を呼び出し
3. **テスト用モード**: `POST /tests/news` でモックデータ注入

## バッチ処理フロー
1. 企業取得: `companies` から有効企業を取得
2. 情報収集: 以下クライアントを並列実行
   - RSS フィードパーサー
   - 公式サイトスクレイパー（構造化 + HTML → テキスト抽出）
   - Reddit API クライアント（サブレディット／検索）
3. 前処理: 記事メタデータ正規化、言語検出、公開日時整形
4. 一時保存: Firestore `raw_articles` に突合キー付きで保存
5. LLM 統合: 未処理記事をロット単位で OpenAI API へ渡し、重複排除・翻訳・要約・重要度算出
6. 結果保存: Firestore `news_articles`（統合済み）、`article_groups`（重複グループ）を更新
7. ログ: `collection_logs` に実績・失敗理由を保持

## エンドポイント
| Method | Path | 説明 |
|--------|------|------|
| POST | `/news/collect` | 全企業または指定企業の収集バッチを同期実行 |
| POST | `/news/collect/{companyId}` | 単一企業向け収集 |
| GET | `/news/articles` | 統合済み記事一覧取得（フィルタ、ページネーション） |
| POST | `/news/reprocess` | LLM 統合の再実行（手動） |

### `POST /news/collect`
リクエスト例:
```json
{
  "companyIds": ["company_pokemon"],
  "force": false,
  "simulate": false
}
```
- `companyIds` 未指定時は全企業対象
- `force` が true の場合、最新実行時刻に関係なく再取得
- `simulate` true でモックデータ投入（テスト用途）

レスポンス:
```json
{
  "success": true,
  "data": {
    "jobs": [
      { "companyId": "company_pokemon", "status": "success", "articlesFetched": 12 }
    ],
    "llm": {
      "batches": 2,
      "tokensUsed": 15432,
      "completionTimeMs": 8200
    }
  },
  "meta": { "requestId": "req_collect_123", "timestamp": "2025-09-19T01:00:00Z" }
}
```

## Firestore コレクション
- `raw_articles`: 収集直後の原文記事
- `article_groups`: 重複クラスタ情報
- `news_articles`: 翻訳・要約・重要度など統合結果
- `collection_logs`: 実行ログ（成功/失敗/リトライ）

### `news_articles` ドキュメント例
```json
{
  "id": "article_pokemon_20250918_001",
  "company_id": "company_pokemon",
  "title_original": "Pokemon TCG Live Platform Updates",
  "title_jp": "ポケモンTCG Liveプラットフォームアップデート",
  "summary_jp": "ポケモン公式が...",
  "importance": 88,
  "categories": ["product", "partnership"],
  "published_at": "2025-09-18T09:00:00Z",
  "source_links": [
    { "url": "https://www.pokemon.com/...", "title": "Pokemon TCG Live Platform Updates", "source": "Pokemon Official" }
  ],
  "llm_version": "gpt-4o-2025-09",
  "created_at": <timestamp>,
  "updated_at": <timestamp>
}
```

## LLM 呼び出し
- モデル: GPT-4o もしくは最新の競合分析向けモデル
- プロンプト: 記事本文と企業情報、設定コンテキストを入力
- 出力: 翻訳済みタイトル/本文要約/重要度スコア/カテゴリ/戦略メモ
- レート制御: 同時実行数 5、指数バックオフ（max 3 リトライ）

## エラーハンドリング
- 外部サイトアクセス失敗: リトライ（RSS: 3 回、スクレイピング: 2 回）
- LLM API エラー: リトライ → 失敗時は `llm_processing_error` として Slack 通知
- Firestore 書き込みエラー: トランザクションで再実行
- Reddit API rate limit: `429` → バックオフ + 部分成功で記録

## テスト観点
- モックデータでの end-to-end 成功
- LLM 呼び出し失敗時の graceful degradation（部分成功）
- force 実行で既存記事の更新が発生すること
- `simulate=true` で Firestore への書き込みを行わずログのみ生成

