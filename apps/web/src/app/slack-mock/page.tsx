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
    startOfWeek.setDate(selectedDateObj.getDate() - selectedDateObj.getDay()); // 日曜日を週の開始とする
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
    const untranslatedNews = weeklyNews.filter(article => !article.isTranslated);
    
    console.log(`📊 週次レポート生成: ${selectedDate}週 - データベースから取得した記事 ${weeklyNews.length} 件を処理`);
    
    // 企業別に記事をグループ化
    const newsByCompany = weeklyNews.reduce((acc, article) => {
      const companyId = article.companyId;
      if (!acc[companyId]) acc[companyId] = [];
      acc[companyId].push(article);
      return acc;
    }, {} as Record<string, NewsArticle[]>);

    // 競合の動きを分析
    const competitorAnalysis = Object.entries(newsByCompany).map(([companyId, articles]) => {
      const companyName = companyId === 'TEST_RANDOM' ? 'テスト用ランダム記事' : `企業ID: ${companyId}`;
      const translatedCount = articles.filter(a => a.isTranslated).length;
      const highImportanceCount = articles.filter(a => a.importance >= 4).length;
      
      return {
        companyId,
        companyName,
        totalArticles: articles.length,
        translatedArticles: translatedCount,
        highImportanceArticles: highImportanceCount,
        articles: articles
      };
    });

    // 全体サマリ
    const totalCompetitorArticles = weeklyNews.length;
    const totalTranslatedArticles = translatedNews.length;
    const highImportanceArticles = weeklyNews.filter(a => a.importance >= 4).length;
    const averageImportance = weeklyNews.length > 0 
      ? (weeklyNews.reduce((sum, a) => sum + a.importance, 0) / weeklyNews.length).toFixed(1)
      : 0;

    // 自社が取るべき動きの提案
    const strategicRecommendations = generateStrategicRecommendations(weeklyNews, competitorAnalysis);

    return {
      weekStart: new Date(selectedDate).toISOString().split('T')[0],
      totalArticles: weeklyNews.length,
      translatedArticles: translatedNews.length,
      untranslatedArticles: untranslatedNews.length,
      competitorAnalysis,
      totalCompetitorArticles,
      totalTranslatedArticles,
      highImportanceArticles,
      averageImportance,
      strategicRecommendations
    };
  };

  // 戦略的推奨事項の生成
  const generateStrategicRecommendations = (weeklyNews: NewsArticle[], competitorAnalysis: any[]) => {
    const recommendations = [];
    
    // 高重要度記事の分析
    const highImportanceArticles = weeklyNews.filter(a => a.importance >= 4);
    if (highImportanceArticles.length > 0) {
      recommendations.push({
        type: 'urgent',
        title: '緊急対応が必要',
        description: `${highImportanceArticles.length}件の高重要度記事が発生しています。競合の重要な動きを詳細に分析し、迅速な対応を検討してください。`
      });
    }

    // 翻訳率の分析
    const translationRate = weeklyNews.length > 0 ? (weeklyNews.filter(a => a.isTranslated).length / weeklyNews.length) * 100 : 0;
    if (translationRate < 80) {
      recommendations.push({
        type: 'process',
        title: '翻訳プロセスの改善',
        description: `翻訳率が${translationRate.toFixed(1)}%と低いです。翻訳プロセスの効率化を検討してください。`
      });
    }

    // 競合の動きの分析
    const activeCompetitors = competitorAnalysis.filter(c => c.totalArticles > 0);
    if (activeCompetitors.length > 0) {
      const mostActiveCompetitor = activeCompetitors.reduce((max, current) => 
        current.totalArticles > max.totalArticles ? current : max
      );
      recommendations.push({
        type: 'competitive',
        title: '競合監視の強化',
        description: `${mostActiveCompetitor.companyName}が最も活発です（${mostActiveCompetitor.totalArticles}件）。特に注目して監視を強化してください。`
      });
    }

    // カテゴリ別の分析
    const categoryAnalysis = weeklyNews.reduce((acc, article) => {
      acc[article.category] = (acc[article.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topCategory = Object.entries(categoryAnalysis).reduce((max, current) => 
      current[1] > max[1] ? current : max, ['', 0]
    );
    
    if (topCategory[1] > 0) {
      recommendations.push({
        type: 'market',
        title: '市場動向の把握',
        description: `「${topCategory[0]}」カテゴリの記事が${topCategory[1]}件と最多です。この分野の市場動向を重点的に調査してください。`
      });
    }

    return recommendations;
  };

  const currentReport = reportType === 'daily' ? generateDailyReport() : generateWeeklyReport();
  const isDailyReport = reportType === 'daily';

  return (
    <div className="container-fluid py-4">
      <div className="row">
        <div className="col-12">
          {/* ヘッダー */}
          <div className="alert alert-warning mb-4">
            <h4 className="alert-heading">🧪 Slack モックページ（テスト用）</h4>
            <p className="mb-0">
              このページは<strong>テスト用</strong>のSlackモックページです。
              実際のSlackに送信される日次・週次レポートの内容を確認できます。
            </p>
          </div>

          {/* データソース情報 */}
          <div className="alert alert-info mb-4">
            <h6 className="alert-heading">📊 データソース情報</h6>
            <div className="row">
              <div className="col-md-6">
                <strong>データ取得元:</strong> Firestore データベース
              </div>
              <div className="col-md-6">
                <strong>現在の記事数:</strong> {news.length} 件
              </div>
            </div>
            <div className="row mt-2">
              <div className="col-md-6">
                <strong>最終更新:</strong> {loading ? '読み込み中...' : new Date().toLocaleString('ja-JP')}
              </div>
              <div className="col-md-6">
                <strong>データ状態:</strong> 
                <span className={`badge ${loading ? 'bg-warning' : 'bg-success'} ms-1`}>
                  {loading ? '読み込み中' : '最新'}
                </span>
              </div>
            </div>
          </div>

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

          {/* レポート統計 */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">
                {reportType === 'daily' ? '日次' : '週次'}レポート統計
              </h5>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-3">
                  <div className="card bg-primary text-white">
                    <div className="card-body text-center">
                      <h3>{currentReport.totalArticles}</h3>
                      <p className="mb-0">総記事数</p>
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card bg-success text-white">
                    <div className="card-body text-center">
                      <h3>{currentReport.translatedArticles}</h3>
                      <p className="mb-0">翻訳済み</p>
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card bg-warning text-white">
                    <div className="card-body text-center">
                      <h3>{currentReport.untranslatedArticles}</h3>
                      <p className="mb-0">未翻訳</p>
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card bg-info text-white">
                    <div className="card-body text-center">
                      <h3>
                        {currentReport.totalArticles > 0 
                          ? Math.round((currentReport.translatedArticles / currentReport.totalArticles) * 100)
                          : 0}%
                      </h3>
                      <p className="mb-0">翻訳率</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Slack風レポート表示 */}
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">
                📱 Slack風レポート表示
                <small className="text-muted ms-2">（データベースから取得した実際のデータを使用）</small>
              </h5>
            </div>
            <div className="card-body">
              <div className="slack-mock-container" style={{ 
                backgroundColor: '#f8f9fa', 
                border: '1px solid #dee2e6', 
                borderRadius: '8px',
                padding: '16px',
                fontFamily: 'monospace'
              }}>
                {isDailyReport ? (
                  <div>
                    <div className="mb-3">
                      <strong>📰 日次ニュースレポート - {selectedDate}</strong>
                    </div>
                    <div className="mb-3">
                      <span className="badge bg-primary me-2">総記事数: {currentReport.totalArticles}</span>
                      <span className="badge bg-success me-2">翻訳済み: {currentReport.translatedArticles}</span>
                      <span className="badge bg-warning">未翻訳: {currentReport.untranslatedArticles}</span>
                    </div>
                    {isDailyReport && (currentReport as any).articles.length > 0 ? (
                      <div>
                        <strong>📋 記事一覧:</strong>
                        <ul className="mt-2">
                          {(currentReport as any).articles.map((article: NewsArticle, index: number) => (
                            <li key={index} className="mb-2">
                              <div>
                                <strong>
                                  {article.isTranslated ? article.translatedTitle : article.title}
                                </strong>
                                {article.isTranslated && (
                                  <span className="badge bg-success ms-2">翻訳済み</span>
                                )}
                              </div>
                              <div className="text-muted small">
                                カテゴリ: {article.category} | 重要度: {article.importance}/5
                              </div>
                              <div className="text-muted small">
                                URL: <a href={article.url} target="_blank" rel="noopener noreferrer">{article.url}</a>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="text-muted">該当日の記事はありません。</div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="mb-3">
                      <strong>📊 週次戦略レポート - {selectedDate}週</strong>
                    </div>
                    
                    {/* 競合の動き - 全体サマリ */}
                    <div className="mb-4">
                      <h6 className="text-primary">🏢 競合の動き - 全体サマリ</h6>
                      <div className="row mb-3">
                        <div className="col-md-3">
                          <div className="card bg-light">
                            <div className="card-body text-center p-2">
                              <h6 className="card-title mb-1">総記事数</h6>
                              <h4 className="text-primary mb-0">{(currentReport as any).totalCompetitorArticles}</h4>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div className="card bg-light">
                            <div className="card-body text-center p-2">
                              <h6 className="card-title mb-1">高重要度</h6>
                              <h4 className="text-danger mb-0">{(currentReport as any).highImportanceArticles}</h4>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div className="card bg-light">
                            <div className="card-body text-center p-2">
                              <h6 className="card-title mb-1">平均重要度</h6>
                              <h4 className="text-warning mb-0">{(currentReport as any).averageImportance}</h4>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div className="card bg-light">
                            <div className="card-body text-center p-2">
                              <h6 className="card-title mb-1">翻訳率</h6>
                              <h4 className="text-success mb-0">
                                {currentReport.totalArticles > 0 
                                  ? Math.round((currentReport.translatedArticles / currentReport.totalArticles) * 100)
                                  : 0}%
                              </h4>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 各社ごとの動きサマリ */}
                    <div className="mb-4">
                      <h6 className="text-primary">🏢 各社ごとの動きサマリ</h6>
                      {(currentReport as any).competitorAnalysis.length > 0 ? (
                        <div className="table-responsive">
                          <table className="table table-sm table-striped">
                            <thead>
                              <tr>
                                <th>企業</th>
                                <th>記事数</th>
                                <th>翻訳済み</th>
                                <th>高重要度</th>
                                <th>主要記事</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(currentReport as any).competitorAnalysis.map((company: any, index: number) => (
                                <tr key={index}>
                                  <td>
                                    <strong>{company.companyName}</strong>
                                  </td>
                                  <td>
                                    <span className="badge bg-primary">{company.totalArticles}</span>
                                  </td>
                                  <td>
                                    <span className="badge bg-success">{company.translatedArticles}</span>
                                  </td>
                                  <td>
                                    <span className="badge bg-danger">{company.highImportanceArticles}</span>
                                  </td>
                                  <td>
                                    {company.articles.slice(0, 2).map((article: NewsArticle, idx: number) => (
                                      <div key={idx} className="small">
                                        {article.isTranslated ? article.translatedTitle : article.title}
                                        <span className="badge bg-secondary ms-1">{article.importance}/5</span>
                                      </div>
                                    ))}
                                    {company.articles.length > 2 && (
                                      <div className="small text-muted">...他{company.articles.length - 2}件</div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-muted">該当週の競合記事はありません。</div>
                      )}
                    </div>

                    {/* 自社が取るべき動き */}
                    <div className="mb-4">
                      <h6 className="text-success">🎯 自社が取るべき動き</h6>
                      {(currentReport as any).strategicRecommendations.length > 0 ? (
                        <div className="row">
                          {(currentReport as any).strategicRecommendations.map((rec: any, index: number) => (
                            <div key={index} className="col-md-6 mb-3">
                              <div className={`card ${
                                rec.type === 'urgent' ? 'border-danger' :
                                rec.type === 'competitive' ? 'border-warning' :
                                rec.type === 'market' ? 'border-info' :
                                'border-secondary'
                              }`}>
                                <div className="card-body p-3">
                                  <h6 className={`card-title ${
                                    rec.type === 'urgent' ? 'text-danger' :
                                    rec.type === 'competitive' ? 'text-warning' :
                                    rec.type === 'market' ? 'text-info' :
                                    'text-secondary'
                                  }`}>
                                    {rec.type === 'urgent' ? '🚨' :
                                     rec.type === 'competitive' ? '⚔️' :
                                     rec.type === 'market' ? '📈' :
                                     '💡'} {rec.title}
                                  </h6>
                                  <p className="card-text small mb-0">{rec.description}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted">今週は特別な推奨事項はありません。</div>
                      )}
                    </div>
                  </div>
                )}
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