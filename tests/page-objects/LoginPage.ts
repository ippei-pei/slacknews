import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * ログインページクラス
 * Slack認証機能をテスト
 */
export class LoginPage extends BasePage {
  private get slackAuthButton(): Locator {
    return this.page.locator('[data-testid="slack-auth-button"]');
  }

  private get slackAuthModal(): Locator {
    return this.page.locator('[data-testid="slack-auth-modal"]');
  }

  private get slackAuthSuccess(): Locator {
    return this.page.locator('[data-testid="slack-auth-success"]');
  }

  private get dashboardRedirect(): Locator {
    return this.page.locator('[data-testid="dashboard-redirect"]');
  }

  constructor(page: Page) {
    super(page);
  }

  async clickSlackAuth(): Promise<void> {
    await this.slackAuthButton.click();
    await this.slackAuthModal.waitFor({ state: 'visible' });
  }

  async completeSlackAuth(): Promise<void> {
    // Slack認証フローをシミュレート
    await this.page.evaluate(() => {
      // 認証成功をシミュレート
      window.dispatchEvent(new CustomEvent('slack-auth-success', {
        detail: { user: { name: 'Test User', id: 'test-user-id' } }
      }));
    });
    
    await this.slackAuthSuccess.waitFor({ state: 'visible' });
  }

  async verifySuccessfulLogin(): Promise<void> {
    await this.dashboardRedirect.waitFor({ state: 'visible' });
    await this.waitForSuccessMessage();
  }

  async verifyLoginPageLoaded(): Promise<void> {
    await this.slackAuthButton.waitFor({ state: 'visible' });
  }
}
