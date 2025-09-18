import { test, expect } from '@playwright/test';
import { TestExecutionPage } from '../page-objects/TestExecutionPage';
import { TestHelpers } from '../helpers/test-helpers';
import { TEST_COMPANIES, TEST_NEWS_ARTICLES } from '../test-data';

/**
 * シナリオ2: テスト実行機能
 * 情報取得・配信テストの実行とバックエンド処理確認
 */
test.describe('シナリオ2: テスト実行機能', () => {
  let testExecutionPage: TestExecutionPage;
  let testHelpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    testExecutionPage = new TestExecutionPage(page);
    testHelpers = new TestHelpers(page);
    
    // 前提条件: シナリオ1が完了している
    await page.goto('/dashboard');
  });

  test('情報取得テスト（全企業対象）', async ({ page }) => {
    // テスト実行ページに移動
    await testExecutionPage.navigateToTestExecution();
    
    // 全企業情報取得テストを実行
    await testExecutionPage.runAllCompaniesInfoTest();
    
    // テスト実行完了を待機
    await testExecutionPage.waitForTestExecutionComplete();
    
    // 3社分のテスト結果が表示されることを確認
    await testExecutionPage.verifyTestResults(3);
    
    // 各企業のテスト成功を確認
    for (const company of TEST_COMPANIES) {
      await testExecutionPage.verifyTestResultSuccess(company.name);
    }
    
    // バックエンド処理確認
    await testHelpers.verifyBackendProcessing(TEST_NEWS_ARTICLES);
    
    // レスポンス時間の確認（30秒以内）
    const responseTime = await testHelpers.measureResponseTime(async () => {
      await testExecutionPage.runAllCompaniesInfoTest();
    });
    await testHelpers.verifyResponseTime(responseTime, 30000);
  });

  test('日次レポートテスト（全企業対象）', async ({ page }) => {
    // テスト実行ページに移動
    await testExecutionPage.navigateToTestExecution();
    
    // 日次レポートテストを実行
    await testExecutionPage.runDailyReportTest();
    
    // テスト実行完了を待機
    await testExecutionPage.waitForTestExecutionComplete();
    
    // テスト結果の確認
    await testExecutionPage.verifyTestResults(3);
    
    // 各企業のテスト成功を確認
    for (const company of TEST_COMPANIES) {
      await testExecutionPage.verifyTestResultSuccess(company.name);
    }
    
    // バックエンド処理確認
    await testHelpers.verifyBackendProcessing(TEST_NEWS_ARTICLES);
    
    // テスト実行ログの確認
    const executionLog = await testExecutionPage.getTestExecutionLog();
    expect(executionLog).toContain('日次レポート生成完了');
    expect(executionLog).toContain('Slack配信完了');
  });

  test('週次レポートテスト（全企業対象）', async ({ page }) => {
    // テスト実行ページに移動
    await testExecutionPage.navigateToTestExecution();
    
    // 週次レポートテストを実行
    await testExecutionPage.runWeeklyReportTest();
    
    // テスト実行完了を待機
    await testExecutionPage.waitForTestExecutionComplete();
    
    // テスト結果の確認
    await testExecutionPage.verifyTestResults(3);
    
    // 各企業のテスト成功を確認
    for (const company of TEST_COMPANIES) {
      await testExecutionPage.verifyTestResultSuccess(company.name);
    }
    
    // バックエンド処理確認
    await testHelpers.verifyBackendProcessing(TEST_NEWS_ARTICLES);
    
    // テスト実行ログの確認
    const executionLog = await testExecutionPage.getTestExecutionLog();
    expect(executionLog).toContain('週次レポート生成完了');
    expect(executionLog).toContain('戦略分析完了');
    expect(executionLog).toContain('Slack配信完了');
  });

  test('テスト実行の並行処理', async ({ page }) => {
    // テスト実行ページに移動
    await testExecutionPage.navigateToTestExecution();
    
    // 複数のテストを並行実行
    const promises = [
      testExecutionPage.runAllCompaniesInfoTest(),
      testExecutionPage.runDailyReportTest(),
      testExecutionPage.runWeeklyReportTest()
    ];
    
    // 全てのテストが完了するまで待機
    await Promise.all(promises);
    
    // 全てのテストが正常に完了したことを確認
    await testExecutionPage.waitForTestExecutionComplete();
    await testExecutionPage.verifyTestResults(3);
  });

  test('テスト実行エラーハンドリング', async ({ page }) => {
    // テスト実行ページに移動
    await testExecutionPage.navigateToTestExecution();
    
    // 無効な企業データでテストを実行（エラーをシミュレート）
    await page.evaluate(() => {
      // 無効な企業データを注入
      window.localStorage.setItem('test-error-mode', 'true');
    });
    
    // テストを実行
    await testExecutionPage.runAllCompaniesInfoTest();
    
    // エラーが適切に処理されることを確認
    await testExecutionPage.verifyTestResultError('Invalid Company');
    
    // エラー状態から回復可能であることを確認
    await page.evaluate(() => {
      window.localStorage.removeItem('test-error-mode');
    });
    
    // 正常なテストが実行できることを確認
    await testExecutionPage.runAllCompaniesInfoTest();
    await testExecutionPage.verifyTestResultSuccess('The Pokémon Company International');
  });
});
