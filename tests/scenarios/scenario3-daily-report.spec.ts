import { test, expect } from '@playwright/test';
import { SlackMockPage } from '../page-objects/SlackMockPage';
import { TestExecutionPage } from '../page-objects/TestExecutionPage';
import { TestHelpers } from '../helpers/test-helpers';
import { TEST_SLACK_CHANNEL, TEST_NEWS_ARTICLES } from '../test-data';

/**
 * シナリオ3: 日次レポート配信確認
 * Slack配信内容とバックエンド処理の確認
 */
test.describe('シナリオ3: 日次レポート配信確認', () => {
  let slackMockPage: SlackMockPage;
  let testExecutionPage: TestExecutionPage;
  let testHelpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    slackMockPage = new SlackMockPage(page);
    testExecutionPage = new TestExecutionPage(page);
    testHelpers = new TestHelpers(page);
    
    // 前提条件: シナリオ2の日次レポートテストが完了している
    await page.goto('/dashboard');
  });

  test('日次レポート配信内容確認', async ({ page }) => {
    // 日次レポートテストを実行
    await testExecutionPage.navigateToTestExecution();
    await testExecutionPage.runDailyReportTest();
    await testExecutionPage.waitForTestExecutionComplete();
    
    // Slackチャンネルに移動
    await slackMockPage.navigateToSlackChannel(TEST_SLACK_CHANNEL);
    
    // 最新メッセージを取得
    const latestMessage = await slackMockPage.getLatestMessage();
    
    // 本文投稿の確認
    await slackMockPage.verifyDailyReportFormat(latestMessage);
    await slackMockPage.verifyJapaneseContent(latestMessage);
    await slackMockPage.verifySourceLinks(latestMessage);
    await slackMockPage.verifyNoImportanceScoreDisplay(latestMessage);
    await slackMockPage.verifyTop10ArticlesInMainMessage(latestMessage);
    
    // スレッド投稿の確認
    await slackMockPage.verifyThreadMessages();
    
    // バックエンド処理確認
    await testHelpers.verifyBackendProcessing(TEST_NEWS_ARTICLES);
  });

  test('日次レポート配信形式の詳細確認', async ({ page }) => {
    // 日次レポートテストを実行
    await testExecutionPage.navigateToTestExecution();
    await testExecutionPage.runDailyReportTest();
    await testExecutionPage.waitForTestExecutionComplete();
    
    // Slackチャンネルに移動
    await slackMockPage.navigateToSlackChannel(TEST_SLACK_CHANNEL);
    
    // メッセージ数を取得
    const messageCount = await slackMockPage.getMessageCount();
    expect(messageCount).toBeGreaterThan(0);
    
    // 最新メッセージの詳細確認
    const latestMessage = await slackMockPage.getLatestMessage();
    
    // 件数表示の確認
    expect(latestMessage).toMatch(/📊 競合情報レポート \(\d+件\)/);
    
    // 重要度上位10件の確認
    const linkMatches = latestMessage.match(/<[^|]+\|[^>]+>/g);
    if (linkMatches) {
      expect(linkMatches.length).toBeLessThanOrEqual(10);
    }
    
    // 日本語コンテンツの確認
    expect(latestMessage).toMatch(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/);
    
    // ソースリンクの確認
    expect(latestMessage).toMatch(/<https?:\/\/[^|]+\|[^>]+>/);
  });

  test('スレッド投稿内容の確認', async ({ page }) => {
    // 日次レポートテストを実行
    await testExecutionPage.navigateToTestExecution();
    await testExecutionPage.runDailyReportTest();
    await testExecutionPage.waitForTestExecutionComplete();
    
    // Slackチャンネルに移動
    await slackMockPage.navigateToSlackChannel(TEST_SLACK_CHANNEL);
    
    // スレッドメッセージの確認
    await slackMockPage.verifyThreadMessages();
    
    // スレッドメッセージの内容確認
    const threadMessages = await page.locator('[data-testid="thread-message-item"]').allTextContents();
    
    for (const message of threadMessages) {
      // 各スレッドメッセージにリンクが含まれているか確認
      expect(message).toMatch(/<[^|]+\|[^>]+>/);
      
      // 日本語コンテンツの確認
      expect(message).toMatch(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/);
      
      // 重要度スコアが表示されていないか確認
      expect(message).not.toMatch(/\d+点/);
      expect(message).not.toMatch(/\d+pt/);
    }
  });

  test('重複排除の確認', async ({ page }) => {
    // 日次レポートテストを実行
    await testExecutionPage.navigateToTestExecution();
    await testExecutionPage.runDailyReportTest();
    await testExecutionPage.waitForTestExecutionComplete();
    
    // Slackチャンネルに移動
    await slackMockPage.navigateToSlackChannel(TEST_SLACK_CHANNEL);
    
    // 全てのメッセージを取得
    const allMessages = await page.locator('[data-testid="message-item"], [data-testid="thread-message-item"]').allTextContents();
    
    // 重複排除の確認
    await slackMockPage.verifyDuplicateRemoval(allMessages);
    
    // バックエンド処理確認
    await testHelpers.verifyBackendProcessing(TEST_NEWS_ARTICLES);
  });

  test('配信タイミングの確認', async ({ page }) => {
    const startTime = Date.now();
    
    // 日次レポートテストを実行
    await testExecutionPage.navigateToTestExecution();
    await testExecutionPage.runDailyReportTest();
    await testExecutionPage.waitForTestExecutionComplete();
    
    // Slackチャンネルに移動
    await slackMockPage.navigateToSlackChannel(TEST_SLACK_CHANNEL);
    
    const endTime = Date.now();
    const deliveryTime = endTime - startTime;
    
    // 配信が30秒以内に完了することを確認
    expect(deliveryTime).toBeLessThan(30000);
    
    // メッセージが配信されていることを確認
    const messageCount = await slackMockPage.getMessageCount();
    expect(messageCount).toBeGreaterThan(0);
  });

  test('配信エラーハンドリング', async ({ page }) => {
    // Slack接続エラーをシミュレート
    await page.evaluate(() => {
      window.localStorage.setItem('slack-connection-error', 'true');
    });
    
    // 日次レポートテストを実行
    await testExecutionPage.navigateToTestExecution();
    await testExecutionPage.runDailyReportTest();
    
    // エラーが適切に処理されることを確認
    await testExecutionPage.verifyTestResultError('Slack Connection Error');
    
    // エラー状態から回復
    await page.evaluate(() => {
      window.localStorage.removeItem('slack-connection-error');
    });
    
    // 正常な配信が可能であることを確認
    await testExecutionPage.runDailyReportTest();
    await testExecutionPage.waitForTestExecutionComplete();
    
    await slackMockPage.navigateToSlackChannel(TEST_SLACK_CHANNEL);
    const messageCount = await slackMockPage.getMessageCount();
    expect(messageCount).toBeGreaterThan(0);
  });
});
