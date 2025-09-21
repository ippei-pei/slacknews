import { CompanyService } from '../services/companyService.js';
import { SettingsService } from '../services/settingsService.js';
import { NewsCollectionService } from '../services/newsCollectionService.js';
import { NewsRepository } from '../repositories/newsRepository.js';
import { ReportService } from '../services/reportService.js';
import { SlackClient } from '../clients/slack.js';

declare global {
  namespace Express {
    interface Request {
      services?: {
        companyService: CompanyService;
        settingsService: SettingsService;
        newsCollectionService: NewsCollectionService;
        newsRepository: NewsRepository;
        reportService: ReportService;
        slackClient: SlackClient;
      };
    }
  }
}
