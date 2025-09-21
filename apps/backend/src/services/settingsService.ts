import { SettingsRepository } from '../repositories/settingsRepository.js';
import { ErrorNotificationSettings, SlackSettings } from '../domain/types.js';

export class SettingsService {
  constructor(private readonly settingsRepository: SettingsRepository) {}

  getContext() {
    return this.settingsRepository.getContext();
  }

  setContext(value: string, updatedBy?: string) {
    return this.settingsRepository.setContext(value, updatedBy);
  }

  getSlackSettings() {
    return this.settingsRepository.getSlackSettings();
  }

  setSlackSettings(settings: SlackSettings) {
    return this.settingsRepository.setSlackSettings({
      ...settings,
      updatedAt: settings.updatedAt ?? new Date()
    });
  }

  getErrorNotification() {
    return this.settingsRepository.getErrorNotification();
  }

  setErrorNotification(settings: ErrorNotificationSettings) {
    return this.settingsRepository.setErrorNotification({
      ...settings,
      updatedAt: settings.updatedAt ?? new Date()
    });
  }
}

