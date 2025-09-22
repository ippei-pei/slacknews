import { logger, db, slackBotToken, openaiApiKey, openaiApiUrl } from '../context';
import { NewsArticle, SlackSettings, WeeklyReportData } from '../types';
import { postToSlackChannel } from '../utils/slack';
import { toJstStartOfDay, toJstEndOfDay, getWeekStart, getWeekEnd } from '../utils/date';
import { config } from '../config';

/**
 * 日次レポート配信の共通サービス関数
 */
export async function executeDailyReport(targetDate?: string): Promise<{ success: boolean; message: string }> {
  try {
    const date = targetDate || new Date().toISOString().split('T')[0];
    
    logger.info(`Starting daily report delivery for ${date}...`);

    // 指定日の記事を取得
    const startOfDay = toJstStartOfDay(date);
    const endOfDay = toJstEndOfDay(date);

    const newsSnapshot = await db.collection("news").get();
    const dailyNews = newsSnapshot.docs.filter(doc => {
      const data = doc.data() as NewsArticle;
      const articleDate = new Date(data.publishedAt);
      return articleDate >= startOfDay && articleDate <= endOfDay;
    }).map(doc => doc.data() as NewsArticle);

    // LLMで日次サマリを生成
    const articlesForPrompt = dailyNews.map(a => ({
      id: a.id,
      company: a.companyId,
      title: a.isTranslated ? (a.translatedTitle || a.title) : a.title,
      content: ((a.isTranslated ? (a.translatedContent || a.translatedSummary) : (a.content || a.summary)) || '').slice(0, 400),
      category: a.category,
      publishedAt: a.publishedAt
    }));

    const OPENAI_API_KEY = openaiApiKey.value();
    const OPENAI_API_URL = openaiApiUrl.value();
    const model = config.ai.model;

    const systemPrompt = "あなたは日本語のビジネスアナリストです。Slack投稿用に簡潔な日次サマリを日本語で出力します。";
    const userPrompt = `以下の本日の記事一覧から、Slackに投稿する日次サマリ文（約200文字）を生成してください。\n- 統計や重要度の記載は不要\n- 見出しや装飾は不要、本文のみ\n出力はテキストのみ\n\n記事一覧(JSON):\n${JSON.stringify(articlesForPrompt, null, 2)}`;

    let dailySummary = "";
    try {
      const r = await fetch(`${OPENAI_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model,
          temperature: 0.7,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`OpenAI API error: ${r.status} ${r.statusText} ${t}`);
      }
      const data = await r.json();
      dailySummary = (data.choices?.[0]?.message?.content || '').trim();
    } catch (e) {
      logger.error('daily summary generation failed', e);
      dailySummary = dailyNews.length > 0 ? '本日の主要動向については記事をご確認ください。' : '本日は該当する記事がありませんでした。';
    }

    // 日次レポートメッセージを生成
    const slackMessage = {
      channel: '', // 後で設定から取得
      text: `📰 日次ニュースレポート - ${date}`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `📰 日次ニュースレポート - ${date}` }
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: dailySummary || `本日 ${dailyNews.length} 件の記事を確認しました。` }
        }
      ]
    } as any;

    // 主要記事（最大5件）
    if (dailyNews.length > 0) {
      slackMessage.blocks.push({ type: "section", text: { type: "mrkdwn", text: "*📋 主要記事:*" } });
      dailyNews.slice(0, 5).forEach((article: NewsArticle) => {
        slackMessage.blocks.push({
          type: "section",
          text: { type: "mrkdwn", text: `*${article.isTranslated ? (article.translatedTitle || article.title) : article.title}*\n${article.isTranslated ? (article.translatedContent || article.translatedSummary || '') : (article.content || article.summary)}` }
        });
      });
      if (dailyNews.length > 5) {
        slackMessage.blocks.push({ type: "section", text: { type: "mrkdwn", text: `...他 ${dailyNews.length - 5} 件` } });
      }
    } else {
      slackMessage.blocks.push({ type: "section", text: { type: "mrkdwn", text: "本日の記事はありません。" } });
    }

    // Slack送信
    let mentionPrefix = '';
    const settingsDoc = await db.collection("settings").doc("slack").get();
    const settings = (settingsDoc.exists ? settingsDoc.data() : null) as SlackSettings | null;
    if (settings?.deliveryMentionUserId) mentionPrefix = `<@${settings.deliveryMentionUserId}> `;
    if (!settings?.channelId) throw new Error('channelId not configured');
    if (mentionPrefix) slackMessage.blocks.unshift({ type: 'section', text: { type: 'mrkdwn', text: `${mentionPrefix}` } });

    slackMessage.channel = settings.channelId;
    await postToSlackChannel(slackMessage, slackBotToken.value());

    logger.info(`Daily report delivered successfully for ${date}`);

    return { success: true, message: `日次レポートを配信しました（${dailyNews.length}件の記事）` };

  } catch (error) {
    logger.error("Error in daily report delivery:", error);
    throw error;
  }
}

/**
 * 週次レポート配信の共通サービス関数
 */
export async function executeWeeklyReport(targetWeekStart?: string): Promise<{ success: boolean; message: string }> {
  try {
    const weekStart = targetWeekStart || new Date().toISOString().split('T')[0];
    
    logger.info(`Starting weekly report delivery for week starting ${weekStart}...`);

    // 指定週の記事を取得
    const startOfWeek = getWeekStart(new Date(weekStart));
    const endOfWeek = getWeekEnd(new Date(weekStart));

    const newsSnapshot = await db.collection("news").get();
    const weeklyNews = newsSnapshot.docs.filter(doc => {
      const data = doc.data() as NewsArticle;
      const articleDate = new Date(data.publishedAt);
      return articleDate >= startOfWeek && articleDate <= endOfWeek;
    }).map(doc => doc.data() as NewsArticle);

    // LLMで文生成（失敗時はフォールバック）
    let competitorSummary = '';
    let companySummaries: any[] = [];
    let strategicAction = '';
    try {
      const llm = await generateWeeklyReportWithLLM(weeklyNews);
      competitorSummary = llm.competitorSummary;
      companySummaries = llm.companySummaries;
      strategicAction = llm.strategicAction;
    } catch (llmErr) {
      logger.error('LLM weekly generation failed:', llmErr);
      competitorSummary = weeklyNews.length > 0 ? '今週の競合動向については記事をご確認ください。' : '今週は該当する記事がありませんでした。';
      companySummaries = [];
      strategicAction = '推奨アクションは取得できませんでした。';
    }

    // 週次レポートメッセージを生成
    const slackMessage = {
      channel: '', // 後で設定から取得
      text: `📊 週次戦略レポート - ${weekStart}週`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `📊 週次戦略レポート - ${weekStart}週`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*🏢 競合の動きサマリ*\n${competitorSummary}`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*🏢 各社の動きサマリ*`
          }
        }
      ]
    };

    // 各社の動きサマリを追加
    if (companySummaries.length > 0) {
      companySummaries.forEach(company => {
        slackMessage.blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${company.company || ''}*\n${company.summary}`
          }
        });
      });
    } else {
      slackMessage.blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "該当週の競合記事はありません。"
        }
      });
    }

    // 自社が取るべき動きを追加
    slackMessage.blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*🎯 自社が取るべき動き*\n${strategicAction}`
      }
    });

    // Slack送信
    const settingsDoc = await db.collection("settings").doc("slack").get();
    const settings = (settingsDoc.exists ? settingsDoc.data() : null) as SlackSettings | null;
    let mentionPrefix = '';
    if (settings?.deliveryMentionUserId) mentionPrefix = `<@${settings.deliveryMentionUserId}> `;
    if (mentionPrefix) slackMessage.blocks.unshift({ type: 'section', text: { type: 'mrkdwn', text: `${mentionPrefix}` } });
    if (!settings?.channelId) throw new Error('channelId not configured');
    
    slackMessage.channel = settings.channelId;
    await postToSlackChannel(slackMessage, slackBotToken.value());

    logger.info(`Weekly report delivered successfully for week starting ${weekStart}`);

    return {
      success: true,
      message: `週次レポートを配信しました（${weeklyNews.length}件の記事）`
    };

  } catch (error) {
    logger.error("Error in weekly report delivery:", (error as any)?.stack || error);
    
    // 設定からエラーメンション取得して通知
    try {
      const settingsDoc = await db.collection("settings").doc("slack").get();
      const settings = (settingsDoc.exists ? settingsDoc.data() : null) as SlackSettings | null;
      const mention = settings?.errorMentionUserId ? `<@${settings.errorMentionUserId}> ` : '';
      if (settings?.channelId) {
        const errorMessage = {
          channel: settings.channelId,
          text: `${mention}週次レポート配信に失敗しました。詳細: ${((error as any)?.message || String(error)).slice(0, 300)}`
        };
        await postToSlackChannel(errorMessage, slackBotToken.value());
      }
    } catch {}
    
    throw error;
  }
}

/**
 * LLMによる週次レポート生成（ヘルパー関数）
 */
async function generateWeeklyReportWithLLM(weeklyNews: NewsArticle[]): Promise<WeeklyReportData> {
  const articlesForPrompt = weeklyNews.map(a => ({
    id: a.id,
    company: a.companyId,
    title: a.isTranslated ? (a.translatedTitle || a.title) : a.title,
    content: ((a.isTranslated ? (a.translatedContent || a.translatedSummary) : (a.content || a.summary)) || '').slice(0, 500),
    category: a.category,
    importance: a.importance,
    publishedAt: a.publishedAt
  }));

  const systemPrompt = "あなたは日本語のビジネスアナリストです。Slackに投稿可能なテキストのみを、日本語で簡潔に出力します。";
  const userPrompt = `以下のニュース一覧から、Slack投稿用の週次レポートをJSONで生成してください。\n要件:\n- 競合の動きサマリ: およそ200文字\n- 各社の動きサマリ: 会社ごとに約100文字\n- 自社が取るべき動き: およそ200文字\n- 統計値や数値の羅列は不要\n- 見出しや装飾は不要、本文のみ\n- 出力は必ず次のJSONスキーマに従うこと\n{\n  "competitorSummary": "string",\n  "companySummaries": [{"company": "string", "summary": "string"}],\n  "strategicAction": "string"\n}\nニュース一覧(JSON):\n${JSON.stringify(articlesForPrompt, null, 2)}`;

  const OPENAI_API_KEY = openaiApiKey.value();
  const OPENAI_API_URL = openaiApiUrl.value();
  const model = config.ai.model;

  const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`OpenAI API error (weekly report): ${errorText}`);
    throw new Error(`OpenAI API error: ${response.status} - ${response.statusText}`);
  }

  const data = await response.json();
  const content: string | undefined = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('LLMから週次レポートの応答が得られませんでした');
  }

  // JSON抽出
  let jsonText = content.trim();
  const jsonStart = jsonText.indexOf('{');
  const jsonEnd = jsonText.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1) {
    jsonText = jsonText.slice(jsonStart, jsonEnd + 1);
  }

  try {
    const parsed = JSON.parse(jsonText);
    const competitorSummary = String(parsed.competitorSummary || '').trim();
    const companySummaries = Array.isArray(parsed.companySummaries) ? parsed.companySummaries.map((c: any) => ({
      company: String(c.company || ''),
      summary: String(c.summary || '')
    })) : [];
    const strategicAction = String(parsed.strategicAction || '').trim();
    return { competitorSummary, companySummaries, strategicAction };
  } catch (e) {
    logger.error('LLM出力のJSON解析に失敗しました', e);
    return {
      competitorSummary: '今週の動向サマリは取得できませんでした。',
      companySummaries: [],
      strategicAction: '推奨アクションは取得できませんでした。'
    };
  }
}
