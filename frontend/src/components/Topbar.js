import React, { useState, useEffect } from 'react';
import AdvancedSearchBar from './AdvancedSearchBar';

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

  const handleSearch = (val) => {
    setQuery(val);
    onSearch(val);
  };

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

      {showSearchAndAdd && (
        <AdvancedSearchBar
          value={query}
          onChange={handleSearch}
          isMobile={isMobile}
        />
      )}

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