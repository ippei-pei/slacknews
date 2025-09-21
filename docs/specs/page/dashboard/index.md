---
title: 管理ダッシュボード
description: SlackNews 管理画面トップ。企業管理・設定・テスト実行を提供する。
route: page/dashboard
status: draft
---

## 概要
- Slack 認証済みユーザー向けの管理 UI。
- メニュー: 企業管理 / 設定 / テスト実行。
- 各操作はバックエンドの REST API を利用して Firestore / Functions と連携する。

## 画面構成
1. ヘッダー: システムステータス表示、ログアウトリンク（TODO）
2. タブメニュー
3. コンテンツ領域
   - 企業管理: 企業一覧、検索、 CRUD モーダル
   - 設定: 情報収集コンテキスト、Slack 配信設定、エラー通知設定
   - テスト実行: 情報収集 / 日次レポート / 週次レポートの即時実行

## 企業管理タブ
- 一覧: `GET /companies` の結果を表示。
- 新規登録: モーダルで `POST /companies`
- 編集: モーダルで `PATCH /companies/{id}`
- 削除: 論理削除 `DELETE /companies/{id}`
- 成功時: トースト表示 + 一覧再取得
- エラー時: トースト表示 + Slack メンションはバックエンド側で実行

## 設定タブ
- 情報収集コンテキスト: Markdown ライクなテキスト入力→ `PUT /settings/context`
- Slack 配信設定: チャンネル選択ダイアログ（API `GET /settings/slack` → Slack `conversations.list` → `PUT /settings/slack`）
- エラー通知設定: `PUT /settings/error-notification`
- 保存成功時はトースト表示・フォーム値反映

## テスト実行タブ
- ボタン押下で以下 API を呼び出す:
  - 全企業情報取得テスト: `POST /news/collect`（simulate=false, force=true）
  - 日次レポートテスト: `POST /reports/daily`（overrideChannelId=テスト用）
  - 週次レポートテスト: `POST /reports/weekly`
- 実行中はプログレスバー表示。
- 結果リストは API レスポンスを整形して表示。
- 実行ログは `GET /analytics/test-executions`（要件追加予定）で取得。

## エラーハンドリング
- ネットワークエラーはフロントで再試行案内。
- バリデーションエラーはフォーム欄で表示。
- バックエンドからの `error.code` をメッセージに表示し、重大エラー時はダイアログ通知。

## テスト観点
- Playwright シナリオ 1〜6 がこの画面に対して動作する。
- API 連携の結果が反映されること。
- エラーフラグ設定時（localStorage）ではなく、実際のバックエンド応答で挙動が決まること。

