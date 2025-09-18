import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * 設定ページクラス
 * 情報収集コンテキストとSlack配信設定をテスト
 */
export class SettingsPage extends BasePage {
  private get contextInput(): Locator {
    return this.page.locator('[data-testid="context-input"]');
  }

  private get saveContextButton(): Locator {
    return this.page.locator('[data-testid="save-context-button"]');
  }

  private get slackChannelSelect(): Locator {
    return this.page.locator('[data-testid="slack-channel-select"]');
  }

  private get slackChannelList(): Locator {
    return this.page.locator('[data-testid="slack-channel-list"]');
  }

  private get slackChannelItem(): Locator {
    return this.page.locator('[data-testid="slack-channel-item"]');
  }

  private get selectChannelButton(): Locator {
    return this.page.locator('[data-testid="select-channel-button"]');
  }

  private get saveSlackSettingsButton(): Locator {
    return this.page.locator('[data-testid="save-slack-settings-button"]');
  }

  private get errorNotificationUserInput(): Locator {
    return this.page.locator('[data-testid="error-notification-user-input"]');
  }

  private get saveErrorNotificationButton(): Locator {
    return this.page.locator('[data-testid="save-error-notification-button"]');
  }

  constructor(page: Page) {
    super(page);
  }

  async navigateToSettings(): Promise<void> {
    await this.page.locator('[data-testid="settings-menu"]').click();
    await this.contextInput.waitFor({ state: 'visible' });
  }

  async setContext(context: string): Promise<void> {
    await this.contextInput.fill(context);
    await this.saveContextButton.click();
    await this.waitForSuccessMessage();
  }

  async verifyContextSaved(expectedContext: string): Promise<void> {
    const currentValue = await this.contextInput.inputValue();
    if (currentValue !== expectedContext) {
      throw new Error(`Expected context "${expectedContext}", but found "${currentValue}"`);
    }
  }

  async openSlackChannelSelect(): Promise<void> {
    await this.slackChannelSelect.click();
    await this.slackChannelList.waitFor({ state: 'visible' });
  }

  async selectSlackChannel(channelName: string): Promise<void> {
    const channelItem = this.slackChannelItem.locator(`text=${channelName}`);
    await channelItem.click();
    await this.selectChannelButton.click();
  }

  async verifySlackChannelSelected(channelName: string): Promise<void> {
    const selectedChannel = this.slackChannelSelect.locator(`text=${channelName}`);
    await selectedChannel.waitFor({ state: 'visible' });
  }

  async saveSlackSettings(): Promise<void> {
    await this.saveSlackSettingsButton.click();
    await this.waitForSuccessMessage();
  }

  async setErrorNotificationUser(user: string): Promise<void> {
    await this.errorNotificationUserInput.fill(user);
    await this.saveErrorNotificationButton.click();
    await this.waitForSuccessMessage();
  }

  async verifyErrorNotificationUser(expectedUser: string): Promise<void> {
    const currentValue = await this.errorNotificationUserInput.inputValue();
    if (currentValue !== expectedUser) {
      throw new Error(`Expected error notification user "${expectedUser}", but found "${currentValue}"`);
    }
  }
}
