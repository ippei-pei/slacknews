'use client';

import { useState, useEffect } from 'react';
import { getNews, Company, NewsArticle } from '@/lib/api';

export default function SlackMockPage() {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reportType, setReportType] = useState<'daily' | 'weekly'>('daily');

  useEffect(() => {
    loadNews();
  }, []);

  const loadNews = async () => {
    setLoading(true);
    try {
      console.log('🔄 データベースから記事データを取得中...');
      const newsRes = await getNews();
      if (newsRes.success) {
        setNews(newsRes.data || []);
        console.log(`✅ データベースから ${newsRes.data?.length || 0} 件の記事を取得しました`);
      } else {
        console.error('❌ データベースからの記事取得に失敗:', newsRes.error);
      }
    } catch (error) {
      console.error('❌ データベース接続エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  // 日付でフィルタリングされた記事を取得
  const getFilteredNews = () => {
    if (!selectedDate) return news;
    
    const selectedDateObj = new Date(selectedDate);
    const startOfDay = new Date(selectedDateObj);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDateObj);
    endOfDay.setHours(23, 59, 59, 999);

    return news.filter(article => {
      const articleDate = new Date(article.publishedAt);
      return articleDate >= startOfDay && articleDate <= endOfDay;
    });
  };

  // 週次レポート用の記事を取得（選択日から1週間）
  const getWeeklyNews = () => {
    if (!selectedDate) return news;
    
    const selectedDateObj = new Date(selectedDate);
    const startOfWeek = new Date(selectedDateObj);
    startOfWeek.setDate(selectedDateObj.getDate() - selectedDateObj.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return news.filter(article => {
      const articleDate = new Date(article.publishedAt);
      return articleDate >= startOfWeek && articleDate <= endOfWeek;
    });
  };

  // 日次レポートの生成（データベースから取得したデータを使用）
  const generateDailyReport = () => {
    const filteredNews = getFilteredNews();
    const translatedNews = filteredNews.filter(article => article.isTranslated);
    const untranslatedNews = filteredNews.filter(article => !article.isTranslated);
    
    console.log(`📊 日次レポート生成: ${selectedDate} - データベースから取得した記事 ${filteredNews.length} 件を処理`);
    
    return {
      date: selectedDate,
      totalArticles: filteredNews.length,
      translatedArticles: translatedNews.length,
      untranslatedArticles: untranslatedNews.length,
      articles: filteredNews
    };
  };

  // 週次レポートの生成（データベースから取得したデータを使用）
  const generateWeeklyReport = () => {
    const weeklyNews = getWeeklyNews();
    const translatedNews = weeklyNews.filter(article => article.isTranslated);
    
    console.log(`📊 週次レポート生成: ${selectedDate}週 - データベースから取得した記事 ${weeklyNews.length} 件を処理`);
    
    // 企業別に記事をグループ化
    const newsByCompany = weeklyNews.reduce((acc, article) => {
      const companyId = article.companyId;
      if (!acc[companyId]) acc[companyId] = [];
      acc[companyId].push(article);
      return acc;
    }, {} as Record<string, NewsArticle[]>);

    // 競合の動きサマリ（200文字程度）
    const competitorSummary = generateCompetitorSummary(weeklyNews);
    
    // 各社の動きサマリ（100文字程度）
    const companySummaries = Object.entries(newsByCompany).map(([companyId, articles]) => {
      const companyName = companyId === 'TEST_RANDOM' ? 'テスト用ランダム記事' : `企業ID: ${companyId}`;
      return {
        companyId,
        companyName,
        summary: generateCompanySummary(articles)
      };
    });

    // 自社が取るべき動き（200文字程度）
    const strategicAction = generateStrategicAction(weeklyNews, companySummaries);

    return {
      weekStart: new Date(selectedDate).toISOString().split('T')[0],
      totalArticles: weeklyNews.length,
      translatedArticles: translatedNews.length,
      competitorSummary,
      companySummaries,
      strategicAction
    };
  };

  // 競合の動きサマリ生成（200文字程度）
  const generateCompetitorSummary = (weeklyNews: NewsArticle[]): string => {
    if (weeklyNews.length === 0) {
      return "今週は競合の動きに関する記事はありませんでした。";
    }

    const categories = weeklyNews.reduce((acc, article) => {
      acc[article.category] = (acc[article.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topCategories = Object.entries(categories)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([category, count]) => `${category}(${count}件)`)
      .join('、');

    const highImportanceCount = weeklyNews.filter(a => a.importance >= 4).length;
    const highImportanceText = highImportanceCount > 0 ? `特に重要度の高い記事が${highImportanceCount}件` : '';

    return `今週は競合から${weeklyNews.length}件の記事が確認されました。主な分野は${topCategories}です。${highImportanceText}。市場では技術革新や新サービス発表が活発で、競合各社が積極的な動きを見せています。`;
  };

  // 各社の動きサマリ生成（100文字程度）
  const generateCompanySummary = (articles: NewsArticle[]): string => {
    if (articles.length === 0) {
      return "今週の動きはありませんでした。";
    }

    const translatedArticles = articles.filter(a => a.isTranslated);
    const mainTopics = articles.slice(0, 2).map(a => 
      a.isTranslated ? a.translatedTitle : a.title
    ).join('、');

    return `${articles.length}件の記事を確認。主な内容は「${mainTopics}」など。${translatedArticles.length}件が翻訳済み。`;
  };

  // 自社が取るべき動き生成（200文字程度）
  const generateStrategicAction = (weeklyNews: NewsArticle[], companySummaries: any[]): string => {
    if (weeklyNews.length === 0) {
      return "今週は競合の動きが少なく、現状維持を継続することを推奨します。市場の動向を引き続き監視し、次週以降の動きに備えてください。";
    }

    const highImportanceArticles = weeklyNews.filter(a => a.importance >= 4);
    const activeCompanies = companySummaries.filter(c => c.summary !== "今週の動きはありませんでした。");
    
    let action = "今週の競合動向を踏まえ、以下の対応を推奨します：";
    
    if (highImportanceArticles.length > 0) {
      action += ` 高重要度記事${highImportanceArticles.length}件について詳細分析を実施し、`;
    }
    
    if (activeCompanies.length > 0) {
      action += ` 特に活発な${activeCompanies.length}社の動向を重点監視し、`;
    }
    
    action += " 自社の戦略的ポジションを再評価することをお勧めします。市場の変化に迅速に対応できる体制を整備してください。";

    return action;
  };

  const currentReport = reportType === 'daily' ? generateDailyReport() : generateWeeklyReport();
  const isDailyReport = reportType === 'daily';

  return (
    <div className="container-fluid py-4">
      <div className="row">
        <div className="col-12">

          {/* コントロールパネル */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">レポート設定</h5>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-4">
                  <label htmlFor="reportType" className="form-label">レポートタイプ</label>
                  <select 
                    id="reportType"
                    className="form-select"
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value as 'daily' | 'weekly')}
                  >
                    <option value="daily">日次レポート</option>
                    <option value="weekly">週次レポート</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label htmlFor="selectedDate" className="form-label">基準日</label>
                  <input
                    type="date"
                    id="selectedDate"
                    className="form-control"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>
                <div className="col-md-4 d-flex align-items-end">
                  <button 
                    className="btn btn-primary"
                    onClick={loadNews}
                    disabled={loading}
                  >
                    {loading ? '読み込み中...' : 'データ更新'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Slack表示テスト */}
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">Slack表示テスト</h5>
            </div>
            <div className="card-body p-0">
              {/* 実際のSlackの投稿表示 */}
              <div style={{ 
                backgroundColor: '#ffffff',
                fontFamily: 'Lato, "Helvetica Neue", Arial, sans-serif',
                fontSize: '15px',
                lineHeight: '1.4'
              }}>
                {/* Slackの投稿メッセージ */}
                <div style={{ 
                  padding: '8px 16px',
                  borderBottom: '1px solid #e8e8e8'
                }}>
                  {/* アカウントアイコンと表示名 */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <div style={{ 
                      width: '36px', 
                      height: '36px', 
                      borderRadius: '4px',
                      backgroundColor: '#4a154b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '8px',
                      flexShrink: 0
                    }}>
                      <span style={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>📊</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                        <span style={{ 
                          fontWeight: 'bold', 
                          color: '#1d1c1d',
                          marginRight: '8px'
                        }}>
                          News Bot
                        </span>
                        <span style={{ 
                          fontSize: '12px', 
                          color: '#616061'
                        }}>
                          {new Date().toLocaleString('ja-JP', { 
                            month: 'numeric', 
                            day: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                      
                      {/* メッセージ内容 */}
                      <div style={{ color: '#1d1c1d' }}>
                        {isDailyReport ? (
                          <div>
                            <div style={{ marginBottom: '12px' }}>
                              📰 日次ニュースレポート - {selectedDate}
                            </div>
                            
                            {(currentReport as any).articles.length > 0 ? (
                              <div>
                                <div style={{ marginBottom: '12px' }}>
                                  本日 {currentReport.totalArticles} 件の記事を確認しました。
                                  （翻訳済み: {currentReport.translatedArticles}件、未翻訳: {isDailyReport ? (currentReport as any).untranslatedArticles : (currentReport.totalArticles - currentReport.translatedArticles)}件）
                                </div>
                                
                                <div style={{ marginBottom: '8px' }}>
                                  📋 主要記事:
                                </div>
                                
                                {(currentReport as any).articles.slice(0, 5).map((article: NewsArticle, index: number) => (
                                  <div key={index} style={{ 
                                    marginBottom: '12px',
                                    paddingLeft: '16px',
                                    borderLeft: '3px solid #e8e8e8'
                                  }}>
                                    <div style={{ marginBottom: '4px' }}>
                                      {article.isTranslated ? article.translatedTitle : article.title}
                                    </div>
                                    <div style={{ 
                                      fontSize: '14px', 
                                      color: '#616061',
                                      marginBottom: '4px'
                                    }}>
                                      {article.isTranslated ? article.translatedContent : article.content}
                                    </div>
                                    <div style={{ 
                                      fontSize: '13px', 
                                      color: '#616061'
                                    }}>
                                      重要度: {article.importance}/5 | {article.category} | {article.isTranslated ? '翻訳済み' : '未翻訳'}
                                    </div>
                                  </div>
                                ))}
                                
                                {(currentReport as any).articles.length > 5 && (
                                  <div style={{ 
                                    fontSize: '14px', 
                                    color: '#616061', 
                                    fontStyle: 'italic'
                                  }}>
                                    ...他 {(currentReport as any).articles.length - 5} 件
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ 
                                fontSize: '14px', 
                                color: '#616061', 
                                fontStyle: 'italic'
                              }}>
                                本日の記事はありません。
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div style={{ marginBottom: '12px' }}>
                              📊 週次戦略レポート - {selectedDate}週
                            </div>
                            
                            {/* 競合の動きサマリ */}
                            <div style={{ marginBottom: '16px' }}>
                              <div style={{ marginBottom: '8px' }}>
                                🏢 競合の動きサマリ
                              </div>
                              <div style={{ 
                                paddingLeft: '16px',
                                borderLeft: '3px solid #e8e8e8'
                              }}>
                                {(currentReport as any).competitorSummary}
                              </div>
                            </div>

                            {/* 各社の動きサマリ */}
                            <div style={{ marginBottom: '16px' }}>
                              <div style={{ marginBottom: '8px' }}>
                                🏢 各社の動きサマリ
                              </div>
                              {(currentReport as any).companySummaries.length > 0 ? (
                                <div>
                                  {(currentReport as any).companySummaries.map((company: any, index: number) => (
                                    <div key={index} style={{ 
                                      marginBottom: '8px',
                                      paddingLeft: '16px',
                                      borderLeft: '3px solid #e8e8e8'
                                    }}>
                                      <div style={{ marginBottom: '4px' }}>
                                        {company.companyName}
                                      </div>
                                      <div style={{ 
                                        fontSize: '14px', 
                                        color: '#616061'
                                      }}>
                                        {company.summary}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ 
                                  fontSize: '14px', 
                                  color: '#616061', 
                                  fontStyle: 'italic',
                                  paddingLeft: '16px',
                                  borderLeft: '3px solid #e8e8e8'
                                }}>
                                  該当週の競合記事はありません。
                                </div>
                              )}
                            </div>

                            {/* 自社が取るべき動き */}
                            <div style={{ marginBottom: '16px' }}>
                              <div style={{ marginBottom: '8px' }}>
                                🎯 自社が取るべき動き
                              </div>
                              <div style={{ 
                                paddingLeft: '16px',
                                borderLeft: '3px solid #e8e8e8'
                              }}>
                                {(currentReport as any).strategicAction}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 注意事項 */}
          <div className="alert alert-info mt-4">
            <h6 className="alert-heading">ℹ️ 注意事項</h6>
            <ul className="mb-0">
              <li>このページは<strong>テスト用</strong>です。実際のSlackには送信されません。</li>
              <li><strong>データソース:</strong> すべての記事データはFirestoreデータベースからリアルタイムで取得されています。</li>
              <li><strong>ハードコードなし:</strong> 表示されるデータは実際のデータベースの内容であり、固定値ではありません。</li>
              <li>実際のSlack送信時は、翻訳済みの記事のみが配信されます。</li>
              <li>日次レポートは選択した日付の記事のみ、週次レポートは選択した日付を含む週の記事を表示します。</li>
              <li>「データ更新」ボタンで最新のデータベース内容を取得できます。</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}