import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * テスト実行ページクラス
 * 情報取得・配信テスト機能をテスト
 */
export class TestExecutionPage extends BasePage {
  private get allCompaniesInfoTestButton(): Locator {
    return this.page.locator('[data-testid="all-companies-info-test-button"]');
  }

  private get dailyReportTestButton(): Locator {
    return this.page.locator('[data-testid="daily-report-test-button"]');
  }

  private get weeklyReportTestButton(): Locator {
    return this.page.locator('[data-testid="weekly-report-test-button"]');
  }

  private get testResults(): Locator {
    return this.page.locator('[data-testid="test-results"]');
  }

  private get testResultItem(): Locator {
    return this.page.locator('[data-testid="test-result-item"]');
  }

  private get testExecutionLog(): Locator {
    return this.page.locator('[data-testid="test-execution-log"]');
  }

  private get testProgressBar(): Locator {
    return this.page.locator('[data-testid="test-progress-bar"]');
  }

  constructor(page: Page) {
    super(page);
  }

  async navigateToTestExecution(): Promise<void> {
    await this.page.locator('[data-testid="test-execution-menu"]').click();
    await this.allCompaniesInfoTestButton.waitFor({ state: 'visible' });
  }

  async runAllCompaniesInfoTest(): Promise<void> {
    await this.allCompaniesInfoTestButton.click();
    await this.waitForLoadingToComplete();
  }

  async runDailyReportTest(): Promise<void> {
    await this.dailyReportTestButton.click();
    await this.waitForLoadingToComplete();
  }

  async runWeeklyReportTest(): Promise<void> {
    await this.weeklyReportTestButton.click();
    await this.waitForLoadingToComplete();
  }

  async verifyTestResults(expectedCompanyCount: number): Promise<void> {
    await this.testResults.waitFor({ state: 'visible' });
    
    const resultItems = this.testResultItem;
    await resultItems.first().waitFor({ state: 'visible' });
    
    const count = await resultItems.count();
    if (count !== expectedCompanyCount) {
      throw new Error(`Expected ${expectedCompanyCount} test results, but found ${count}`);
    }
  }

  async verifyTestResultSuccess(companyName: string): Promise<void> {
    const resultItem = this.testResultItem.locator(`text=${companyName}`).locator('..');
    await resultItem.locator('[data-testid="test-success"]').waitFor({ state: 'visible' });
  }

  async verifyTestResultError(companyName: string): Promise<void> {
    const resultItem = this.testResultItem.locator(`text=${companyName}`).locator('..');
    await resultItem.locator('[data-testid="test-error"]').waitFor({ state: 'visible' });
  }

  async getTestExecutionLog(): Promise<string> {
    await this.testExecutionLog.waitFor({ state: 'visible' });
    return await this.testExecutionLog.textContent() || '';
  }

  async verifyTestProgressComplete(): Promise<void> {
    await this.testProgressBar.waitFor({ state: 'hidden' });
  }

  async waitForTestExecutionComplete(): Promise<void> {
    await this.waitForLoadingToComplete();
    await this.verifyTestProgressComplete();
  }
}
