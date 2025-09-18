import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { TestCompany } from '../test-data';

/**
 * 企業管理ページクラス
 * 企業登録・編集・削除機能をテスト
 */
export class CompanyManagementPage extends BasePage {
  private get addCompanyButton(): Locator {
    return this.page.locator('[data-testid="add-company-button"]');
  }

  private get companyNameInput(): Locator {
    return this.page.locator('[data-testid="company-name-input"]');
  }

  private get companyUrlInput(): Locator {
    return this.page.locator('[data-testid="company-url-input"]');
  }

  private get companyRssInput(): Locator {
    return this.page.locator('[data-testid="company-rss-input"]');
  }

  private get saveCompanyButton(): Locator {
    return this.page.locator('[data-testid="save-company-button"]');
  }

  private get cancelCompanyButton(): Locator {
    return this.page.locator('[data-testid="cancel-company-button"]');
  }

  private get companyList(): Locator {
    return this.page.locator('[data-testid="company-list"]');
  }

  private get companyItem(): Locator {
    return this.page.locator('[data-testid="company-item"]');
  }

  private get editCompanyButton(): Locator {
    return this.page.locator('[data-testid="edit-company-button"]');
  }

  private get deleteCompanyButton(): Locator {
    return this.page.locator('[data-testid="delete-company-button"]');
  }

  constructor(page: Page) {
    super(page);
  }

  async clickAddCompany(): Promise<void> {
    await this.addCompanyButton.click();
    await this.companyNameInput.waitFor({ state: 'visible' });
  }

  async fillCompanyForm(company: TestCompany): Promise<void> {
    await this.companyNameInput.fill(company.name);
    await this.companyUrlInput.fill(company.url);
    await this.companyRssInput.fill(company.rssUrl);
  }

  async saveCompany(): Promise<void> {
    await this.saveCompanyButton.click();
    await this.waitForLoadingToComplete();
  }

  async cancelCompanyForm(): Promise<void> {
    await this.cancelCompanyButton.click();
  }

  async verifyCompanyInList(companyName: string): Promise<void> {
    const companyItem = this.companyList.locator(`text=${companyName}`);
    await companyItem.waitFor({ state: 'visible' });
  }

  async verifyCompanyCount(expectedCount: number): Promise<void> {
    const companyItems = this.companyItem;
    await companyItems.first().waitFor({ state: 'visible' });
    
    const count = await companyItems.count();
    if (count !== expectedCount) {
      throw new Error(`Expected ${expectedCount} companies, but found ${count}`);
    }
  }

  async editCompany(companyName: string, newData: Partial<TestCompany>): Promise<void> {
    const companyItem = this.companyList.locator(`text=${companyName}`).locator('..');
    await companyItem.locator('[data-testid="edit-company-button"]').click();
    
    if (newData.name) {
      await this.companyNameInput.fill(newData.name);
    }
    if (newData.url) {
      await this.companyUrlInput.fill(newData.url);
    }
    if (newData.rssUrl) {
      await this.companyRssInput.fill(newData.rssUrl);
    }
    
    await this.saveCompany();
  }

  async deleteCompany(companyName: string): Promise<void> {
    const companyItem = this.companyList.locator(`text=${companyName}`).locator('..');
    await companyItem.locator('[data-testid="delete-company-button"]').click();
    
    // 削除確認ダイアログ
    await this.page.locator('[data-testid="confirm-delete-button"]').click();
    await this.waitForLoadingToComplete();
  }

  async verifyCompanyDeleted(companyName: string): Promise<void> {
    const companyItem = this.companyList.locator(`text=${companyName}`);
    await companyItem.waitFor({ state: 'hidden' });
  }

  async navigateToCompanyManagement(): Promise<void> {
    await this.page.locator('[data-testid="company-management-menu"]').click();
    await this.companyList.waitFor({ state: 'visible' });
  }
}
