import React, { useState } from 'react';

const pageTitles = {
  dashboard:  'Дашборд',
  kanban:     'Канбан дошка',
  candidates: 'Кандидати',
  vacancies:  'Вакансії',
  analytics:  'Аналітика',
};

function Topbar({ currentPage, onAddCandidate, onSearch }) {
  const [query, setQuery] = useState('');

  const handleSearch = e => {
    setQuery(e.target.value);
    onSearch(e.target.value);
  };

  return (
    <div style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 28px',
      height: '56px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      flexShrink: 0,
    }}>
      <div style={{ fontFamily: 'DM Sans', fontSize: '1.1rem', fontWeight: 600 }}>
        {pageTitles[currentPage]}
      </div>

      <div style={{ flex: 1 }} />

      {/* Пошук */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: '8px', padding: '7px 14px', width: '260px',
      }}>
        <span style={{ color: 'var(--muted)' }}>🔍</span>
        <input
          value={query}
          onChange={handleSearch}
          placeholder="Пошук кандидатів..."
          style={{
            border: 'none', background: 'transparent', outline: 'none',
            fontSize: '0.82rem', fontFamily: 'DM Sans', width: '100%',
            color: 'var(--text)',
          }}
        />
        {query && (
          <span
            onClick={() => { setQuery(''); onSearch(''); }}
            style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: '0.8rem' }}
          >
            ✕
          </span>
        )}
      </div>

      {/* Кнопка */}
      <button
        onClick={onAddCandidate}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 16px', borderRadius: '8px', fontSize: '0.82rem',
          fontWeight: 600, cursor: 'pointer', border: 'none',
          background: 'var(--accent)', color: '#fff', fontFamily: 'DM Sans',
        }}
      >
        + Додати кандидата
      </button>
    </div>
  );
}

export default Topbar;