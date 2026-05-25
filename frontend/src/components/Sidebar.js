import React, { useState, useEffect } from 'react';
import axios from 'axiosConfig';

function Sidebar({ currentPage, onNavigate, onLogout, userRole }) {
  const [user, setUser] = useState(null);
  const [counts, setCounts] = useState({ candidates: 0, vacancies: 0, kanban: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const ICONS = {
    dashboard:       (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>),
    kanban:          (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="18"/><rect x="10" y="3" width="5" height="11"/><rect x="17" y="3" width="5" height="15"/></svg>),
    candidates:      (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
    vacancies:       (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>),
    interviews:      (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>),
    analytics:       (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>),
    org_settings:    (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>),
    email_templates: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>),
    profile:         (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>),
    admin:           (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>),
    users:           (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
  };

  const navItems = userRole === 'superadmin' ? [
    { key: 'admin',   label: 'Організації', badgeKey: null },
    { key: 'users',   label: 'Юзери',       badgeKey: null },
    { key: 'profile', label: 'Профіль',     badgeKey: null },
  ] : userRole === 'admin' ? [
    { key: 'dashboard',       label: 'Дашборд',         badgeKey: null },
    { key: 'kanban',          label: 'Канбан',           badgeKey: 'kanban' },
    { key: 'candidates',      label: 'Кандидати',        badgeKey: 'candidates' },
    { key: 'vacancies',       label: 'Вакансії',         badgeKey: 'vacancies' },
    { key: 'interviews',      label: "Інтерв'ю",         badgeKey: 'InterviewClendar' },
    { key: 'analytics',       label: 'Аналітика',        badgeKey: null },
    { key: 'org_settings',    label: 'Організація',      badgeKey: null },
    { key: 'email_templates', label: 'Шаблони листів',   badgeKey: null },
    { key: 'profile',         label: 'Профіль',          badgeKey: null },
  ] : [
    { key: 'dashboard',  label: 'Дашборд',   badgeKey: null },
    { key: 'kanban',     label: 'Канбан',     badgeKey: 'kanban' },
    { key: 'candidates', label: 'Кандидати',  badgeKey: 'candidates' },
    { key: 'vacancies',  label: 'Вакансії',   badgeKey: 'vacancies' },
    { key: 'interviews', label: "Інтерв'ю",   badgeKey: 'InterviewClendar' },
    { key: 'profile',    label: 'Профіль',    badgeKey: null },
  ];

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    axios.get('/api/me/').then(res => setUser(res.data)).catch(() => {});

    axios.get("/api/candidates/?page_size=1")
      .then(res => {
        const active = res.data.filter(c => c.status !== 'rejected');
        setCounts(c => ({ ...c, candidates: res.data.length, kanban: active.length }));
      })
      .catch(() => {});

    axios.get('/api/vacancies/')
      .then(res => setCounts(c => ({ ...c, vacancies: res.data.length })))
      .catch(() => {});
  }, []);

  const initials = user
    ? (user.first_name && user.last_name
        ? `${user.first_name[0]}${user.last_name[0]}`
        : user.username?.slice(0, 2).toUpperCase())
    : '??';

  const displayName = user
    ? (user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.username)
    : '...';

  const roleLabels = {
    superadmin: 'Супер-адмін',
    admin: 'Адмін орг.',
    hr: 'HR менеджер',
  };

  const handleNavClick = (key) => {
    onNavigate(key);
    setMobileOpen(false);
  };

  const sidebarContent = (
    <>
      {/* Лого */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div aria-label="IDA ATS System" role="img" style={{ fontFamily: 'DM Sans', color: 'var(--sidebar-active)', letterSpacing: '-0.5px' }}>
          IDA
        </div>
        <div style={{ fontFamily: 'DM Mono', fontSize: '0.62rem', color: 'rgba(200,176,182,0.4)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '2px' }}>
          ATS System
        </div>
      </div>

      {/* Навігація */}
      <div style={{ padding: '20px 12px 8px', flex: 1 }}>
        <div style={{ fontFamily: 'DM Mono', fontSize: '0.6rem', color: 'rgba(200,176,182,0.3)', letterSpacing: '2px', textTransform: 'uppercase', padding: '0 8px', marginBottom: '6px' }}>
          Головне
        </div>
        {navItems.map(item => (
          <div
            key={item.key}
            onClick={() => handleNavClick(item.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: isMobile ? '11px 14px' : '9px 12px', borderRadius: '8px', cursor: 'pointer',
              color: currentPage === item.key ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
              background: currentPage === item.key ? 'var(--sidebar-active)' : 'transparent',
              fontSize: '0.85rem', fontWeight: 500, marginBottom: '2px', transition: 'all 0.15s',
            }}
          >
            <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', flexShrink: 0, opacity: currentPage === item.key ? 1 : 0.7 }}>
              {ICONS[item.key]}
            </span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badgeKey && counts[item.badgeKey] > 0 && (
              <span style={{
                fontFamily: 'DM Mono', fontSize: '0.65rem',
                background: currentPage === item.key ? 'rgba(42,10,18,0.15)' : 'rgba(255,255,255,0.1)',
                color: currentPage === item.key ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
                padding: '2px 7px', borderRadius: '20px',
              }}>
                {counts[item.badgeKey]}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Юзер */}
      <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'var(--sidebar-active)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '0.75rem', fontWeight: 700, color: 'var(--sidebar-active-text)', flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {displayName}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(200,176,182,0.5)', fontFamily: 'DM Mono' }}>
              {roleLabels[userRole] || userRole}
            </div>
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{
            width: '100%', padding: '7px 12px', borderRadius: '8px', cursor: 'pointer',
            color: 'rgba(200,176,182,0.4)', fontSize: '0.75rem',
            fontFamily: 'DM Mono', textAlign: 'center', transition: 'all 0.15s',
            background: 'transparent', border: 'none',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(200,176,182,0.4)'}
        >
          ← Вийти
        </button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        {/* Кнопка гамбургер */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{
            position: 'fixed', top: '12px', left: '12px', zIndex: 1100,
            width: '40px', height: '40px', borderRadius: '8px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            color: 'var(--text)', fontSize: '1.2rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow)',
          }}
        >
          ☰
        </button>

        {/* Overlay */}
        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              zIndex: 1098,
            }}
          />
        )}

        {/* Мобільний сайдбар */}
        <div style={{
          position: 'fixed', top: 0, left: 0, bottom: 0,
          width: '260px', background: 'var(--sidebar-bg)',
          display: 'flex', flexDirection: 'column',
          zIndex: 1099,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
        }}>
          {sidebarContent}
        </div>
      </>
    );
  }

  return (
    <div style={{
      width: '220px', background: 'var(--sidebar-bg)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {sidebarContent}
    </div>
  );
}

export default Sidebar;