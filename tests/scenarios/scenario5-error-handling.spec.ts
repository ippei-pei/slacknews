import { test, expect } from '@playwright/test';
import { CompanyManagementPage } from '../page-objects/CompanyManagementPage';
import { TestExecutionPage } from '../page-objects/TestExecutionPage';
import { SlackMockPage } from '../page-objects/SlackMockPage';
import { TestHelpers } from '../helpers/test-helpers';
import { TEST_SLACK_CHANNEL, TEST_ERROR_USER } from '../test-data';

/**
 * シナリオ5: エラーハンドリング
 * 各種エラーケースの処理とエラー通知の確認
 */
test.describe('シナリオ5: エラーハンドリング', () => {
  let companyManagementPage: CompanyManagementPage;
  let testExecutionPage: TestExecutionPage;
  let slackMockPage: SlackMockPage;
  let testHelpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    companyManagementPage = new CompanyManagementPage(page);
    testExecutionPage = new TestExecutionPage(page);
    slackMockPage = new SlackMockPage(page);
    testHelpers = new TestHelpers(page);
    
    // 前提条件: 正常な企業登録が完了している
    await page.goto('/dashboard');
  });

  test('無効なURL登録エラー', async ({ page }) => {
    // 企業管理ページに移動
    await companyManagementPage.navigateToCompanyManagement();
    
    // 無効なURLで企業を登録
    await companyManagementPage.clickAddCompany();
    await companyManagementPage.fillCompanyForm({
      name: "Invalid Company",
      url: "invalid-url",
      rssUrl: "invalid-rss-url"
    });
    
    await companyManagementPage.saveCompany();
    
    // エラーメッセージが表示されることを確認
    await companyManagementPage.waitForErrorMessage();
    
    // エラー通知が設定ユーザーに送信されることを確認
    await slackMockPage.navigateToSlackChannel(TEST_SLACK_CHANNEL);
    await slackMockPage.verifyErrorMention(TEST_ERROR_USER);
  });

  test('必須フィールド未入力エラー', async ({ page }) => {
    // 企業管理ページに移動
    await companyManagementPage.navigateToCompanyManagement();
    
    // 必須フィールドを空にして企業を登録
    await companyManagementPage.clickAddCompany();
    await companyManagementPage.saveCompany();
    
    // エラーメッセージが表示されることを確認
    await companyManagementPage.waitForErrorMessage();
    
    // エラー通知が設定ユーザーに送信されることを確認
    await slackMockPage.navigateToSlackChannel(TEST_SLACK_CHANNEL);
    await slackMockPage.verifyErrorMention(TEST_ERROR_USER);
  });

  test('Slack認証エラー', async ({ page }) => {
    // Slack認証エラーをシミュレート
    await page.evaluate(() => {
      window.localStorage.setItem('slack-auth-error', 'true');
    });
    
    // ログインページに移動
    await page.goto('/login');
    
    // Slack認証を実行
    await page.locator('[data-testid="slack-auth-button"]').click();
    
    // エラーメッセージが表示されることを確認
    await page.locator('[data-testid="slack-auth-error"]').waitFor({ state: 'visible' });
    
    // エラー通知が設定ユーザーに送信されることを確認
    await slackMockPage.navigateToSlackChannel(TEST_SLACK_CHANNEL);
    await slackMockPage.verifyErrorMention(TEST_ERROR_USER);
  });

  test('Slack配信エラー', async ({ page }) => {
    // Slack配信エラーをシミュレート
    await page.evaluate(() => {
      window.localStorage.setItem('slack-delivery-error', 'true');
    });
    
    // テスト実行ページに移動
    await testExecutionPage.navigateToTestExecution();
    
    // 日次レポートテストを実行
    await testExecutionPage.runDailyReportTest();
    
    // エラーが適切に処理されることを確認
    await testExecutionPage.verifyTestResultError('Slack Delivery Error');
    
    // エラー通知が設定ユーザーに送信されることを確認
    await slackMockPage.navigateToSlackChannel(TEST_SLACK_CHANNEL);
    await slackMockPage.verifyErrorMention(TEST_ERROR_USER);
  });

  test('LLM処理エラー', async ({ page }) => {
    // LLM処理エラーをシミュレート
    await page.evaluate(() => {
      window.localStorage.setItem('llm-processing-error', 'true');
    });
    
    // テスト実行ページに移動
    await testExecutionPage.navigateToTestExecution();
    
    // 情報取得テストを実行
    await testExecutionPage.runAllCompaniesInfoTest();
    
    // エラーが適切に処理されることを確認
    await testExecutionPage.verifyTestResultError('LLM Processing Error');
    
    // エラー通知が設定ユーザーに送信されることを確認
    await slackMockPage.navigateToSlackChannel(TEST_SLACK_CHANNEL);
    await slackMockPage.verifyErrorMention(TEST_ERROR_USER);
  });

  test('外部API接続エラー', async ({ page }) => {
    // 外部API接続エラーをシミュレート
    await page.evaluate(() => {
      window.localStorage.setItem('external-api-error', 'true');
    });
    
    // テスト実行ページに移動
    await testExecutionPage.navigateToTestExecution();
    
    // 情報取得テストを実行
    await testExecutionPage.runAllCompaniesInfoTest();
    
    // エラーが適切に処理されることを確認
    await testExecutionPage.verifyTestResultError('External API Connection Error');
    
    // エラー通知が設定ユーザーに送信されることを確認
    await slackMockPage.navigateToSlackChannel(TEST_SLACK_CHANNEL);
    await slackMockPage.verifyErrorMention(TEST_ERROR_USER);
  });

  test('データベース接続エラー', async ({ page }) => {
    // データベース接続エラーをシミュレート
    await page.evaluate(() => {
      window.localStorage.setItem('database-connection-error', 'true');
    });
    
    // 企業管理ページに移動
    await companyManagementPage.navigateToCompanyManagement();
    
    // 企業登録を試行
    await companyManagementPage.clickAddCompany();
    await companyManagementPage.fillCompanyForm({
      name: "Test Company",
      url: "https://example.com",
      rssUrl: "https://example.com/rss"
    });
    
    await companyManagementPage.saveCompany();
    
    // エラーメッセージが表示されることを確認
    await companyManagementPage.waitForErrorMessage();
    
    // エラー通知が設定ユーザーに送信されることを確認
    await slackMockPage.navigateToSlackChannel(TEST_SLACK_CHANNEL);
    await slackMockPage.verifyErrorMention(TEST_ERROR_USER);
  });

  test('エラー状態からの回復確認', async ({ page }) => {
    // エラー状態をシミュレート
    await page.evaluate(() => {
      window.localStorage.setItem('test-error-mode', 'true');
    });
    
    // テスト実行ページに移動
    await testExecutionPage.navigateToTestExecution();
    
    // 情報取得テストを実行（エラー発生）
    await testExecutionPage.runAllCompaniesInfoTest();
    await testExecutionPage.verifyTestResultError('Test Error');
    
    // エラー状態を解除
    await page.evaluate(() => {
      window.localStorage.removeItem('test-error-mode');
    });
    
    // 正常なテストが実行できることを確認
    await testExecutionPage.runAllCompaniesInfoTest();
    await testExecutionPage.waitForTestExecutionComplete();
    await testExecutionPage.verifyTestResultSuccess('The Pokémon Company International');
  });

  test('部分的な成功時の処理確認', async ({ page }) => {
    // 部分的なエラーをシミュレート（一部の企業のみエラー）
    await page.evaluate(() => {
      window.localStorage.setItem('partial-error-mode', 'true');
    });
    
    // テスト実行ページに移動
    await testExecutionPage.navigateToTestExecution();
    
    // 情報取得テストを実行
    await testExecutionPage.runAllCompaniesInfoTest();
    
    // 部分的な成功とエラーが混在することを確認
    await testExecutionPage.verifyTestResultSuccess('The Pokémon Company International');
    await testExecutionPage.verifyTestResultError('DeNA Co., Ltd.');
    
    // エラー通知が設定ユーザーに送信されることを確認
    await slackMockPage.navigateToSlackChannel(TEST_SLACK_CHANNEL);
    await slackMockPage.verifyErrorMention(TEST_ERROR_USER);
  });

  test('エラーログの確認', async ({ page }) => {
    // エラーを発生させる
    await page.evaluate(() => {
      window.localStorage.setItem('test-error-mode', 'true');
    });
    
    // テスト実行ページに移動
    await testExecutionPage.navigateToTestExecution();
    
    // 情報取得テストを実行
    await testExecutionPage.runAllCompaniesInfoTest();
    
    // エラーログが記録されていることを確認
    const executionLog = await testExecutionPage.getTestExecutionLog();
    expect(executionLog).toContain('エラーが発生しました');
    expect(executionLog).toContain('エラーログが記録されました');
    
    // エラー状態を解除
    await page.evaluate(() => {
      window.localStorage.removeItem('test-error-mode');
    });
  });
});
