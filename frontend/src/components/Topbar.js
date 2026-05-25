import React, { useState, useEffect } from 'react';

const pageTitles = {
  dashboard:       'Дашборд',
  kanban:          'Канбан дошка',
  candidates:      'Кандидати',
  vacancies:       'Вакансії',
  analytics:       'Аналітика',
  interviews:      "Інтерв'ю",
  org_settings:    'Організація',
  email_templates: 'Шаблони листів',
  profile:         'Профіль',
  users:           'Юзери системи',
  admin:           'Адмін панель',
};

// Сторінки, де потрібно показувати пошук та кнопку додавання кандидата
const PAGES_WITH_SEARCH_AND_ADD = ['dashboard', 'candidates', 'kanban'];

function Topbar({ currentPage, onAddCandidate, onSearch }) {
  const [query, setQuery] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSearch = e => {
    setQuery(e.target.value);
    onSearch(e.target.value);
  };

  // Перевіряємо, чи потрібно показувати пошук та кнопку
  const showSearchAndAdd = PAGES_WITH_SEARCH_AND_ADD.includes(currentPage);

  return (
    <div style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: isMobile ? '0 16px' : '0 28px',
      paddingLeft: isMobile ? '56px' : '28px',
      height: isMobile ? '48px' : '56px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      flexShrink: 0,
    }}>
      <div style={{ fontFamily: 'DM Sans', fontSize: isMobile ? '0.95rem' : '1.1rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
        {pageTitles[currentPage]}
      </div>

      <div style={{ flex: 1 }} />

      {/* Пошук - показуємо тільки на потрібних сторінках */}
      {showSearchAndAdd && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: '8px', padding: isMobile ? '6px 10px' : '7px 14px',
          width: isMobile ? '140px' : '260px',
          transition: 'width 0.2s',
        }}>
          <span aria-hidden="true" style={{ color: 'var(--muted)' }}>🔍</span>
          <input
            value={query}
            onChange={handleSearch}
            placeholder={isMobile ? 'Пошук...' : 'Пошук кандидатів...'}
            style={{
              border: 'none', background: 'transparent', outline: 'none',
              fontSize: '0.82rem', fontFamily: 'DM Sans', width: '100%',
              color: 'var(--text)',
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); onSearch(''); }}
              aria-label="Очистити пошук"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '0.8rem' }}
            >
              <span aria-hidden="true">✕</span>
            </button>
          )}
        </div>
      )}

      {/* Кнопка додавання - показуємо тільки на потрібних сторінках */}
      {showSearchAndAdd && (
        <button
          onClick={onAddCandidate}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: isMobile ? '7px 10px' : '8px 16px', borderRadius: '8px', fontSize: '0.82rem',
            fontWeight: 600, cursor: 'pointer', border: 'none',
            background: 'var(--accent)', color: '#fff', fontFamily: 'DM Sans',
            whiteSpace: 'nowrap',
          }}
        >
          {isMobile ? '+' : '+ Додати кандидата'}
        </button>
      )}
    </div>
  );
}

export default Topbar;