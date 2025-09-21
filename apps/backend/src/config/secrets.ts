import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { logger } from '../logger.js';

let secretClient: SecretManagerServiceClient | null = null;

export const getSecretClient = (): SecretManagerServiceClient => {
  if (secretClient) {
    return secretClient;
  }
  secretClient = new SecretManagerServiceClient();
  return secretClient;
};

export interface SecretConfig {
  slackBotToken: string;
  openAiApiKey: string;
  googleProjectId: string;
  slackSigningSecret?: string;
}

export const getSecretsFromSecretManager = async (projectId: string): Promise<Partial<SecretConfig>> => {
  const client = getSecretClient();
  const secrets: Partial<SecretConfig> = {};

  const secretNames = [
    'slack-bot-token',
    'openai-api-key',
    'slack-signing-secret'
  ];

  for (const secretName of secretNames) {
    try {
      const [version] = await client.accessSecretVersion({
        name: `projects/${projectId}/secrets/${secretName}/versions/latest`
      });

      const secretValue = version.payload?.data?.toString();
      if (secretValue) {
        switch (secretName) {
          case 'slack-bot-token':
            secrets.slackBotToken = secretValue;
            break;
          case 'openai-api-key':
            secrets.openAiApiKey = secretValue;
            break;
          case 'slack-signing-secret':
            secrets.slackSigningSecret = secretValue;
            break;
        }
        logger.info({ secretName }, 'Secret loaded from Secret Manager');
      }
    } catch (error) {
      logger.warn({ err: error, secretName }, 'Failed to load secret from Secret Manager');
    }
  }

  return secrets;
};

export const getSecretsFromEnv = (): Partial<SecretConfig> => {
  return {
    slackBotToken: process.env.SLACK_BOT_TOKEN,
    openAiApiKey: process.env.OPENAI_API_KEY,
    googleProjectId: process.env.GOOGLE_CLOUD_PROJECT,
    slackSigningSecret: process.env.SLACK_SIGNING_SECRET
  };
};

export const getSecrets = async (): Promise<SecretConfig> => {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  
  let secrets: Partial<SecretConfig> = {};

  // 本番環境では Secret Manager を優先
  if (projectId && process.env.NODE_ENV === 'production') {
    secrets = await getSecretsFromSecretManager(projectId);
  }

  // 環境変数から取得（Secret Manager で取得できなかった分を補完）
  const envSecrets = getSecretsFromEnv();
  secrets = { ...envSecrets, ...secrets };

  // 必須項目のチェック
  const requiredSecrets = ['slackBotToken', 'openAiApiKey', 'googleProjectId'];
  const missingSecrets = requiredSecrets.filter(key => !secrets[key as keyof SecretConfig]);

  if (missingSecrets.length > 0) {
    throw new Error(`必須のシークレットが設定されていません: ${missingSecrets.join(', ')}`);
  }

  return secrets as SecretConfig;
};
