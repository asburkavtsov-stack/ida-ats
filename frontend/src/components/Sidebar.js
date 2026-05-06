import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Sidebar({ currentPage, onNavigate, onLogout, userRole }) {
  const [user, setUser] = useState(null);
  const [counts, setCounts] = useState({ candidates: 0, vacancies: 0, kanban: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = userRole === 'superadmin' ? [
    { key: 'admin', icon: '⚙', label: 'Організації' },
    { key: 'users', icon: '👥', label: 'Юзери' },
  ] : userRole === 'admin' ? [
    { key: 'dashboard',    icon: '◈', label: 'Дашборд',      badgeKey: null },
    { key: 'kanban',       icon: '⊞', label: 'Канбан',        badgeKey: 'kanban' },
    { key: 'candidates',   icon: '◉', label: 'Кандидати',     badgeKey: 'candidates' },
    { key: 'vacancies',    icon: '◫', label: 'Вакансії',      badgeKey: 'vacancies' },
    { key: 'analytics',   icon: '◎', label: 'Аналітика',     badgeKey: null },
    { key: 'org_settings', icon: '🏢', label: 'Організація',  badgeKey: null },
    { key: 'email_templates', icon: '✉', label: 'Шаблони листів', badgeKey: null },
    { key: 'profile',      icon: '◉', label: 'Профіль',       badgeKey: null },
  ] : [
    { key: 'dashboard',  icon: '◈', label: 'Дашборд',    badgeKey: null },
    { key: 'kanban',     icon: '⊞', label: 'Канбан',      badgeKey: 'kanban' },
    { key: 'candidates', icon: '◉', label: 'Кандидати',   badgeKey: 'candidates' },
    { key: 'vacancies',  icon: '◫', label: 'Вакансії',    badgeKey: 'vacancies' },
    { key: 'analytics',  icon: '◎', label: 'Аналітика',   badgeKey: null },
    { key: 'profile',    icon: '◉', label: 'Профіль',     badgeKey: null },
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
            <span aria-hidden="true">{item.icon}</span>
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