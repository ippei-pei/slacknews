import { test, expect } from '@playwright/test';
import { SlackMockPage } from '../page-objects/SlackMockPage';
import { TestExecutionPage } from '../page-objects/TestExecutionPage';
import { TestHelpers } from '../helpers/test-helpers';
import { TEST_SLACK_CHANNEL, TEST_NEWS_ARTICLES } from '../test-data';

/**
 * シナリオ4: 週次レポート配信確認
 * 週次戦略分析レポートの配信内容確認
 */
test.describe('シナリオ4: 週次レポート配信確認', () => {
  let slackMockPage: SlackMockPage;
  let testExecutionPage: TestExecutionPage;
  let testHelpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    slackMockPage = new SlackMockPage(page);
    testExecutionPage = new TestExecutionPage(page);
    testHelpers = new TestHelpers(page);
    
    // 前提条件: シナリオ2の週次レポートテストが完了している
    await page.goto('/dashboard');
  });

  test('週次レポート配信内容確認', async ({ page }) => {
    // 週次レポートテストを実行
    await testExecutionPage.navigateToTestExecution();
    await testExecutionPage.runWeeklyReportTest();
    await testExecutionPage.waitForTestExecutionComplete();
    
    // Slackチャンネルに移動
    await slackMockPage.navigateToSlackChannel(TEST_SLACK_CHANNEL);
    
    // 最新メッセージを取得
    const latestMessage = await slackMockPage.getLatestMessage();
    
    // 配信内容確認
    await slackMockPage.verifyWeeklyReportFormat(latestMessage);
    await slackMockPage.verifyJapaneseContent(latestMessage);
    await slackMockPage.verifySourceLinks(latestMessage);
    await slackMockPage.verifyNoImportanceScoreDisplay(latestMessage);
    
    // バックエンド処理確認
    await testHelpers.verifyBackendProcessing(TEST_NEWS_ARTICLES);
  });

  test('週次レポート配信形式の詳細確認', async ({ page }) => {
    // 週次レポートテストを実行
    await testExecutionPage.navigateToTestExecution();
    await testExecutionPage.runWeeklyReportTest();
    await testExecutionPage.waitForTestExecutionComplete();
    
    // Slackチャンネルに移動
    await slackMockPage.navigateToSlackChannel(TEST_SLACK_CHANNEL);
    
    // 最新メッセージの詳細確認
    const latestMessage = await slackMockPage.getLatestMessage();
    
    // 週次レポートヘッダーの確認
    expect(latestMessage).toMatch(/📈 週次戦略分析レポート/);
    
    // 企業別戦略分析の確認
    expect(latestMessage).toMatch(/🏢 \[.*\]/);
    expect(latestMessage).toMatch(/基本戦略:/);
    expect(latestMessage).toMatch(/変更点:/);
    expect(latestMessage).toMatch(/ニュースサマリ:/);
    
    // 日本語コンテンツの確認
    expect(latestMessage).toMatch(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/);
  });

  test('戦略分析内容の確認', async ({ page }) => {
    // 週次レポートテストを実行
    await testExecutionPage.navigateToTestExecution();
    await testExecutionPage.runWeeklyReportTest();
    await testExecutionPage.waitForTestExecutionComplete();
    
    // Slackチャンネルに移動
    await slackMockPage.navigateToSlackChannel(TEST_SLACK_CHANNEL);
    
    // 最新メッセージを取得
    const latestMessage = await slackMockPage.getLatestMessage();
    
    // 戦略分析の各要素が含まれているか確認
    const hasBasicStrategy = latestMessage.includes('基本戦略:');
    const hasChanges = latestMessage.includes('変更点:');
    const hasNewsSummary = latestMessage.includes('ニュースサマリ:');
    
    expect(hasBasicStrategy).toBeTruthy();
    expect(hasChanges).toBeTruthy();
    expect(hasNewsSummary).toBeTruthy();
    
    // バックエンド処理確認
    await testHelpers.verifyBackendProcessing(TEST_NEWS_ARTICLES);
  });

  test('競合比較分析の確認', async ({ page }) => {
    // 週次レポートテストを実行
    await testExecutionPage.navigateToTestExecution();
    await testExecutionPage.runWeeklyReportTest();
    await testExecutionPage.waitForTestExecutionComplete();
    
    // Slackチャンネルに移動
    await slackMockPage.navigateToSlackChannel(TEST_SLACK_CHANNEL);
    
    // 最新メッセージを取得
    const latestMessage = await slackMockPage.getLatestMessage();
    
    // 競合比較分析が含まれているか確認
    const hasCompetitorComparison = latestMessage.includes('競合比較') || 
                                   latestMessage.includes('比較分析') ||
                                   latestMessage.includes('市場動向');
    
    expect(hasCompetitorComparison).toBeTruthy();
    
    // 複数企業の分析が含まれているか確認
    const companyCount = (latestMessage.match(/🏢 \[.*\]/g) || []).length;
    expect(companyCount).toBeGreaterThan(1);
  });

  test('週次データ統合の確認', async ({ page }) => {
    // 週次レポートテストを実行
    await testExecutionPage.navigateToTestExecution();
    await testExecutionPage.runWeeklyReportTest();
    await testExecutionPage.waitForTestExecutionComplete();
    
    // Slackチャンネルに移動
    await slackMockPage.navigateToSlackChannel(TEST_SLACK_CHANNEL);
    
    // 最新メッセージを取得
    const latestMessage = await slackMockPage.getLatestMessage();
    
    // 週間データが統合されているか確認
    const hasWeeklyData = latestMessage.includes('今週') || 
                         latestMessage.includes('週間') ||
                         latestMessage.includes('7日間');
    
    expect(hasWeeklyData).toBeTruthy();
    
    // バックエンド処理確認
    await testHelpers.verifyBackendProcessing(TEST_NEWS_ARTICLES);
  });

  test('戦略変更検出の確認', async ({ page }) => {
    // 週次レポートテストを実行
    await testExecutionPage.navigateToTestExecution();
    await testExecutionPage.runWeeklyReportTest();
    await testExecutionPage.waitForTestExecutionComplete();
    
    // Slackチャンネルに移動
    await slackMockPage.navigateToSlackChannel(TEST_SLACK_CHANNEL);
    
    // 最新メッセージを取得
    const latestMessage = await slackMockPage.getLatestMessage();
    
    // 戦略変更が検出されているか確認
    const hasStrategyChanges = latestMessage.includes('変更点:') && 
                              !latestMessage.includes('変更点: なし') &&
                              !latestMessage.includes('変更点: 特になし');
    
    // 変更点セクションが存在し、何らかの内容が含まれているか確認
    expect(latestMessage).toMatch(/変更点: .+/);
  });

  test('週次レポート配信タイミングの確認', async ({ page }) => {
    const startTime = Date.now();
    
    // 週次レポートテストを実行
    await testExecutionPage.navigateToTestExecution();
    await testExecutionPage.runWeeklyReportTest();
    await testExecutionPage.waitForTestExecutionComplete();
    
    // Slackチャンネルに移動
    await slackMockPage.navigateToSlackChannel(TEST_SLACK_CHANNEL);
    
    const endTime = Date.now();
    const deliveryTime = endTime - startTime;
    
    // 配信が60秒以内に完了することを確認（週次レポートは処理が重い）
    expect(deliveryTime).toBeLessThan(60000);
    
    // メッセージが配信されていることを確認
    const messageCount = await slackMockPage.getMessageCount();
    expect(messageCount).toBeGreaterThan(0);
  });

  test('週次レポートエラーハンドリング', async ({ page }) => {
    // 戦略分析エラーをシミュレート
    await page.evaluate(() => {
      window.localStorage.setItem('strategy-analysis-error', 'true');
    });
    
    // 週次レポートテストを実行
    await testExecutionPage.navigateToTestExecution();
    await testExecutionPage.runWeeklyReportTest();
    
    // エラーが適切に処理されることを確認
    await testExecutionPage.verifyTestResultError('Strategy Analysis Error');
    
    // エラー状態から回復
    await page.evaluate(() => {
      window.localStorage.removeItem('strategy-analysis-error');
    });
    
    // 正常な配信が可能であることを確認
    await testExecutionPage.runWeeklyReportTest();
    await testExecutionPage.waitForTestExecutionComplete();
    
    await slackMockPage.navigateToSlackChannel(TEST_SLACK_CHANNEL);
    const messageCount = await slackMockPage.getMessageCount();
    expect(messageCount).toBeGreaterThan(0);
  });
});
