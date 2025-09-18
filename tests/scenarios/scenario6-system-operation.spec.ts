import { test, expect } from '@playwright/test';
import { TestExecutionPage } from '../page-objects/TestExecutionPage';
import { CompanyManagementPage } from '../page-objects/CompanyManagementPage';
import { TestHelpers } from '../helpers/test-helpers';
import { TEST_COMPANIES } from '../test-data';

/**
 * シナリオ6: システム稼働確認
 * システムの安定性とパフォーマンスの確認
 */
test.describe('シナリオ6: システム稼働確認', () => {
  let testExecutionPage: TestExecutionPage;
  let companyManagementPage: CompanyManagementPage;
  let testHelpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    testExecutionPage = new TestExecutionPage(page);
    companyManagementPage = new CompanyManagementPage(page);
    testHelpers = new TestHelpers(page);
    
    // 前提条件: 全シナリオが正常に完了している
    await page.goto('/dashboard');
  });

  test('システム正常稼働確認', async ({ page }) => {
    // ダッシュボードの表示確認
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    // 主要コンポーネントの表示確認
    await page.locator('[data-testid="dashboard-header"]').waitFor({ state: 'visible' });
    await page.locator('[data-testid="company-management-menu"]').waitFor({ state: 'visible' });
    await page.locator('[data-testid="test-execution-menu"]').waitFor({ state: 'visible' });
    await page.locator('[data-testid="settings-menu"]').waitFor({ state: 'visible' });
    
    // システム稼働確認
    const systemStatus = await page.evaluate(() => {
      return window.localStorage.getItem('system-status');
    });
    expect(systemStatus).toBe('running');
  });

  test('レスポンス時間確認（30秒以内）', async ({ page }) => {
    // 情報取得テストのレスポンス時間測定
    await testExecutionPage.navigateToTestExecution();
    
    const responseTime = await testHelpers.measureResponseTime(async () => {
      await testExecutionPage.runAllCompaniesInfoTest();
      await testExecutionPage.waitForTestExecutionComplete();
    });
    
    // 30秒以内で完了することを確認
    await testHelpers.verifyResponseTime(responseTime, 30000);
    
    // 日次レポートテストのレスポンス時間測定
    const dailyReportTime = await testHelpers.measureResponseTime(async () => {
      await testExecutionPage.runDailyReportTest();
      await testExecutionPage.waitForTestExecutionComplete();
    });
    
    await testHelpers.verifyResponseTime(dailyReportTime, 30000);
    
    // 週次レポートテストのレスポンス時間測定
    const weeklyReportTime = await testHelpers.measureResponseTime(async () => {
      await testExecutionPage.runWeeklyReportTest();
      await testExecutionPage.waitForTestExecutionComplete();
    });
    
    await testHelpers.verifyResponseTime(weeklyReportTime, 60000); // 週次は60秒以内
  });

  test('複数ユーザー同時アクセス確認', async ({ browser }) => {
    // 複数のブラウザコンテキストを作成
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    const page3 = await context3.newPage();
    
    try {
      // 複数ユーザーが同時にアクセス
      const promises = [
        page1.goto('/dashboard'),
        page2.goto('/dashboard'),
        page3.goto('/dashboard')
      ];
      
      await Promise.all(promises);
      
      // 全ページが正常に表示されることを確認
      await expect(page1).toHaveURL(/.*\/dashboard/);
      await expect(page2).toHaveURL(/.*\/dashboard/);
      await expect(page3).toHaveURL(/.*\/dashboard/);
      
      // 同時にテスト実行を試行
      const testPromises = [
        page1.locator('[data-testid="test-execution-menu"]').click(),
        page2.locator('[data-testid="test-execution-menu"]').click(),
        page3.locator('[data-testid="test-execution-menu"]').click()
      ];
      
      await Promise.all(testPromises);
      
      // 全ページでテスト実行ページが表示されることを確認
      await page1.locator('[data-testid="all-companies-info-test-button"]').waitFor({ state: 'visible' });
      await page2.locator('[data-testid="all-companies-info-test-button"]').waitFor({ state: 'visible' });
      await page3.locator('[data-testid="all-companies-info-test-button"]').waitFor({ state: 'visible' });
      
    } finally {
      // リソースのクリーンアップ
      await context1.close();
      await context2.close();
      await context3.close();
    }
  });

  test('重複排除・翻訳・要約処理の安定性確認', async ({ page }) => {
    // テスト実行ページに移動
    await testExecutionPage.navigateToTestExecution();
    
    // 情報取得テストを複数回実行
    for (let i = 0; i < 3; i++) {
      await testExecutionPage.runAllCompaniesInfoTest();
      await testExecutionPage.waitForTestExecutionComplete();
      
      // 各実行でバックエンド処理が正常に完了することを確認
      await testHelpers.verifyBackendProcessing([]);
      
      // テスト結果が正常であることを確認
      await testExecutionPage.verifyTestResults(3);
      
      // 各企業のテスト成功を確認
      for (const company of TEST_COMPANIES) {
        await testExecutionPage.verifyTestResultSuccess(company.name);
      }
    }
  });

  test('LLM処理品質の確認', async ({ page }) => {
    // テスト実行ページに移動
    await testExecutionPage.navigateToTestExecution();
    
    // 情報取得テストを実行
    await testExecutionPage.runAllCompaniesInfoTest();
    await testExecutionPage.waitForTestExecutionComplete();
    
    // LLM処理の品質確認
    const executionLog = await testExecutionPage.getTestExecutionLog();
    
    // LLM処理が正常に完了していることを確認
    expect(executionLog).toContain('LLM重複排除完了');
    expect(executionLog).toContain('LLM翻訳完了');
    expect(executionLog).toContain('LLM要約完了');
    expect(executionLog).toContain('LLM重要度評価完了');
    
    // バックエンド処理確認
    await testHelpers.verifyBackendProcessing([]);
  });

  test('データベース整合性確認', async ({ page }) => {
    // 企業管理ページに移動
    await companyManagementPage.navigateToCompanyManagement();
    
    // データベース整合性の確認
    await testHelpers.verifyDatabaseIntegrity();
    
    // 企業データの整合性確認
    await companyManagementPage.verifyCompanyCount(3);
    
    // 各企業が正しく登録されていることを確認
    for (const company of TEST_COMPANIES) {
      await companyManagementPage.verifyCompanyInList(company.name);
    }
  });

  test('パフォーマンス要件確認', async ({ page }) => {
    // テスト実行ページに移動
    await testExecutionPage.navigateToTestExecution();
    
    // 各テストの実行時間を測定
    const tests = [
      { name: '情報取得テスト', action: () => testExecutionPage.runAllCompaniesInfoTest() },
      { name: '日次レポートテスト', action: () => testExecutionPage.runDailyReportTest() },
      { name: '週次レポートテスト', action: () => testExecutionPage.runWeeklyReportTest() }
    ];
    
    for (const test of tests) {
      const startTime = Date.now();
      await test.action();
      await testExecutionPage.waitForTestExecutionComplete();
      const endTime = Date.now();
      
      const executionTime = endTime - startTime;
      console.log(`${test.name}: ${executionTime}ms`);
      
      // パフォーマンス要件を満たしていることを確認
      if (test.name === '週次レポートテスト') {
        expect(executionTime).toBeLessThan(60000); // 60秒以内
      } else {
        expect(executionTime).toBeLessThan(30000); // 30秒以内
      }
    }
  });

  test('データ保持期間確認', async ({ page }) => {
    // データ保持期間は設定不要（問題発生まで放置）であることを確認
    const dataRetentionSettings = await page.evaluate(() => {
      return window.localStorage.getItem('data-retention-settings');
    });
    
    // データ保持設定が存在しないことを確認
    expect(dataRetentionSettings).toBeNull();
    
    // 既存データが保持されていることを確認
    await companyManagementPage.navigateToCompanyManagement();
    await companyManagementPage.verifyCompanyCount(3);
    
    // テスト実行履歴が保持されていることを確認
    await testExecutionPage.navigateToTestExecution();
    const executionLog = await testExecutionPage.getTestExecutionLog();
    expect(executionLog).toBeTruthy();
  });

  test('システム監視機能確認', async ({ page }) => {
    // システム監視機能の確認
    const systemMetrics = await page.evaluate(() => {
      return {
        cpuUsage: window.localStorage.getItem('system-cpu-usage'),
        memoryUsage: window.localStorage.getItem('system-memory-usage'),
        responseTime: window.localStorage.getItem('system-response-time'),
        errorRate: window.localStorage.getItem('system-error-rate')
      };
    });
    
    // システムメトリクスが記録されていることを確認
    expect(systemMetrics.cpuUsage).toBeTruthy();
    expect(systemMetrics.memoryUsage).toBeTruthy();
    expect(systemMetrics.responseTime).toBeTruthy();
    expect(systemMetrics.errorRate).toBeTruthy();
    
    // メトリクス値が正常範囲内であることを確認
    expect(parseFloat(systemMetrics.cpuUsage || '0')).toBeLessThan(80);
    expect(parseFloat(systemMetrics.memoryUsage || '0')).toBeLessThan(80);
    expect(parseFloat(systemMetrics.responseTime || '0')).toBeLessThan(30000);
    expect(parseFloat(systemMetrics.errorRate || '0')).toBeLessThan(5);
  });
});
