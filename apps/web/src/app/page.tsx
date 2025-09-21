'use client';

import { useState, useEffect } from 'react';
import { getCompanies, addCompany, getNews, runCollection, sendDailyReport, sendWeeklyReport, translateDeliveryTargetNews, deliverNews, Company, NewsArticle } from '@/lib/api';

export default function Home() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // 記事がある週（2025年9月15日〜21日）を初期表示にする
  const [currentWeek, setCurrentWeek] = useState(new Date('2025-09-17'));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('🔄 Loading data...');
      const [companiesRes, newsRes] = await Promise.all([
        getCompanies(),
        getNews()
      ]);

      console.log('📊 Companies response:', companiesRes);
      console.log('📰 News response:', newsRes);

      if (companiesRes.success) {
        setCompanies(companiesRes.data || []);
        console.log('✅ Companies loaded:', companiesRes.data?.length || 0, 'companies');
      } else {
        console.error('❌ Companies error:', companiesRes.error);
        setMessage({ type: 'error', text: `企業データの取得に失敗: ${companiesRes.error}` });
      }

      if (newsRes.success) {
        setNews(newsRes.data || []);
        console.log('✅ News loaded:', newsRes.data?.length || 0, 'articles');
        console.log('📝 News data:', newsRes.data);
      } else {
        console.error('❌ News error:', newsRes.error);
        setMessage({ type: 'error', text: `ニュースデータの取得に失敗: ${newsRes.error}` });
      }
    } catch (error) {
      console.error('💥 Error loading data:', error);
      setMessage({ type: 'error', text: 'データの読み込み中にエラーが発生しました' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCompany = async (formData: FormData) => {
    const companyData = {
      name: formData.get('companyName') as string,
      url: formData.get('companyUrl') as string,
      rssUrl: formData.get('rssUrl') as string || undefined,
      redditUrl: formData.get('redditUrl') as string || undefined,
      priority: parseInt(formData.get('priority') as string) || 2,
    };

    const result = await addCompany(companyData);
    if (result.success) {
      setMessage({ type: 'success', text: '企業が正常に追加されました' });
      loadData();
    } else {
      setMessage({ type: 'error', text: result.error || '企業の追加に失敗しました' });
    }
  };

  const handleAction = async (action: string, actionFn: () => Promise<any>) => {
    setActionLoading(action);
    try {
      const result = await actionFn();
      if (result.success) {
        setMessage({ type: 'success', text: result.message || '操作が完了しました' });
        loadData(); // データを再読み込み
      } else {
        setMessage({ type: 'error', text: result.error || '操作に失敗しました' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '操作中にエラーが発生しました' });
    } finally {
      setActionLoading(null);
    }
  };

  // 週の開始日を取得（月曜日を週の開始とする）
  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 月曜日を週の開始とする
    return new Date(d.setDate(diff));
  };

  // 週の終了日を取得
  const getWeekEnd = (date: Date) => {
    const start = getWeekStart(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return end;
  };

  // 週を変更
  const changeWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newWeek);
  };

  // 現在の週の記事を取得
  const getCurrentWeekNews = () => {
    const weekStart = getWeekStart(currentWeek);
    const weekEnd = getWeekEnd(currentWeek);
    
    console.log('📅 Week range:', weekStart.toLocaleDateString('ja-JP'), 'to', weekEnd.toLocaleDateString('ja-JP'));
    console.log('📰 Total news articles:', news.length);
    
    const weekNews = news.filter(article => {
      const articleDate = new Date(article.publishedAt);
      const isInWeek = articleDate >= weekStart && articleDate <= weekEnd;
      console.log('🔍 Article date check:', {
        title: article.title,
        publishedAt: articleDate.toLocaleDateString('ja-JP'),
        isInWeek: isInWeek
      });
      return isInWeek;
    });
    
    console.log('📊 Week news count:', weekNews.length);
    return weekNews;
  };

  // 日付別に記事をグループ化
  const getNewsByDate = () => {
    const weekNews = getCurrentWeekNews();
    const newsByDate: { [key: string]: NewsArticle[] } = {};
    
    console.log('🗂️ Grouping news by date. Week news count:', weekNews.length);
    
    weekNews.forEach(article => {
      const date = new Date(article.publishedAt).toISOString().split('T')[0];
      if (!newsByDate[date]) {
        newsByDate[date] = [];
      }
      newsByDate[date].push(article);
      console.log('📅 Added article to date:', date, 'Title:', article.title);
    });
    
    console.log('📊 News by date:', Object.keys(newsByDate).map(date => ({
      date,
      count: newsByDate[date].length
    })));
    
    return newsByDate;
  };

  // 週の日付一覧を生成
  const getWeekDates = () => {
    const start = getWeekStart(currentWeek);
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const stats = {
    companyCount: companies.length,
    articleCount: news.length,
    lastCollection: news.length > 0 ? new Date(Math.max(...news.map(n => new Date(n.publishedAt).getTime()))).toLocaleDateString('ja-JP') : '-'
  };

  const weekStart = getWeekStart(currentWeek);
  const weekEnd = getWeekEnd(currentWeek);
  const weekDates = getWeekDates();
  const newsByDate = getNewsByDate();
  const currentWeekNews = getCurrentWeekNews();

  // デバッグ情報をコンソールに出力
  console.log('🎯 Current week:', weekStart.toLocaleDateString('ja-JP'), 'to', weekEnd.toLocaleDateString('ja-JP'));
  console.log('📊 Current week news count:', currentWeekNews.length);
  console.log('🗓️ News by date keys:', Object.keys(newsByDate));

  // 選択された日付の記事を取得
  const getSelectedDateNews = () => {
    if (!selectedDate) return [];
    return newsByDate[selectedDate] || [];
  };

  // 日付タブをクリックした時の処理
  const handleDateClick = (dateStr: string) => {
    setSelectedDate(selectedDate === dateStr ? null : dateStr);
  };

  return (
    <div className="container-fluid">
      {/* ヘッダー */}
      <nav className="navbar navbar-expand-lg navbar-light bg-white border-bottom">
        <div className="container">
          <a className="navbar-brand fw-bold text-dark" href="#" style={{ fontSize: '1.2rem' }}>
            SlackNews
          </a>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto">
              <li className="nav-item">
                <a className="nav-link text-dark" href="#">週次レポート</a>
              </li>
              <li className="nav-item">
                <a className="nav-link text-dark" href="#">設定</a>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* メインコンテンツ */}
      <div className="container mt-4">
        {/* KPIボード */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-body">
                <div className="row text-center">
                  <div className="col-md-4">
                    <h6 className="text-muted">監視企業数</h6>
                    <h3 className="text-primary">{stats.companyCount}</h3>
                  </div>
                  <div className="col-md-4">
                    <h6 className="text-muted">今週の記事数</h6>
                    <h3 className="text-success">{currentWeekNews.length}</h3>
                  </div>
                  <div className="col-md-4">
                    <h6 className="text-muted">総記事数</h6>
                    <h3 className="text-info">{stats.articleCount}</h3>
                  </div>
                </div>
              </div>
            </div>
        </div>
      </div>

        {/* 企業管理とシステム操作 */}
        <div className="row mb-4">
          <div className="col-lg-6">
            <div className="card">
              <div className="card-header">
                <h5 className="card-title mb-0">企業管理</h5>
              </div>
              <div className="card-body">
                {loading ? (
                  <div className="text-center">
                    <div className="spinner-border" role="status">
                      <span className="visually-hidden">読み込み中...</span>
                    </div>
                  </div>
                ) : companies.length === 0 ? (
                  <div>
                    <p className="text-muted">企業が登録されていません。</p>
                    <button className="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#addCompanyModal">
                      企業を追加
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="list-group mb-3">
                      {companies.map((company) => (
                        <div key={company.id} className="list-group-item py-2">
                          <h6 className="mb-1">{company.name}</h6>
                          <small className="text-muted">{company.url}</small>
                        </div>
                      ))}
                    </div>
                    <button className="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#addCompanyModal">
                      企業を追加
                    </button>
                  </div>
                )}
              </div>
            </div>
      </div>

          <div className="col-lg-6">
            <div className="card">
              <div className="card-header">
                <h5 className="card-title mb-0">システム操作</h5>
              </div>
              <div className="card-body">
                <div className="alert alert-info mb-3">
                  <strong>システム状態:</strong> 待機中
                </div>
                <div className="d-grid gap-2">
                  <button 
                    className="btn btn-success"
                    disabled={actionLoading === 'collection'}
                    onClick={() => handleAction('collection', runCollection)}
                  >
                    {actionLoading === 'collection' ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        実行中...
                      </>
                    ) : (
                      '情報収集実行'
                    )}
                  </button>
                  <button 
                    className="btn btn-outline-primary"
                    disabled={actionLoading === 'daily'}
                    onClick={() => handleAction('daily', sendDailyReport)}
                  >
                    {actionLoading === 'daily' ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        送信中...
                      </>
                    ) : (
                      '日次レポート送信'
                    )}
                  </button>
                  <button 
                    className="btn btn-outline-secondary"
                    disabled={actionLoading === 'weekly'}
                    onClick={() => handleAction('weekly', sendWeeklyReport)}
                  >
                    {actionLoading === 'weekly' ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        送信中...
                      </>
                    ) : (
                      '週次レポート送信'
                    )}
                  </button>
                  <button 
                    className="btn btn-outline-warning"
                    disabled={actionLoading === 'translate'}
                    onClick={() => handleAction('translate', translateDeliveryTargetNews)}
                  >
                    {actionLoading === 'translate' ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        翻訳中...
                      </>
                    ) : (
                      '記事翻訳実行'
                    )}
                  </button>
                  <button 
                    className="btn btn-outline-success"
                    disabled={actionLoading === 'deliver'}
                    onClick={() => handleAction('deliver', deliverNews)}
                  >
                    {actionLoading === 'deliver' ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        配信中...
                      </>
                    ) : (
                      '記事配信実行'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 週次レポートセクション */}
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">レポート</h5>
                <div className="d-flex align-items-center">
                  <button 
                    className="btn btn-outline-secondary btn-sm me-2"
                    onClick={() => changeWeek('prev')}
                  >
                    ←
                  </button>
                  <span className="mx-3">
                    {weekStart.toLocaleDateString('ja-JP')} - {weekEnd.toLocaleDateString('ja-JP')}
            </span>
                  <button 
                    className="btn btn-outline-secondary btn-sm ms-2"
                    onClick={() => changeWeek('next')}
                  >
                    →
                  </button>
                </div>
              </div>
              <div className="card-body">
                {/* 週次レポートステータス */}
                <div className="alert alert-warning mb-3">
                  <strong>週次レポート:</strong> 未作成
                </div>

                {/* 日付タブ */}
                <div className="d-flex mb-3">
                  <ul className="nav nav-pills w-100">
                    {weekDates.map((date, index) => {
                      const dateStr = date.toISOString().split('T')[0];
                      const dayNews = newsByDate[dateStr] || [];
                      const isActive = selectedDate === dateStr;
                      
                      return (
                        <li key={index} className="nav-item flex-fill">
                          <button
                            className={`nav-link w-100 ${isActive ? 'active' : ''} ${dayNews.length === 0 ? 'text-muted' : ''}`}
                            onClick={() => handleDateClick(dateStr)}
                            style={{ 
                              cursor: 'pointer',
                              border: 'none',
                              borderRadius: '0.375rem'
                            }}
                          >
                            <div className="text-center">
                              <div className="fw-bold" style={{ color: isActive ? 'white' : 'inherit' }}>
                                {date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                              </div>
                              <small className="d-block" style={{ color: isActive ? 'white' : 'inherit' }}>
                                {['日', '月', '火', '水', '木', '金', '土'][date.getDay()]}
                              </small>
                              {dayNews.length > 0 && (
                                <span className={`badge ${isActive ? 'bg-light text-dark' : 'bg-secondary'} ms-1`}>
                                  {dayNews.length}
            </span>
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* 選択された日付の記事詳細表示 */}
                {selectedDate && (
                  <div className="mt-3">
                    <div className="card">
                      <div className="card-header">
                        <h6 className="card-title mb-0">
                          {new Date(selectedDate).toLocaleDateString('ja-JP', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            weekday: 'long'
                          })} の記事
                        </h6>
                      </div>
                      <div className="card-body">
                        {getSelectedDateNews().length === 0 ? (
                          <div className="text-center text-muted py-4">
                            <p>この日の記事はありません。</p>
                          </div>
                        ) : (
                          <div className="row">
                            {getSelectedDateNews().map((article) => (
                              <div key={article.id} className="col-12 mb-2">
                                <div className="card border">
                                  <div className="card-body py-2">
                                    <h5 className="card-title mb-2" style={{ fontSize: '1.1rem' }}>
                                      {article.translatedTitle || article.title}
                                    </h5>
                                    <p className="card-text mb-2" style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
                                      {article.translatedContent || article.translatedSummary || 
                                       (article.content && article.content.trim() ? article.content : article.summary)}
                                    </p>
                                    <div className="mb-2">
                                      <small className="text-muted" style={{ fontSize: '0.8rem' }}>
                                        ソースURL: 
                                        <a 
                                          href={article.url} 
          target="_blank"
          rel="noopener noreferrer"
                                          className="text-decoration-none ms-1"
                                          style={{ fontSize: '0.8rem' }}
                                        >
                                          {article.url.length > 50 ? article.url.substring(0, 50) + '...' : article.url}
                                        </a>
                                      </small>
                                    </div>
                                    <div className="d-flex flex-wrap gap-3 mb-0" style={{ fontSize: '0.8rem' }}>
                                      <small className="text-muted">
                                        公開日: {new Date(article.publishedAt).toLocaleString('ja-JP')}
                                      </small>
                                      <small className="text-muted">
                                        取得日: {new Date(article.informationAcquisitionDate).toLocaleString('ja-JP')}
                                      </small>
                                      <div className="d-flex gap-2">
                                        {article.isTranslated && (
                                          <small className="text-success">
                                            ✓ 翻訳済み
                                          </small>
                                        )}
                                        <small className={`badge ${
                                          article.deliveryStatus === 'delivered' ? 'bg-success' :
                                          article.deliveryStatus === 'failed' ? 'bg-danger' :
                                          'bg-warning'
                                        }`}>
                                          {article.deliveryStatus === 'delivered' ? '配信済み' :
                                           article.deliveryStatus === 'failed' ? '配信失敗' :
                                           '配信待ち'}
                                        </small>
                                      </div>
                                      {article.deliveryDate && (
                                        <small className="text-muted">
                                          配信日: {new Date(article.deliveryDate).toLocaleString('ja-JP')}
                                        </small>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* メッセージ表示 */}
        {message && (
          <div className={`alert alert-${message.type === 'success' ? 'success' : 'danger'} alert-dismissible fade show`} role="alert">
            {message.text}
            <button type="button" className="btn-close" onClick={() => setMessage(null)}></button>
          </div>
        )}
      </div>

      {/* 企業追加モーダル */}
      <div className="modal fade" id="addCompanyModal" tabIndex={-1}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">企業を追加</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div className="modal-body">
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleAddCompany(formData);
                const modal = document.getElementById('addCompanyModal');
                if (modal) {
                  const bsModal = (window as any).bootstrap.Modal.getInstance(modal);
                  if (bsModal) bsModal.hide();
                }
              }}>
                <div className="mb-3">
                  <label htmlFor="companyName" className="form-label">企業名</label>
                  <input type="text" className="form-control" id="companyName" name="companyName" required />
                </div>
                <div className="mb-3">
                  <label htmlFor="companyUrl" className="form-label">企業URL</label>
                  <input type="url" className="form-control" id="companyUrl" name="companyUrl" required />
                </div>
                <div className="mb-3">
                  <label htmlFor="rssUrl" className="form-label">RSS URL</label>
                  <input type="url" className="form-control" id="rssUrl" name="rssUrl" />
                </div>
                <div className="mb-3">
                  <label htmlFor="redditUrl" className="form-label">Reddit URL</label>
                  <input type="url" className="form-control" id="redditUrl" name="redditUrl" />
                </div>
                <div className="mb-3">
                  <label htmlFor="priority" className="form-label">優先度</label>
                  <select className="form-select" id="priority" name="priority" defaultValue="2">
                    <option value="1">高</option>
                    <option value="2">中</option>
                    <option value="3">低</option>
                  </select>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">
                    キャンセル
                  </button>
                  <button type="submit" className="btn btn-primary">
                    企業を追加
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}