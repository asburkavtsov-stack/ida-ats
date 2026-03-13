import React from 'react';

const navItems = [
  { key: 'dashboard',  icon: '◈', label: 'Дашборд',    badge: null },
  { key: 'kanban',     icon: '⊞', label: 'Канбан',      badge: '24' },
  { key: 'candidates', icon: '◉', label: 'Кандидати',   badge: '87' },
  { key: 'vacancies',  icon: '◫', label: 'Вакансії',    badge: '6'  },
  { key: 'analytics', icon: '◎', label: 'Аналітика', badge: null },
];

function Sidebar({ currentPage, onNavigate, onLogout }) {
  return (
    <div style={{
      width: '220px',
      background: 'var(--sidebar-bg)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Лого */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontFamily: 'DM Sans', fontSize: '1.4rem', fontWeight: 700, color: 'var(--sidebar-active)', letterSpacing: '-0.5px' }}>
          IDA
        </div>
        <div style={{ fontFamily: 'DM Mono', fontSize: '0.62rem', color: 'rgba(200,176,182,0.4)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '2px' }}>
          ATS System
        </div>
      </div>

      {/* Навігація */}
      <div style={{ padding: '20px 12px 8px' }}>
        <div style={{ fontFamily: 'DM Mono', fontSize: '0.6rem', color: 'rgba(200,176,182,0.3)', letterSpacing: '2px', textTransform: 'uppercase', padding: '0 8px', marginBottom: '6px' }}>
          Головне
        </div>
        {navItems.map(item => (
          <div
            key={item.key}
            onClick={() => onNavigate(item.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '9px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              color: currentPage === item.key ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
              background: currentPage === item.key ? 'var(--sidebar-active)' : 'transparent',
              fontsize: '0.85rem',
              fontWeight: 500,
              marginBottom: '2px',
              transition: 'all 0.15s',
            }}
          >
            <span>{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge && (
              <span style={{
                fontFamily: 'DM Mono',
                fontSize: '0.65rem',
                background: currentPage === item.key ? 'rgba(42,10,18,0.15)' : 'rgba(255,255,255,0.1)',
                color: currentPage === item.key ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
                padding: '2px 7px',
                borderRadius: '20px',
              }}>
                {item.badge}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Юзер */}
      <div style={{ marginTop: 'auto', padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--sidebar-active)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--sidebar-active-text)' }}>
            АБ
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 500 }}>Артем Б.</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--sidebar-text)', fontFamily: 'DM Mono' }}>HR Manager</div>
          </div>
          <div
          onClick={onLogout}
          style={{
            marginTop: '8px',
            padding: '7px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            color: 'rgba(200,176,182,0.5)',
            fontSize: '0.75rem',
            fontFamily: 'DM Mono',
            textAlign: 'center',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(200,176,182,0.5)'}
        >
          ← Вийти
        </div>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;