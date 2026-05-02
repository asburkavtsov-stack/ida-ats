import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Loader from '../components/Loader';
import CandidateCardModal from '../components/CandidateCardModal';
import { STATUS_FILTERS, getStatusLabel, getStatusBg, getStatusText } from '../constants/statusColors';

const formatDate = (dateString) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
};

function Candidates({ searchQuery = '' }) {
  const [filter, setFilter] = useState('all');
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const PAGE_SIZE = 20;

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchCandidates = useCallback((page = 1) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('page_size', PAGE_SIZE);
    if (filter !== 'all') params.set('status', filter);
    if (searchQuery) params.set('search', searchQuery);

    axios.get(`/api/candidates/?${params.toString()}`)
      .then(res => {
        if (res.data.results !== undefined) {
          setCandidates(res.data.results);
          setTotalPages(res.data.total_pages || 1);
          setTotalCount(res.data.count || 0);
        } else {
          setCandidates(res.data);
          setTotalPages(1);
          setTotalCount(res.data.length);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [filter, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  useEffect(() => {
    fetchCandidates(currentPage);
  }, [fetchCandidates, currentPage]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);
      if (searchQuery) params.set('search', searchQuery);

      const response = await axios.get(`/api/candidates/export/?${params.toString()}`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.setAttribute('download', `candidates_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Помилка експорту CSV:', err);
      alert('Не вдалося експортувати CSV');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ padding: isMobile ? '8px' : '0' }}>
      {/* Фільтри */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map(f => (
          <div
            key={f.key}
            onClick={() => setFilter(f.key)}
            role="button"
            tabIndex={0}
            aria-label={`Фільтр: ${f.label}`}
            aria-pressed={filter === f.key}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFilter(f.key); }}}
            style={{
              padding: isMobile ? '8px 14px' : '6px 14px', borderRadius: '20px', fontSize: '0.78rem',
              fontWeight: 500, cursor: 'pointer',
              border: `1px solid ${filter === f.key ? 'var(--accent)' : 'var(--border)'}`,
              background: filter === f.key ? 'var(--accent)' : 'var(--surface)',
              color: filter === f.key ? '#fff' : 'var(--muted)',
              transition: 'all 0.15s',
            }}
          >
            {f.label}
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {totalCount > 0 && (
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
              {totalCount} кандидатів
            </span>
          )}
          <button
            onClick={handleExportCSV}
            disabled={exporting || totalCount === 0}
            aria-label={exporting ? 'Експорт CSV триває' : 'Експортувати список кандидатів у CSV'}
            type="button"
            style={{
              padding: isMobile ? '8px 14px' : '6px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: exporting || totalCount === 0 ? 'var(--muted)' : 'var(--text)',
              fontSize: '0.78rem',
              cursor: exporting || totalCount === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: exporting || totalCount === 0 ? 0.6 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            <span aria-hidden="true">{exporting ? '⏳' : '⬇'}</span> {exporting ? 'Експорт...' : 'Експорт CSV'}
          </button>
        </div>
      </div>

      {/* Таблиця / Картки */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
        {isMobile ? (
          /* Мобільний вигляд — картки */
          <div>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <Loader />
              </div>
            ) : candidates.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.82rem', fontFamily: 'DM Mono' }}>
                Кандидатів не знайдено
              </div>
            ) : (
              candidates.map((c, i) => (
                <div
                  key={c.id || i}
                  role="button"
                  tabIndex={0}
                  aria-label={`Кандидат ${c.first_name} ${c.last_name}, вакансія ${c.vacancy_title || '—'}, статус ${getStatusLabel(c.status)}, додано ${formatDate(c.created_at)}`}
                  onClick={() => setSelectedCandidateId(c.id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCandidateId(c.id); }}}
                  style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                        {c.first_name} {c.last_name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '2px' }}>
                        {c.email}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.66rem', fontFamily: 'DM Mono', padding: '3px 8px',
                      borderRadius: '4px', flexShrink: 0,
                      background: getStatusBg(c.status),
                      color: getStatusText(c.status),
                    }}>
                      {getStatusLabel(c.status)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      {c.vacancy_title || '—'}
                    </div>
                    <div style={{ fontFamily: 'DM Mono', fontSize: '0.7rem', color: 'var(--muted)' }}>
                      {formatDate(c.created_at)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Десктоп — таблиця */
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['Кандидат', 'Вакансія', 'Статус', 'Дата'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.72rem', fontFamily: 'DM Mono', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid var(--border)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ padding: '40px', textAlign: 'center' }}>
                    <Loader />
                  </td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.82rem', fontFamily: 'DM Mono' }}>
                    Кандидатів не знайдено
                  </td>
                </tr>
              ) : candidates.map((c, i) => (
                <tr
                  key={c.id || i}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                  onClick={() => setSelectedCandidateId(c.id)}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                      {c.first_name} {c.last_name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '1px' }}>
                      {c.email}
                    </div>
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: '0.82rem' }}>
                    {c.vacancy_title || '—'}
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{
                      fontSize: '0.66rem', fontFamily: 'DM Mono', padding: '3px 8px',
                      borderRadius: '4px',
                      background: getStatusBg(c.status),
                      color: getStatusText(c.status),
                    }}>
                      {getStatusLabel(c.status)}
                    </span>
                  </td>
                  <td style={{ padding: '13px 16px', fontFamily: 'DM Mono', fontSize: '0.72rem', color: 'var(--muted)' }}>
                    {formatDate(c.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Пагінація */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '6px', marginTop: '20px', flexWrap: 'wrap',
        }}>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Попередня сторінка"
            type="button"
            style={{
              padding: isMobile ? '9px 16px' : '7px 14px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: currentPage === 1 ? 'var(--muted)' : 'var(--text)',
              fontSize: '0.78rem', cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontFamily: 'DM Mono', opacity: currentPage === 1 ? 0.5 : 1,
            }}
          >
            <span aria-hidden="true">←</span> Назад
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
              acc.push(p);
              return acc;
            }, [])
            .map((p, idx) =>
              p === '...' ? (
                <span key={`dots-${idx}`} style={{ padding: '0 4px', color: 'var(--muted)', fontFamily: 'DM Mono', fontSize: '0.78rem' }} aria-hidden="true">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => handlePageChange(p)}
                  aria-label={`Сторінка ${p}${currentPage === p ? ', поточна' : ''}`}
                  aria-current={currentPage === p ? 'page' : undefined}
                  type="button"
                  style={{
                    width: isMobile ? '42px' : '36px', height: isMobile ? '42px' : '36px', borderRadius: '8px',
                    border: `1px solid ${currentPage === p ? 'var(--accent)' : 'var(--border)'}`,
                    background: currentPage === p ? 'var(--accent)' : 'var(--surface)',
                    color: currentPage === p ? '#fff' : 'var(--text)',
                    fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'DM Mono',
                    fontWeight: currentPage === p ? 700 : 400,
                  }}
                >
                  {p}
                </button>
              )
            )
          }

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Наступна сторінка"
            type="button"
            style={{
              padding: isMobile ? '9px 16px' : '7px 14px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: currentPage === totalPages ? 'var(--muted)' : 'var(--text)',
              fontSize: '0.78rem', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              fontFamily: 'DM Mono', opacity: currentPage === totalPages ? 0.5 : 1,
            }}
          >
            Вперед <span aria-hidden="true">→</span>
          </button>
        </div>
      )}

      {selectedCandidateId && (
        <CandidateCardModal
          candidateId={selectedCandidateId}
          onClose={() => setSelectedCandidateId(null)}
          onStatusChange={(id, status) => {
            setCandidates(prev => prev.map(c =>
              c.id === id ? { ...c, status } : c
            ));
          }}
          onDelete={(id) => {
            setCandidates(prev => prev.filter(c => c.id !== id));
            setSelectedCandidateId(null);
            setTotalCount(prev => prev - 1);
          }}
        />
      )}
    </div>
  );
}

export default Candidates;