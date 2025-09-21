# 001: バックエンドフル実装 設計メモ

## 方針
- 既存の system_architecture.md / data_model.md / api_specifications.md を最新状態に更新しつつ、実装のソース・オブ・トゥルースとして docs/specs/
  を整備する。
- Google Cloud Functions を中心としたサーバーレス構成とし、Cloud Scheduler + Pub/Sub によるバッチ実行を採用する。
- Firestore を永続化レイヤーとし、ニュース記事・統合グループ・設定・配信ログ等のコレクションを docs/data_model と同期。
- LLM 統合処理は Cloud Functions 内で OpenAI API を呼び出す形で実装。重複排除・翻訳・要約・重要度判定・カテゴリ分類・戦略分析をモジュール化。
- Slack 配信は Slack Web API (chat.postMessage + threads) を利用し、Secret Manager に格納した Bot Token を使用。

## データフロー（ハイレベル）
1. Cloud Scheduler が日次/週次で Pub/Sub トピックをトリガー。
2. トピックを購読する Cloud Function が企業リストを Firestore から取得し、各企業ごとに情報収集ジョブを実行。
3. RSS / Web クロール / Reddit API クライアントが記事データを取得し、preprocessing を行った上で Firestore へ一時保存。
4. LLM 統合関数が未処理記事をバッチで処理し、重複排除・翻訳・要約・スコアリング・戦略メモを生成し、統合記事コレクションへ保存。
5. 配信 Function が Slack 用にフォーマットして chat.postMessage / thread を呼び出し、配信ログを Firestore に記録。
6. UI からは REST API（企業管理・設定・テスト実行）を通じて Firestore/Functions を操作。

## API レイヤー
- Cloud Functions (HTTP) で REST API を提供。
- 認証は Slack OAuth 済アカウントのみを想定。初期段階では簡易トークン制御（管理画面からのみ呼び出す前提）。
- 主なエンドポイント例：
  - `POST /companies` / `PATCH /companies/:id` / `DELETE /companies/:id`
  - `POST /news/collect` (手動トリガー)
  - `POST /reports/daily` / `POST /reports/weekly`
  - `GET /analytics/system-status`

## テスト戦略
- 単体テスト: Cloud Functions のハンドラ／サービスクラス単位で Jest + ts-jest。
- 統合テスト: Firestore Emulator・Functions Emulator を使った end-to-end。
- E2E: Playwright から管理 UI + API を総合的に確認。
- Mocking 方針: 外部 API（OpenAI, Slack, Reddit 等）はローカル／CI ではモッククライアントを使用し、ステージングでは実接続。

## 代替案検討（抜粋）
- **バックエンドフレームワーク:** Firebase Functions vs Cloud Run + Express。→ 初期段階は Functions で十分、将来スケール時に Cloud Run へ移行可能な設計にする。
- **データストア:** Firestore vs PostgreSQL。→ requirements.md が Firestore 前提のため Firestore を採用。将来的に BigQuery 連携も視野。
- **スケジューラ:** Cloud Scheduler vs 外部 cron。→ GCP 内で完結させる。

## 影響範囲
- Playwright テスト群の更新（モックから実 API 連携へ）
- docs/specs/* の全面拡充
- CI/CD 設定（GitHub Actions + Firebase CLI）
- 環境変数・Secret の取り扱い方針

## 未決事項
- Firestore コレクション詳細（インデックス設計含む）の最終確定
- LLM のプロンプト設計・トークン最適化
- RSS/スクレイピング対象サイトのリスト管理方法（静的？管理画面で CRUD？）
- Slack ワークスペース／チャンネルの本番運用ルール
- テストデータの扱い（ステージング環境の分離方法）
