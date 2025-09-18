import { Page, Locator } from '@playwright/test';

/**
 * ベースページクラス
 * 共通の要素とメソッドを定義
 */
export class BasePage {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // 共通要素
  protected get loadingSpinner(): Locator {
    return this.page.locator('[data-testid="loading-spinner"]');
  }

  protected get successMessage(): Locator {
    return this.page.locator('[data-testid="success-message"]');
  }

  protected get errorMessage(): Locator {
    return this.page.locator('[data-testid="error-message"]');
  }

  protected get notificationToast(): Locator {
    return this.page.locator('[data-testid="notification-toast"]');
  }

  // 共通メソッド
  async waitForLoadingToComplete(): Promise<void> {
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 30000 });
  }

  async waitForSuccessMessage(): Promise<void> {
    await this.successMessage.waitFor({ state: 'visible', timeout: 10000 });
  }

  async waitForErrorMessage(): Promise<void> {
    await this.errorMessage.waitFor({ state: 'visible', timeout: 10000 });
  }

  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
  }

  async navigateTo(url: string): Promise<void> {
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
  }
}
