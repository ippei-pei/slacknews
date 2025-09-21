import OpenAI from 'openai';
import { AppConfig } from '../config/env.js';
import { logger } from '../logger.js';

export interface LlmArticleInput {
  companyName: string;
  title: string;
  link: string;
  contentSnippet: string;
  publishedAt?: string;
  context?: string | null;
}

export interface LlmArticleOutput {
  titleJp: string;
  summaryJp: string;
  newsSummaryJp: string;
  importance: number;
  categories: string[];
  llmVersion: string;
}

export class LlmService {
  private client: OpenAI;

  constructor(private readonly config: AppConfig) {
    if (!config.openAiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    this.client = new OpenAI({ apiKey: config.openAiApiKey });
  }

  async processArticle(input: LlmArticleInput): Promise<LlmArticleOutput> {
    try {
      const prompt = this.buildPrompt(input);
      const response = await this.client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content:
              'あなたは英語ニュースを日本語で要約し重要度を評価するアナリストです。出力フォーマットを JSON のみで返してください。'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const output = response.choices[0]?.message?.content;
      if (!output) {
        throw new Error('LLM response is empty');
      }

      const parsed = JSON.parse(output);
      return {
        titleJp: parsed.title_jp,
        summaryJp: parsed.summary_jp,
        newsSummaryJp: parsed.news_summary_jp,
        importance: parsed.importance,
        categories: parsed.categories,
        llmVersion: response.model ?? 'openai-unknown'
      };
    } catch (error) {
      logger.error({ err: error }, 'LLM processing failed');
      throw error instanceof Error ? error : new Error('LLM processing failed');
    }
  }

  async processBatchArticles(inputs: LlmArticleInput[]): Promise<LlmArticleOutput[]> {
    const results: LlmArticleOutput[] = [];
    
    // バッチ処理で効率化（最大5件ずつ）
    const batchSize = 5;
    for (let i = 0; i < inputs.length; i += batchSize) {
      const batch = inputs.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(input => this.processArticle(input).catch(error => {
          logger.error({ err: error, input }, 'Batch processing failed for article');
          // エラー時はフォールバック処理
          return this.createFallbackOutput(input);
        }))
      );
      results.push(...batchResults);
    }
    
    return results;
  }

  private createFallbackOutput(input: LlmArticleInput): LlmArticleOutput {
    return {
      titleJp: input.title, // 原文のまま
      summaryJp: `【${input.companyName}】記事の詳細分析に失敗しました。`,
      newsSummaryJp: `【${input.companyName}】${input.title}`,
      importance: 50, // デフォルト値
      categories: ['その他'],
      llmVersion: 'fallback'
    };
  }

  private buildPrompt(input: LlmArticleInput): string {
    const context = input.context || 'デジタルカード・NFTプラットフォーム競合の動向を把握するため、新プラットフォーム発表、パートナーシップ、技術革新、ユーザー数・売上実績、規制対応、NFT市場動向を重視する。';
    
    return `以下の記事を分析し、JSON形式で結果を返してください。

【分析対象記事】
企業: ${input.companyName}
タイトル: ${input.title}
URL: ${input.link}
公開日: ${input.publishedAt || '不明'}
内容: ${input.contentSnippet}

【分析コンテキスト】
${context}

【出力形式（JSONのみ）】
{
  "title_jp": "日本語タイトル（必要に応じて翻訳・要約）",
  "summary_jp": "200文字以内の詳細要約",
  "news_summary_jp": "50文字以内の見出し形式の要約",
  "importance": 0-100の重要度スコア,
  "categories": ["事業戦略", "技術", "人事", "財務", "パートナーシップ", "規制", "その他"]
}

【重要度評価基準】
- 90-100: 業界を変革する可能性のある重要発表
- 80-89: 戦略的な意思決定に影響する重要情報
- 70-79: 競合分析に有用な情報
- 60-69: 参考程度の情報
- 50以下: 軽微な情報

必ずJSON形式のみで回答してください。`;
  }
}

