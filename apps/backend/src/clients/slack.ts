import axios, { AxiosInstance } from 'axios';
import { AppConfig } from '../config/env.js';
import { logger } from '../logger.js';

export interface SlackMessageOptions {
  channel: string;
  text: string;
  threadTs?: string;
  blocks?: any[];
}

export class SlackClient {
  private http: AxiosInstance;

  constructor(config: AppConfig) {
    if (!config.slackBotToken) {
      throw new Error('SLACK_BOT_TOKEN is not configured');
    }

    this.http = axios.create({
      baseURL: 'https://slack.com/api',
      headers: {
        Authorization: `Bearer ${config.slackBotToken}`
      }
    });
  }

  async postMessage({ channel, text, threadTs, blocks }: SlackMessageOptions) {
    const response = await this.http.post('/chat.postMessage', {
      channel,
      text,
      thread_ts: threadTs,
      blocks
    });

    if (!response.data.ok) {
      logger.error({ err: response.data }, 'Slack API error');
    }

    return response.data;
  }

  async listConversations(cursor?: string) {
    const response = await this.http.get('/conversations.list', {
      params: {
        types: 'public_channel,private_channel',
        cursor
      }
    });

    return response.data;
  }
}

