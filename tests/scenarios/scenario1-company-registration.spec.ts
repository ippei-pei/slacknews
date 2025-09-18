import { test, expect } from '@playwright/test';
import { LoginPage } from '../page-objects/LoginPage';
import { CompanyManagementPage } from '../page-objects/CompanyManagementPage';
import { SettingsPage } from '../page-objects/SettingsPage';
import { TEST_COMPANIES, TEST_CONTEXT, TEST_SLACK_CHANNEL, TEST_ERROR_USER } from '../test-data';

/**
 * シナリオ1: 企業登録・基本設定
 * DOPA競合企業の登録とSlack配信設定
 */
test.describe('シナリオ1: 企業登録・基本設定', () => {
  let loginPage: LoginPage;
  let companyManagementPage: CompanyManagementPage;
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    companyManagementPage = new CompanyManagementPage(page);
    settingsPage = new SettingsPage(page);
  });

  test('Slack認証でログイン', async ({ page }) => {
    await page.goto('/login');
    
    // ログインページの確認
    await loginPage.verifyLoginPageLoaded();
    
    // Slack認証の実行
    await loginPage.clickSlackAuth();
    await loginPage.completeSlackAuth();
    
    // 認証成功の確認
    await loginPage.verifySuccessfulLogin();
    
    // ダッシュボードへのリダイレクト確認
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test('企業情報登録（DOPA競合企業）', async ({ page }) => {
    await page.goto('/dashboard');
    
    // 企業管理ページに移動
    await companyManagementPage.navigateToCompanyManagement();
    
    // 3社のDOPA競合企業を順次登録
    for (const company of TEST_COMPANIES) {
      await companyManagementPage.clickAddCompany();
      await companyManagementPage.fillCompanyForm(company);
      await companyManagementPage.saveCompany();
      
      // 企業がリストに追加されたことを確認
      await companyManagementPage.verifyCompanyInList(company.name);
      
      // 成功メッセージの確認
      await companyManagementPage.waitForSuccessMessage();
    }
    
    // 3社全てが登録されたことを確認
    await companyManagementPage.verifyCompanyCount(3);
  });

  test('情報収集コンテキスト登録（DOPA向け）', async ({ page }) => {
    await page.goto('/dashboard');
    
    // 設定ページに移動
    await settingsPage.navigateToSettings();
    
    // コンテキストを設定
    await settingsPage.setContext(TEST_CONTEXT);
    
    // 設定が保存されたことを確認
    await settingsPage.verifyContextSaved(TEST_CONTEXT);
  });

  test('Slack配信チャンネル設定', async ({ page }) => {
    await page.goto('/dashboard');
    
    // 設定ページに移動
    await settingsPage.navigateToSettings();
    
    // チャンネル選択を開く
    await settingsPage.openSlackChannelSelect();
    
    // チャンネルを選択
    await settingsPage.selectSlackChannel(TEST_SLACK_CHANNEL);
    
    // 設定を保存
    await settingsPage.saveSlackSettings();
    
    // チャンネルが選択されたことを確認
    await settingsPage.verifySlackChannelSelected(TEST_SLACK_CHANNEL);
  });

  test('エラー通知対象ユーザー設定', async ({ page }) => {
    await page.goto('/dashboard');
    
    // 設定ページに移動
    await settingsPage.navigateToSettings();
    
    // エラー通知ユーザーを設定
    await settingsPage.setErrorNotificationUser(TEST_ERROR_USER);
    
    // 設定が保存されたことを確認
    await settingsPage.verifyErrorNotificationUser(TEST_ERROR_USER);
  });

  test('企業情報の編集・削除', async ({ page }) => {
    await page.goto('/dashboard');
    
    // 企業管理ページに移動
    await companyManagementPage.navigateToCompanyManagement();
    
    // 最初の企業を編集
    const firstCompany = TEST_COMPANIES[0];
    const updatedCompany = {
      ...firstCompany,
      name: `${firstCompany.name} (Updated)`
    };
    
    await companyManagementPage.editCompany(firstCompany.name, updatedCompany);
    await companyManagementPage.verifyCompanyInList(updatedCompany.name);
    
    // 企業を削除
    await companyManagementPage.deleteCompany(updatedCompany.name);
    await companyManagementPage.verifyCompanyDeleted(updatedCompany.name);
    
    // 残り2社が存在することを確認
    await companyManagementPage.verifyCompanyCount(2);
  });
});
