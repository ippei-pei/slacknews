# SlackNews E2E Tests

このディレクトリには、SlackNews自動競合情報収集システムのPlaywright E2Eテストが含まれています。

## テスト構成

### テストシナリオ

1. **シナリオ1: 企業登録・基本設定** (`scenarios/scenario1-company-registration.spec.ts`)
   - Slack認証でログイン
   - DOPA競合企業の登録
   - 情報収集コンテキスト設定
   - Slack配信チャンネル設定
   - エラー通知対象ユーザー設定

2. **シナリオ2: テスト実行機能** (`scenarios/scenario2-test-execution.spec.ts`)
   - 情報取得テスト（全企業対象）
   - 日次レポートテスト（全企業対象）
   - 週次レポートテスト（全企業対象）
   - バックエンド処理確認

3. **シナリオ3: 日次レポート配信確認** (`scenarios/scenario3-daily-report.spec.ts`)
   - 日次レポート配信内容確認
   - 配信形式の詳細確認
   - スレッド投稿内容の確認
   - 重複排除の確認

4. **シナリオ4: 週次レポート配信確認** (`scenarios/scenario4-weekly-report.spec.ts`)
   - 週次レポート配信内容確認
   - 戦略分析内容の確認
   - 競合比較分析の確認
   - 週次データ統合の確認

5. **シナリオ5: エラーハンドリング** (`scenarios/scenario5-error-handling.spec.ts`)
   - 無効なURL登録エラー
   - 必須フィールド未入力エラー
   - Slack認証エラー
   - Slack配信エラー
   - LLM処理エラー
   - 外部API接続エラー
   - データベース接続エラー

6. **シナリオ6: システム稼働確認** (`scenarios/scenario6-system-operation.spec.ts`)
   - システム正常稼働確認
   - レスポンス時間確認（30秒以内）
   - 複数ユーザー同時アクセス確認
   - 重複排除・翻訳・要約処理の安定性確認

### Page Object Model

- **BasePage** (`page-objects/BasePage.ts`): 共通の要素とメソッド
- **LoginPage** (`page-objects/LoginPage.ts`): Slack認証機能
- **CompanyManagementPage** (`page-objects/CompanyManagementPage.ts`): 企業管理機能
- **SettingsPage** (`page-objects/SettingsPage.ts`): 設定機能
- **TestExecutionPage** (`page-objects/TestExecutionPage.ts`): テスト実行機能
- **SlackMockPage** (`page-objects/SlackMockPage.ts`): Slack配信内容確認

### テストデータ

- **test-data.ts**: DOPA競合企業情報とテスト用ニュースデータ
- **test-helpers.ts**: バックエンド処理検証とヘルパー関数
- **test-setup.ts**: テストセットアップとモックデータ設定

## テスト実行

### 前提条件

1. Node.js 18以上がインストールされている
2. Playwrightがインストールされている
3. テスト対象のアプリケーションが起動している

### インストール

```bash
npm install
npx playwright install
```

### テスト実行

```bash
# 全テスト実行
npm test

# UI付きテスト実行
npm run test:ui

# ヘッド付きテスト実行
npm run test:headed

# デバッグモード
npm run test:debug

# テストレポート表示
npm run test:report
```

### 特定のシナリオ実行

```bash
# シナリオ1のみ実行
npx playwright test scenarios/scenario1-company-registration.spec.ts

# シナリオ2のみ実行
npx playwright test scenarios/scenario2-test-execution.spec.ts
```

## テストデータ

### DOPA競合企業

1. **The Pokémon Company International**
   - URL: https://www.pokemon.com
   - RSS: https://www.pokemon.com/us/pokemon-news/rss/

2. **DeNA Co., Ltd.**
   - URL: https://dena.com
   - RSS: https://dena.com/intl/news/

3. **Niantic, Inc.**
   - URL: https://nianticlabs.com
   - RSS: https://nianticlabs.com/blog/

### テスト用ニュースデータ

- Pokemon TCG Live Platform Updates
- Pokemon Trading Card Game Pocket New Features
- Pokemon GO Plus+ Integration with TCG

## バックエンド処理確認項目

### 重複排除確認
- 記事の重複が適切に排除されている
- 同じ内容の記事が統合されている

### 翻訳確認
- 記事タイトル・内容が日本語に翻訳されている
- 日本語文字が含まれている

### 要約確認
- 記事が適切に要約されている（200文字以内）
- ニュース要約が50文字以内

### 重要度評価確認
- 重要度が100点満点で評価されている
- 重要度スコアが表示されない（内部処理のみ）

### ソース統合確認
- 統合された記事には複数のソース元リンクが保持されている
- ソース情報が完全である

## Slack配信形式確認項目

### 本文投稿確認
- 件数表示が含まれる（例：「📊 競合情報レポート (45件)」）
- 重要度上位10件のリンク付きテキストが表示される
- 重要度スコアは表示されない（内部処理のみ）

### スレッド投稿確認
- その他のニュースがリンク付きテキストで表示される
- 統合された記事には複数のソース元リンクが含まれる
- 全てのニュースが重要度順で表示される

## エラーハンドリング確認項目

### エラー処理確認
- 各エラーケースで適切なエラーメッセージが表示される
- エラー時は設定したユーザーにメンション付きで通知が送信される
- システムが異常終了せず、エラー状態から回復可能

### バックエンド処理確認
- エラー発生時でも重複排除・翻訳・要約処理が継続される
- 部分的に成功した処理結果が適切に保持される
- エラー後の再実行で正常に処理が完了する

## パフォーマンス要件

- 情報取得テスト: 30秒以内
- 日次レポートテスト: 30秒以内
- 週次レポートテスト: 60秒以内
- 複数ユーザー同時アクセス: 可能
- レスポンス時間: 30秒以内

## 注意事項

1. テスト実行前に、テスト対象のアプリケーションが起動していることを確認してください
2. テストデータは実際の競合企業の情報を使用しています
3. エラーハンドリングテストでは、意図的にエラーを発生させます
4. パフォーマンステストでは、実際の処理時間を測定します
5. テスト実行後は、テストデータがクリーンアップされます
