import OpenAI from 'openai';
import { AppConfig } from '../config/env.js';
import { logger } from '../logger.js';

export interface ArticleForDuplicateCheck {
  id: string;
  title: string;
  contentSnippet: string;
  url: string;
  companyId: string;
}

export interface DuplicateGroup {
  groupId: string;
  articles: ArticleForDuplicateCheck[];
  representativeArticle: ArticleForDuplicateCheck;
  similarityScore: number;
}

export class DuplicateDetectionService {
  private client: OpenAI;

  constructor(private readonly config: AppConfig) {
    if (!config.openAiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    this.client = new OpenAI({ apiKey: config.openAiApiKey });
  }

  async detectDuplicates(articles: ArticleForDuplicateCheck[]): Promise<DuplicateGroup[]> {
    if (articles.length <= 1) {
      return [];
    }

    try {
      const duplicateGroups: DuplicateGroup[] = [];
      const processed = new Set<string>();

      // 記事をペアで比較
      for (let i = 0; i < articles.length; i++) {
        if (processed.has(articles[i].id)) continue;

        const group: ArticleForDuplicateCheck[] = [articles[i]];
        processed.add(articles[i].id);

        for (let j = i + 1; j < articles.length; j++) {
          if (processed.has(articles[j].id)) continue;

          const similarity = await this.calculateSimilarity(articles[i], articles[j]);
          if (similarity > 0.8) { // 80%以上の類似度で重複と判定
            group.push(articles[j]);
            processed.add(articles[j].id);
          }
        }

        if (group.length > 1) {
          const representativeArticle = this.selectRepresentativeArticle(group);
          duplicateGroups.push({
            groupId: `group_${duplicateGroups.length + 1}`,
            articles: group,
            representativeArticle,
            similarityScore: 0.8 // 固定値（実際の計算値に置き換え可能）
          });
        }
      }

      logger.info({ 
        totalArticles: articles.length, 
        duplicateGroups: duplicateGroups.length,
        articlesInGroups: duplicateGroups.reduce((sum, group) => sum + group.articles.length, 0)
      }, 'Duplicate detection completed');

      return duplicateGroups;
    } catch (error) {
      logger.error({ err: error }, 'Duplicate detection failed');
      // エラー時は重複排除をスキップ
      return [];
    }
  }

  private async calculateSimilarity(article1: ArticleForDuplicateCheck, article2: ArticleForDuplicateCheck): Promise<number> {
    try {
      const response = await this.client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: 'あなたは記事の類似度を判定する専門家です。2つの記事が同じ内容を扱っているかを0.0から1.0の数値で評価してください。0.8以上なら同じ内容とみなします。'
          },
          {
            role: 'user',
            content: `記事1: ${article1.title}\n内容: ${article1.contentSnippet}\n\n記事2: ${article2.title}\n内容: ${article2.contentSnippet}\n\n類似度を0.0-1.0の数値のみで回答してください。`
          }
        ]
      });

      const score = parseFloat(response.choices[0]?.message?.content || '0');
      return isNaN(score) ? 0 : Math.max(0, Math.min(1, score));
    } catch (error) {
      logger.warn({ err: error }, 'Similarity calculation failed, using fallback');
      // フォールバック: タイトルの類似度で簡易判定
      return this.calculateTitleSimilarity(article1.title, article2.title);
    }
  }

  private calculateTitleSimilarity(title1: string, title2: string): number {
    const words1 = title1.toLowerCase().split(/\s+/);
    const words2 = title2.toLowerCase().split(/\s+/);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }

  private selectRepresentativeArticle(articles: ArticleForDuplicateCheck[]): ArticleForDuplicateCheck {
    // 最も詳細な内容を持つ記事を代表記事として選択
    return articles.reduce((representative, current) => 
      current.contentSnippet.length > representative.contentSnippet.length ? current : representative
    );
  }

  async mergeDuplicateArticles(duplicateGroups: DuplicateGroup[]): Promise<ArticleForDuplicateCheck[]> {
    const mergedArticles: ArticleForDuplicateCheck[] = [];
    const processedGroups = new Set<string>();

    for (const group of duplicateGroups) {
      if (processedGroups.has(group.groupId)) continue;
      
      const representative = group.representativeArticle;
      const sourceUrls = group.articles.map(article => ({
        url: article.url,
        title: article.title,
        source: article.companyId
      }));

      mergedArticles.push({
        ...representative,
        // 複数ソースの情報を統合
        contentSnippet: `${representative.contentSnippet}\n\n【参考リンク】\n${sourceUrls.map(s => `- ${s.title}: ${s.url}`).join('\n')}`
      });

      processedGroups.add(group.groupId);
    }

    return mergedArticles;
  }
}
