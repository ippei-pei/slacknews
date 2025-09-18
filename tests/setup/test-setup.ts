import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../page-objects/LoginPage';
import { CompanyManagementPage } from '../page-objects/CompanyManagementPage';
import { SettingsPage } from '../page-objects/SettingsPage';
import { TEST_COMPANIES, TEST_CONTEXT, TEST_SLACK_CHANNEL, TEST_ERROR_USER } from '../test-data';

/**
 * テストセットアップ
 * 全テストの前提条件を設定
 */

// テスト前のセットアップ
export const setupTest = async (page: any) => {
  // テスト用のローカルストレージをクリア
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  
  // テスト用のシステム状態を設定
  await page.evaluate(() => {
    window.localStorage.setItem('system-status', 'running');
    window.localStorage.setItem('db-integrity-status', 'ok');
    window.localStorage.setItem('system-cpu-usage', '45');
    window.localStorage.setItem('system-memory-usage', '60');
    window.localStorage.setItem('system-response-time', '1500');
    window.localStorage.setItem('system-error-rate', '0.5');
  });
};

// 全シナリオの前提条件を設定
export const setupAllScenarios = async (page: any) => {
  await setupTest(page);
  
  const loginPage = new LoginPage(page);
  const companyManagementPage = new CompanyManagementPage(page);
  const settingsPage = new SettingsPage(page);
  
  // ログイン
  await page.goto('/login');
  await loginPage.clickSlackAuth();
  await loginPage.completeSlackAuth();
  await loginPage.verifySuccessfulLogin();
  
  // 企業登録
  await companyManagementPage.navigateToCompanyManagement();
  for (const company of TEST_COMPANIES) {
    await companyManagementPage.clickAddCompany();
    await companyManagementPage.fillCompanyForm(company);
    await companyManagementPage.saveCompany();
    await companyManagementPage.verifyCompanyInList(company.name);
  }
  
  // 設定
  await settingsPage.navigateToSettings();
  await settingsPage.setContext(TEST_CONTEXT);
  await settingsPage.openSlackChannelSelect();
  await settingsPage.selectSlackChannel(TEST_SLACK_CHANNEL);
  await settingsPage.saveSlackSettings();
  await settingsPage.setErrorNotificationUser(TEST_ERROR_USER);
  
  // ダッシュボードに戻る
  await page.goto('/dashboard');
};

// エラー状態のシミュレーション
export const simulateError = async (page: any, errorType: string) => {
  await page.evaluate((type: string) => {
    window.localStorage.setItem(`${type}-error`, 'true');
  }, errorType);
};

// エラー状態の解除
export const clearError = async (page: any, errorType: string) => {
  await page.evaluate((type: string) => {
    window.localStorage.removeItem(`${type}-error`);
  }, errorType);
};

// テスト用のモックデータを設定
export const setupMockData = async (page: any) => {
  await page.evaluate(() => {
    // テスト用のニュースデータを設定
    window.localStorage.setItem('mock-news-data', JSON.stringify([
      {
        companyId: "pokemon_company",
        title: "Pokemon TCG Live Platform Updates",
        titleJp: "ポケモンTCG Liveプラットフォームアップデート",
        summaryJp: "ポケモン公式がTCG Liveプラットフォームの新機能を発表しました。",
        newsSummaryJp: "【Pokemon】TCG Live新機能 - デジタルカード取引機能強化",
        importance: 88,
        url: "https://www.pokemon.com/us/pokemon-news/tcg-live-updates",
        sourceUrls: [
          {
            url: "https://www.pokemon.com/us/pokemon-news/tcg-live-updates",
            title: "Pokemon TCG Live Platform Updates",
            source: "Pokemon Official"
          }
        ]
      }
    ]));
    
    // テスト用のSlackチャンネルデータを設定
    window.localStorage.setItem('mock-slack-channels', JSON.stringify([
      { id: 'C1234567890', name: '#test-competitor-intelligence' },
      { id: 'C0987654321', name: '#general' }
    ]));
  });
};

// テスト実行ログの設定
export const setupTestLogs = async (page: any) => {
  await page.evaluate(() => {
    window.localStorage.setItem('test-execution-log', JSON.stringify([
      '情報取得開始',
      'LLM重複排除完了',
      'LLM翻訳完了',
      'LLM要約完了',
      'LLM重要度評価完了',
      '情報取得完了',
      '日次レポート生成完了',
      'Slack配信完了'
    ]));
  });
};

// テスト用のSlackメッセージを設定
export const setupSlackMessages = async (page: any, channelName: string) => {
  await page.evaluate((channel: string) => {
    const messages = [
      {
        type: 'main',
        content: '📊 競合情報レポート (45件)\n\n1. <https://www.pokemon.com/us/pokemon-news/tcg-live-updates|【Pokemon】TCG Live新機能 - デジタルカード取引機能強化>\n2. <https://dena.com/intl/news/pokemon-pocket-update|【DeNA】ポケポケ新機能 - AR対戦とデジタルパック販売開始>'
      },
      {
        type: 'thread',
        content: '3. <https://nianticlabs.com/blog/pokemon-go-tcg-integration|【Niantic】Pokemon GO Plus+ TCG連携 - デジタルカード獲得機能>'
      }
    ];
    
    window.localStorage.setItem(`slack-messages-${channel}`, JSON.stringify(messages));
  }, channelName);
};

// テスト用のエラーメッセージを設定
export const setupErrorMessage = async (page: any, errorType: string) => {
  await page.evaluate((type: string) => {
    const errorMessages = {
      'slack-auth-error': 'Slack認証に失敗しました',
      'slack-delivery-error': 'Slack配信に失敗しました',
      'llm-processing-error': 'LLM処理に失敗しました',
      'external-api-error': '外部API接続に失敗しました',
      'database-connection-error': 'データベース接続に失敗しました'
    };
    
    window.localStorage.setItem(`error-message-${type}`, errorMessages[type] || 'エラーが発生しました');
  }, errorType);
};
