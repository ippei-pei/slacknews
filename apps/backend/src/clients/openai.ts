import OpenAI from 'openai';
import { AppConfig } from '../config/env.js';

let openAiClient: OpenAI | null = null;

export const getOpenAiClient = (config: AppConfig): OpenAI => {
  if (openAiClient) {
    return openAiClient;
  }

  if (!config.openAiApiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  openAiClient = new OpenAI({ apiKey: config.openAiApiKey });
  return openAiClient;
};

