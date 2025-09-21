import { config as loadEnv } from 'dotenv';
import { getSecrets, SecretConfig } from './secrets.js';

loadEnv();

export interface AppConfig extends SecretConfig {
  port: number;
  firestoreEmulatorHost?: string;
  slackDefaultChannel?: string;
}

export const getConfig = async (): Promise<AppConfig> => {
  try {
    // Secret Manager または環境変数からシークレットを取得
    const secrets = await getSecrets();
    
    const config: AppConfig = {
      port: Number(process.env.PORT || 8080),
      firestoreEmulatorHost: process.env.FIRESTORE_EMULATOR_HOST,
      slackDefaultChannel: process.env.SLACK_DEFAULT_CHANNEL,
      ...secrets
    };

    console.log('✅ シークレット設定確認完了');
    return config;
  } catch (error) {
    console.error('❌ シークレット設定エラー:', error instanceof Error ? error.message : 'Unknown error');
    console.error('\n📝 以下のいずれかの方法でシークレットを設定してください:');
    console.error('\n【環境変数（開発環境）】');
    console.error('apps/backend/.env ファイルに以下を設定:');
    console.error('SLACK_BOT_TOKEN=...');
    console.error('OPENAI_API_KEY=...');
    console.error('GOOGLE_CLOUD_PROJECT=...');
    console.error('FIRESTORE_EMULATOR_HOST=localhost:8085   # エミュレータ利用時のみ');
    console.error('\n【Secret Manager（本番環境）】');
    console.error('gcloud secrets create slack-bot-token --data-file=-');
    console.error('gcloud secrets create openai-api-key --data-file=-');
    console.error('gcloud secrets create slack-signing-secret --data-file=-');
    process.exit(1);
  }
};

