"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateToJapanese = translateToJapanese;
const context_1 = require("../context");
const config_1 = require("../config");
/**
 * OpenAI Chat Completionsを使用した日本語翻訳関数
 * @param text 翻訳対象のテキスト
 * @returns 翻訳された日本語テキスト
 */
async function translateToJapanese(text) {
    var _a, _b, _c;
    try {
        context_1.logger.info('Starting translation process...');
        // Secret ManagerからAPIキーとURLを取得
        const OPENAI_API_KEY = context_1.openaiApiKey.value();
        const OPENAI_API_URL = context_1.openaiApiUrl.value();
        context_1.logger.info(`API Key exists: ${!!OPENAI_API_KEY}`);
        context_1.logger.info(`API Key length: ${OPENAI_API_KEY ? OPENAI_API_KEY.length : 0}`);
        context_1.logger.info(`API Key prefix: ${OPENAI_API_KEY ? OPENAI_API_KEY.substring(0, 10) + '...' : 'N/A'}`);
        if (!OPENAI_API_KEY) {
            throw new Error('OpenAI API key is required for translation. Please set openai-api-key secret in Secret Manager.');
        }
        context_1.logger.info(`Translating text: ${text.substring(0, config_1.config.text.maxTitleLength)}...`);
        const requestBody = {
            model: config_1.config.ai.model,
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
            max_tokens: config_1.config.ai.maxTokens,
            temperature: config_1.config.ai.temperature,
        };
        context_1.logger.info(`Request body: ${JSON.stringify(requestBody, null, 2)}`);
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });
        context_1.logger.info(`Response status: ${response.status}`);
        context_1.logger.info(`Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);
        if (!response.ok) {
            const errorText = await response.text();
            context_1.logger.error(`OpenAI API error response: ${errorText}`);
            throw new Error(`OpenAI API error: ${response.status} - ${response.statusText} - ${errorText}`);
        }
        const data = await response.json();
        context_1.logger.info(`Response data: ${JSON.stringify(data, null, 2)}`);
        const translatedText = (_c = (_b = (_a = data.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.trim();
        if (!translatedText) {
            context_1.logger.error('No translation received from OpenAI API');
            throw new Error('No translation received from OpenAI API');
        }
        context_1.logger.info(`Translation successful: ${translatedText.substring(0, config_1.config.text.maxTitleLength)}...`);
        return translatedText;
    }
    catch (error) {
        context_1.logger.error('Translation error:', error);
        throw error;
    }
}
//# sourceMappingURL=translate.js.map