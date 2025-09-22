import { logger, openaiApiKey, openaiApiUrl } from '../context';
import { config } from '../config';

/**
 * OpenAI Chat Completionsを使用した日本語翻訳関数
 * @param text 翻訳対象のテキスト
 * @returns 翻訳された日本語テキスト
 */
export async function translateToJapanese(text: string): Promise<string> {
  try {
    logger.info('Starting translation process...');
    
    // Secret ManagerからAPIキーとURLを取得
    const OPENAI_API_KEY = openaiApiKey.value();
    const OPENAI_API_URL = openaiApiUrl.value();
    
    logger.info(`API Key exists: ${!!OPENAI_API_KEY}`);
    logger.info(`API Key length: ${OPENAI_API_KEY ? OPENAI_API_KEY.length : 0}`);
    logger.info(`API Key prefix: ${OPENAI_API_KEY ? OPENAI_API_KEY.substring(0, 10) + '...' : 'N/A'}`);
    
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key is required for translation. Please set openai-api-key secret in Secret Manager.');
    }

    logger.info(`Translating text: ${text.substring(0, config.text.maxTitleLength)}...`);

    const requestBody = {
      model: config.ai.model,
      messages: [
        {
          role: 'system',
          content: 'あなたは英語から日本語への翻訳専門家です。ニュース記事のタイトルや内容を自然で読みやすい日本語に翻訳してください。'
        },
        {
          role: 'user',
          content: `以下のテキストを日本語に翻訳してください:\n\n${text}`
        }
      ],
      max_tokens: config.ai.maxTokens,
      temperature: config.ai.temperature,
    };

    logger.info(`Request body: ${JSON.stringify(requestBody, null, 2)}`);

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    logger.info(`Response status: ${response.status}`);
    logger.info(`Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`OpenAI API error response: ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status} - ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    logger.info(`Response data: ${JSON.stringify(data, null, 2)}`);
    
    const translatedText = data.choices[0]?.message?.content?.trim();
    
    if (!translatedText) {
      logger.error('No translation received from OpenAI API');
      throw new Error('No translation received from OpenAI API');
    }

    logger.info(`Translation successful: ${translatedText.substring(0, config.text.maxTitleLength)}...`);
    return translatedText;
    
  } catch (error) {
    logger.error('Translation error:', error);
    throw error;
  }
}
