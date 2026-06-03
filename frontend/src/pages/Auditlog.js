// pages/AuditLog.js
// Сторінка логів дій — тільки для admin/superadmin
import React, { useState, useEffect, useCallback } from 'react';
import { auditApi } from '../api/auditApi';

const ACTION_LABELS = {
  view:          'Перегляд',
  create:        'Створення',
  update:        'Оновлення',
  delete:        'Видалення',
  status_change: 'Зміна статусу',
  assign:        'Призначення',
  export:        'Експорт',
  access_grant:  'Надання доступу',
  access_revoke: 'Відкликання доступу',
};

const ACTION_COLORS = {
  delete:        { bg: '#fee2e2', text: '#dc2626' },
  status_change: { bg: '#fff3e0', text: '#c94f2a' },
  assign:        { bg: '#f0fdf4', text: '#16a34a' },
  access_grant:  { bg: '#ede9fe', text: '#7c3aed' },
  access_revoke: { bg: '#fce7f3', text: '#db2777' },
  create:        { bg: '#f9eaed', text: '#7a1a2e' },
  export:        { bg: '#f5f5f5', text: '#757575' },
};

const formatDateTime = (dt) => {
  if (!dt) return '—';
  const d = new Date(dt);
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

function ActionBadge({ action }) {
  const cfg = ACTION_COLORS[action] || { bg: '#f5f5f5', text: '#757575' };
  return (
    <span style={{
      fontSize: '0.66rem', fontFamily: 'DM Mono',
      padding: '3px 8px', borderRadius: '4px',
      background: cfg.bg, color: cfg.text,
      whiteSpace: 'nowrap',
    }}>
      {ACTION_LABELS[action] || action}
    </span>
  );
}

function AuditLog() {
  const [logs,        setLogs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [totalCount,  setTotalCount]  = useState(0);
  const [filterAction, setFilterAction] = useState('');
  const [filterModel,  setFilterModel]  = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const PAGE_SIZE = 30;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const fetchLogs = useCallback((page = 1) => {
    setLoading(true);
    const params = { page, page_size: PAGE_SIZE };
    if (filterAction) params.action     = filterAction;
    if (filterModel)  params.model_name = filterModel;

    auditApi.list(params)
      .then(data => {
        if (data.results !== undefined) {
          setLogs(data.results);
          setTotalPages(data.total_pages || Math.ceil(data.count / PAGE_SIZE) || 1);
          setTotalCount(data.count || 0);
        } else {
          setLogs(data);
          setTotalPages(1);
          setTotalCount(data.length);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [filterAction, filterModel]);

  useEffect(() => { setCurrentPage(1); }, [filterAction, filterModel]);
  useEffect(() => { fetchLogs(currentPage); }, [fetchLogs, currentPage]);

  const selectStyle = {
    padding: '6px 10px', borderRadius: '8px',
    border: '1px solid var(--border)', background: 'var(--surface)',
    fontSize: '0.78rem', fontFamily: 'DM Mono', color: 'var(--text)',
    cursor: 'pointer', outline: 'none',
  };

  return (
    <div style={{ padding: isMobile ? '8px' : '0' }}>

      {/* ── Фільтри ── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)} style={selectStyle}>
          <option value="">Всі дії</option>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select value={filterModel} onChange={e => setFilterModel(e.target.value)} style={selectStyle}>
          <option value="">Всі моделі</option>
          <option value="Candidate">Кандидати</option>
          <option value="Vacancy">Вакансії</option>
        </select>
        {(filterAction || filterModel) && (
          <button
            onClick={() => { setFilterAction(''); setFilterModel(''); }}
            style={{ ...selectStyle, border: '1px solid var(--accent)', color: 'var(--accent)', cursor: 'pointer' }}
          >
            ✕ Скинути
          </button>
        )}
        <div style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
          {loading ? 'Завантаження...' : `${totalCount} записів`}
        </div>
      </div>

      {/* ── Таблиця ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
        {isMobile ? (
          /* Mobile cards */
          <div>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'DM Mono', fontSize: '0.82rem' }}>
                Завантаження...
              </div>
            ) : logs.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'DM Mono', fontSize: '0.82rem' }}>
                Записів не знайдено
              </div>
            ) : logs.map(log => (
              <div key={log.id} style={{
                padding: '14px 16px', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <ActionBadge action={log.action} />
                  <span style={{ fontSize: '0.68rem', fontFamily: 'DM Mono', color: 'var(--muted)' }}>
                    {formatDateTime(log.created_at)}
                  </span>
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '2px' }}>
                  {log.object_repr || `${log.model_name} #${log.object_id}`}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
                  {log.user_name} · {log.model_name}
                </div>
                {log.extra_data && Object.keys(log.extra_data).length > 0 && (
                  <div style={{
                    marginTop: '6px', fontSize: '0.68rem', fontFamily: 'DM Mono',
                    color: 'var(--muted)', padding: '4px 8px',
                    background: 'var(--bg)', borderRadius: '4px',
                  }}>
                    {JSON.stringify(log.extra_data)}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Desktop table */
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['Дія', 'Об\'єкт', 'Модель', 'Користувач', 'Деталі', 'Час'].map(h => (
                  <th key={h} style={{
                    padding: '11px 16px', textAlign: 'left',
                    fontSize: '0.72rem', fontFamily: 'DM Mono',
                    color: 'var(--muted)', textTransform: 'uppercase',
                    letterSpacing: '0.8px', borderBottom: '1px solid var(--border)',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'DM Mono', fontSize: '0.82rem' }}>
                  Завантаження...
                </td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'DM Mono', fontSize: '0.82rem' }}>
                  Записів не знайдено
                </td></tr>
              ) : logs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <ActionBadge action={log.action} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                      {log.object_repr || `#${log.object_id}`}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.78rem', fontFamily: 'DM Mono', color: 'var(--muted)' }}>
                    {log.model_name}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.82rem' }}>
                    {log.user_name || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', maxWidth: '220px' }}>
                    {log.extra_data && Object.keys(log.extra_data).length > 0 ? (
                      <span style={{
                        fontSize: '0.68rem', fontFamily: 'DM Mono',
                        color: 'var(--muted)', whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}>
                        {Object.entries(log.extra_data)
                          .map(([k, v]) => `${k}: ${v ?? '—'}`)
                          .join(' · ')}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.72rem', fontFamily: 'DM Mono', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {formatDateTime(log.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Пагінація ── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '20px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '7px 14px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--surface)',
              fontSize: '0.78rem', fontFamily: 'DM Mono',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage === 1 ? 0.5 : 1,
            }}
          >← Назад</button>

          <span style={{ fontSize: '0.78rem', fontFamily: 'DM Mono', color: 'var(--muted)', padding: '0 8px' }}>
            {currentPage} / {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '7px 14px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--surface)',
              fontSize: '0.78rem', fontFamily: 'DM Mono',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              opacity: currentPage === totalPages ? 0.5 : 1,
            }}
          >Вперед →</button>
        </div>
      )}
    </div>
  );
}

export default AuditLog;