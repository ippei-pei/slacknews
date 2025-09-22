// API呼び出し用のユーティリティ関数

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://us-central1-slack-news-63e2e.cloudfunctions.net';

export interface Company {
  id: string;
  name: string;
  url: string;
  rssUrl?: string;
  redditUrl?: string;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewsArticle {
  id: string;
  companyId: string;
  title: string;
  content: string;
  url: string;
  publishedAt: Date;
  importance: number;
  category: string;
  summary: string;
  translatedTitle?: string;
  translatedContent?: string;
  translatedSummary?: string;
  isDeliveryTarget: boolean;
  isTranslated: boolean;
  informationAcquisitionDate: Date;
  deliveryDate?: Date;
  deliveryStatus: 'pending' | 'delivered' | 'failed';
  createdAt: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SlackSettings {
  channelName: string;
  deliveryMentionUserId?: string | null;
  errorMentionUserId?: string | null;
  webhookUrl?: string | null;
  updatedAt?: Date | string;
}

// 企業一覧取得
export async function getCompanies(): Promise<ApiResponse<Company[]>> {
  try {
    const response = await fetch(`${API_BASE}/getCompanies`);
    const data = await response.json();
    
    if (data.success && data.data) {
      // FirestoreのタイムスタンプをDateオブジェクトに変換
      data.data = data.data.map((company: any) => ({
        ...company,
        createdAt: company.createdAt?._seconds ? new Date(company.createdAt._seconds * 1000) : new Date(company.createdAt),
        updatedAt: company.updatedAt?._seconds ? new Date(company.updatedAt._seconds * 1000) : new Date(company.updatedAt)
      }));
    }
    
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// 企業追加
export async function addCompany(companyData: {
  name: string;
  url: string;
  rssUrl?: string;
  redditUrl?: string;
  priority?: number;
}): Promise<ApiResponse<Company>> {
  try {
    const response = await fetch(`${API_BASE}/addCompany`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(companyData),
    });
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// 企業編集
export async function updateCompany(companyId: string, companyData: {
  name: string;
  rssUrl?: string;
  redditUrl?: string;
}): Promise<ApiResponse<Company>> {
  try {
    const response = await fetch(`${API_BASE}/updateCompany`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ companyId, ...companyData }),
    });
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// 企業削除
export async function deleteCompany(companyId: string): Promise<ApiResponse<{ message: string }>> {
  try {
    const response = await fetch(`${API_BASE}/deleteCompany`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ companyId }),
    });
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ニュース記事取得
export async function getNews(companyId?: string, limit: number = 10): Promise<ApiResponse<NewsArticle[]>> {
  try {
    const params = new URLSearchParams();
    if (companyId) params.append('companyId', companyId);
    params.append('limit', limit.toString());
    
    const response = await fetch(`${API_BASE}/getNews?${params}`);
    const data = await response.json();
    
    if (data.success && data.data) {
      // FirestoreのタイムスタンプをDateオブジェクトに変換
      data.data = data.data.map((article: any) => ({
        ...article,
        publishedAt: article.publishedAt?._seconds ? new Date(article.publishedAt._seconds * 1000) : new Date(article.publishedAt),
        createdAt: article.createdAt?._seconds ? new Date(article.createdAt._seconds * 1000) : new Date(article.createdAt)
      }));
    }
    
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// 情報収集実行
export async function runCollection(): Promise<ApiResponse<{ message: string }>> {
  try {
    const response = await fetch(`${API_BASE}/runCollection`, {
      method: 'POST',
    });
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}


// 配信対象記事の翻訳処理
export async function translateDeliveryTargetNews(): Promise<ApiResponse<{ message: string }>> {
  try {
    const response = await fetch(`${API_BASE}/translateDeliveryTargetNews`, {
      method: 'POST',
    });
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// 記事配信処理（Slack送信）
export async function deliverNews(): Promise<ApiResponse<{ message: string }>> {
  try {
    const response = await fetch(`${API_BASE}/deliverNews`, {
      method: 'POST',
    });
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// 記事クリーンナップ（完全削除・デバッグ用）
export async function cleanupNews(): Promise<ApiResponse<{ message: string }>> {
  try {
    const response = await fetch(`${API_BASE}/cleanupNews`, {
      method: 'POST',
    });
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// 日次レポート配信
export async function deliverDailyReport(date?: string): Promise<ApiResponse<{ message: string }>> {
  try {
    const response = await fetch(`${API_BASE}/deliverDailyReport`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ date }),
    });
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// 週次レポート配信
export async function deliverWeeklyReport(weekStart?: string): Promise<ApiResponse<{ message: string }>> {
  try {
    const response = await fetch(`${API_BASE}/deliverWeeklyReport`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ weekStart }),
    });
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Slack設定 取得
export async function getSlackSettings(): Promise<ApiResponse<SlackSettings | null>> {
  try {
    const response = await fetch(`${API_BASE}/getSlackSettings`);
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Slack設定 更新
export async function updateSlackSettings(payload: SlackSettings): Promise<ApiResponse<SlackSettings>> {
  try {
    const response = await fetch(`${API_BASE}/updateSlackSettings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
