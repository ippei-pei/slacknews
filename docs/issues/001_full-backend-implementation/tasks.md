# 001: バックエンドフル実装 タスク分解

## フェーズ1: ドキュメント整備
- [ ] requirements.md / system_architecture.md / data_model.md / api_specifications.md の差分洗い出し
- [ ] docs/specs/page/dashboard/* を実装後の UI 振る舞いに合わせて更新
- [ ] docs/specs/api/* に REST/Batch エンドポイントの詳細を追加
- [ ] LLM 処理フローのプロンプト設計案を文書化

## フェーズ2: 基盤セットアップ
- [ ] GCP プロジェクト設定（Firestore, Cloud Functions, Pub/Sub, Cloud Scheduler, Secret Manager）
- [ ] 環境変数・Secret 管理方針の確立（.env.example / README 更新）
- [ ] 開発用 Firebase Emulator Suite 構築
- [ ] GitHub Actions で lint/test/deploy ワークフローの雛形作成

## フェーズ3: 情報収集サービス
- [ ] 企業情報 CRUD API 実装
- [ ] RSS フィード収集クライアント
- [ ] Web スクレイピング（公式サイト）クライアント
- [ ] Reddit API クライアント
- [ ] 前処理・重複検出下準備ロジック

## フェーズ4: LLM 統合処理
- [ ] 重複クラスタリングと代表記事選定
- [ ] 翻訳・要約・重要度スコアリング実装
- [ ] 戦略分析（週次）ロジック実装
- [ ] LLM 呼び出しのレート制御・エラーハンドリング

## フェーズ5: Slack 配信
- [ ] 日次レポートフォーマッタと Slack 投稿
- [ ] 週次レポートフォーマッタと Slack 投稿
- [ ] エラー通知（メンション）実装
- [ ] 配信ログの記録と再送制御

## フェーズ6: 管理 UI 連携
- [ ] 既存フロントエンドを実 API 呼び出しに置き換え
- [ ] Playwright テスト更新（実バックエンドと接続）
- [ ] エラーシナリオの再調整

## フェーズ7: テスト・リリース
- [ ] 単体テスト（Jest）整備
- [ ] 統合テスト（Emulator Suite）実行
- [ ] E2E テスト（Playwright）通過
- [ ] ステージング環境デプロイ＆確認
- [ ] 本番デプロイ手順書作成
