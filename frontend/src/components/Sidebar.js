import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axiosConfig';

// ─── SVG іконки ──────────────────────────────────────────────────────────────
const ICONS = {
  dashboard:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  kanban:          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="18"/><rect x="10" y="3" width="5" height="11"/><rect x="17" y="3" width="5" height="15"/></svg>,
  candidates:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  vacancies:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>,
  interviews:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  analytics:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  org_settings:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  email_templates: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  profile:         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  admin:           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
  blacklist:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
  users:           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  themes:          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20"/><path d="M12 2v20M2 12h20"/></svg>,
  pricing:         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  promocodes:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  audit_log:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  integrations:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="9" height="9" rx="1"/><rect x="13" y="2" width="9" height="9" rx="1"/><rect x="2" y="13" width="9" height="9" rx="1"/><path d="M13 17.5h4M17.5 13v4"/></svg>,
  tasks:           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  more:            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>,
};

const NAV_ITEMS = {
  superadmin: [
    { key: 'admin',      label: 'Організації', badgeKey: null },
    { key: 'users',      label: 'Юзери',       badgeKey: null },
    { key: 'themes',     label: 'LED-теми',     badgeKey: null },
    { key: 'pricing',    label: 'Ціни',         badgeKey: null },
    { key: 'promocodes', label: 'Промо-коди',   badgeKey: null },
    { key: 'blacklist',  label: 'Чорний список',badgeKey: null },
    { key: 'profile',    label: 'Профіль',      badgeKey: null },
  ],
  admin: [
    { key: 'dashboard',       label: 'Дашборд',       badgeKey: null },
    { key: 'kanban',          label: 'Канбан',         badgeKey: 'kanban' },
    { key: 'candidates',      label: 'Кандидати',      badgeKey: 'candidates' },
    { key: 'vacancies',       label: 'Вакансії',       badgeKey: 'vacancies' },
    { key: 'interviews',      label: "Інтерв'ю",       badgeKey: null },
    { key: 'analytics',       label: 'Аналітика',      badgeKey: null },
    { key: 'audit_log',       label: 'Аудит',          badgeKey: null },
    { key: 'org_settings',    label: 'Організація',    badgeKey: null },
    { key: 'email_templates', label: 'Шаблони листів', badgeKey: null },
    { key: 'integrations',    label: 'Інтеграції',     badgeKey: null },
    { key: 'tasks',           label: 'Завдання',        badgeKey: null },
    { key: 'profile',         label: 'Профіль',        badgeKey: null },
  ],
  hr: [
    { key: 'dashboard',  label: 'Дашборд',  badgeKey: null },
    { key: 'kanban',     label: 'Канбан',   badgeKey: 'kanban' },
    { key: 'candidates', label: 'Кандидати',badgeKey: 'candidates' },
    { key: 'vacancies',  label: 'Вакансії', badgeKey: 'vacancies' },
    { key: 'interviews', label: "Інтерв'ю", badgeKey: null },
    { key: 'tasks',      label: 'Завдання', badgeKey: null },
    { key: 'profile',    label: 'Профіль',  badgeKey: null },
  ],
};

// ─── Нижня навігація для мобайлу — 4 головні + "Ще" ─────────────────────────
const BOTTOM_NAV_KEYS = {
  admin:      ['dashboard', 'kanban', 'candidates', 'vacancies'],
  hr:         ['dashboard', 'kanban', 'candidates', 'vacancies'],
  superadmin: ['admin', 'users', 'themes', 'pricing'],
};

// ─── Компонент Bottom Navigation Bar ─────────────────────────────────────────
function BottomNav({ currentPage, onNavigate, userRole, counts, onMoreOpen }) {
  const mainKeys = BOTTOM_NAV_KEYS[userRole] || BOTTOM_NAV_KEYS.hr;
  const allItems = NAV_ITEMS[userRole] || NAV_ITEMS.hr;
  const mainItems = mainKeys.map(k => allItems.find(i => i.key === k)).filter(Boolean);
  const isMoreActive = !mainKeys.includes(currentPage);

  return (
    <nav
      className="bottom-nav"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '64px',
        background: 'var(--sidebar-bg)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'stretch',
        zIndex: 1000,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {mainItems.map(item => {
        const active = currentPage === item.key;
        return (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: active ? 'var(--sidebar-active-text)' : 'rgba(200,176,182,0.5)',
              position: 'relative',
              transition: 'color 0.15s',
              minHeight: 'unset',
              minWidth: 'unset',
              padding: '8px 4px',
            }}
          >
            {/* Активний індикатор */}
            {active && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '32px',
                height: '3px',
                borderRadius: '0 0 3px 3px',
                background: 'var(--sidebar-active-text)',
              }} />
            )}
            <span style={{ display: 'flex', position: 'relative' }}>
              {ICONS[item.key]}
              {item.badgeKey && counts[item.badgeKey] > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-6px',
                  background: '#dc2626',
                  color: '#fff',
                  fontSize: '0.55rem',
                  fontFamily: 'DM Mono',
                  fontWeight: 700,
                  minWidth: '16px',
                  height: '16px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 3px',
                }}>
                  {counts[item.badgeKey] > 99 ? '99+' : counts[item.badgeKey]}
                </span>
              )}
            </span>
            <span style={{
              fontSize: '0.6rem',
              fontFamily: 'DM Sans',
              fontWeight: active ? 600 : 400,
              letterSpacing: '-0.2px',
            }}>
              {item.label}
            </span>
          </button>
        );
      })}

      {/* Кнопка "Ще" */}
      <button
        onClick={onMoreOpen}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: isMoreActive ? 'var(--sidebar-active-text)' : 'rgba(200,176,182,0.5)',
          position: 'relative',
          transition: 'color 0.15s',
          minHeight: 'unset',
          minWidth: 'unset',
          padding: '8px 4px',
        }}
      >
        {isMoreActive && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '32px',
            height: '3px',
            borderRadius: '0 0 3px 3px',
            background: 'var(--sidebar-active-text)',
          }} />
        )}
        {ICONS.more}
        <span style={{ fontSize: '0.6rem', fontFamily: 'DM Sans', fontWeight: isMoreActive ? 600 : 400 }}>
          Ще
        </span>
      </button>
    </nav>
  );
}

// ─── "Ще" sheet — повний список пунктів ──────────────────────────────────────
function MoreSheet({ onClose, onNavigate, currentPage, userRole, counts, onLogout, user }) {
  const mainKeys = BOTTOM_NAV_KEYS[userRole] || BOTTOM_NAV_KEYS.hr;
  const allItems = NAV_ITEMS[userRole] || NAV_ITEMS.hr;
  const moreItems = allItems.filter(i => !mainKeys.includes(i.key));

  const roleLabels = { superadmin: 'Супер-адмін', admin: 'Адмін орг.', hr: 'HR менеджер' };

  const displayName = user
    ? (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.username)
    : '...';

  const initials = user
    ? (user.first_name && user.last_name
        ? `${user.first_name[0]}${user.last_name[0]}`
        : user.username?.slice(0, 2).toUpperCase())
    : '??';

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 1098,
          animation: 'fadeIn 0.15s ease',
        }}
      />
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--sidebar-bg)',
        borderRadius: '20px 20px 0 0',
        zIndex: 1099,
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
        animation: 'slideUp 0.25s ease',
        maxHeight: '80vh',
        overflowY: 'auto',
      }}>
        {/* Handle */}
        <div style={{
          width: '36px', height: '4px',
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '2px',
          margin: '12px auto 16px',
        }} />

        {/* Юзер */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '0 20px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          marginBottom: '8px',
        }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'var(--sidebar-active)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.85rem', fontWeight: 700, color: 'var(--sidebar-active-text)',
            flexShrink: 0,
          }}>
            {initials}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff' }}>{displayName}</div>
            <div style={{ fontSize: '0.68rem', color: 'rgba(200,176,182,0.5)', fontFamily: 'DM Mono' }}>
              {roleLabels[userRole] || userRole}
            </div>
          </div>
        </div>

        {/* Пункти меню */}
        <div style={{ padding: '0 12px' }}>
          {moreItems.map(item => {
            const active = currentPage === item.key;
            return (
              <button
                key={item.key}
                onClick={() => { onNavigate(item.key); onClose(); }}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: active ? 'var(--sidebar-active)' : 'transparent',
                  color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontFamily: 'DM Sans',
                  fontWeight: active ? 600 : 400,
                  textAlign: 'left',
                  marginBottom: '2px',
                  minHeight: 'unset',
                  minWidth: 'unset',
                }}
              >
                <span style={{ opacity: active ? 1 : 0.7, display: 'flex', flexShrink: 0 }}>
                  {ICONS[item.key]}
                </span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badgeKey && counts[item.badgeKey] > 0 && (
                  <span style={{
                    background: 'rgba(255,255,255,0.15)',
                    color: 'rgba(200,176,182,0.8)',
                    fontSize: '0.68rem', fontFamily: 'DM Mono',
                    padding: '2px 7px', borderRadius: '20px',
                  }}>
                    {counts[item.badgeKey]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Вийти */}
        <div style={{ padding: '12px 20px 0', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '8px' }}>
          <button
            onClick={onLogout}
            style={{
              width: '100%', padding: '14px',
              borderRadius: '10px', border: '1px solid rgba(220,38,38,0.3)',
              background: 'transparent',
              color: '#f87171',
              fontSize: '0.88rem', fontFamily: 'DM Sans',
              cursor: 'pointer', textAlign: 'center',
              minHeight: 'unset', minWidth: 'unset',
            }}
          >
            ← Вийти
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Десктопний Sidebar (незмінний) ──────────────────────────────────────────
function DesktopSidebar({ currentPage, onNavigate, onLogout, userRole, counts, user }) {
  const navItems = NAV_ITEMS[userRole] || NAV_ITEMS.hr;

  const roleLabels = { superadmin: 'Супер-адмін', admin: 'Адмін орг.', hr: 'HR менеджер' };
  const displayName = user
    ? (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.username)
    : '...';
  const initials = user
    ? (user.first_name && user.last_name
        ? `${user.first_name[0]}${user.last_name[0]}`
        : user.username?.slice(0, 2).toUpperCase())
    : '??';

  return (
    <div style={{
      width: '260px',
      background: 'var(--sidebar-bg)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Лого */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontFamily: 'DM Sans', color: 'var(--sidebar-active)', letterSpacing: '-0.5px' }}>
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
        {navItems.map(item => {
          const active = currentPage === item.key;
          return (
            <div
              key={item.key}
              onClick={() => onNavigate(item.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', borderRadius: '8px', cursor: 'pointer',
                color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
                background: active ? 'var(--sidebar-active)' : 'transparent',
                fontSize: '0.85rem', fontWeight: 500,
                marginBottom: '2px', transition: 'all 0.15s',
                minHeight: 'unset', minWidth: 'unset',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, opacity: active ? 1 : 0.7 }}>
                {React.cloneElement(ICONS[item.key], { width: 16, height: 16 })}
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badgeKey && counts[item.badgeKey] > 0 && (
                <span style={{
                  fontFamily: 'DM Mono', fontSize: '0.65rem',
                  background: active ? 'rgba(42,10,18,0.15)' : 'rgba(255,255,255,0.1)',
                  color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
                  padding: '2px 7px', borderRadius: '20px',
                }}>
                  {counts[item.badgeKey]}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Юзер */}
      <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'var(--sidebar-active)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
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
            minHeight: 'unset', minWidth: 'unset',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(200,176,182,0.4)'}
        >
          ← Вийти
        </button>
      </div>
    </div>
  );
}

// ─── Головний компонент ───────────────────────────────────────────────────────
function Sidebar({ currentPage, onNavigate, onLogout, userRole }) {
  const [user, setUser]           = useState(null);
  const [counts, setCounts]       = useState({ candidates: 0, vacancies: 0, kanban: 0 });
  const [isMobile, setIsMobile]   = useState(false);
  const [showMore, setShowMore]   = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    axios.get('/api/me/').then(res => setUser(res.data)).catch(() => {});
    axios.get('/api/candidates/?page_size=1')
      .then(res => {
        const data = res.data.results ?? res.data;
        const active = data.filter(c => c.status !== 'rejected');
        setCounts(c => ({ ...c, candidates: data.length, kanban: active.length }));
      }).catch(() => {});
    axios.get('/api/vacancies/')
      .then(res => {
        const data = res.data.results ?? res.data;
        setCounts(c => ({ ...c, vacancies: data.length }));
      }).catch(() => {});
  }, []);

  const handleNavigate = useCallback((key) => {
    onNavigate(key);
    setShowMore(false);
  }, [onNavigate]);

  if (isMobile) {
    return (
      <>
        <BottomNav
          currentPage={currentPage}
          onNavigate={handleNavigate}
          userRole={userRole}
          counts={counts}
          onMoreOpen={() => setShowMore(true)}
        />
        {showMore && (
          <MoreSheet
            onClose={() => setShowMore(false)}
            onNavigate={handleNavigate}
            currentPage={currentPage}
            userRole={userRole}
            counts={counts}
            onLogout={onLogout}
            user={user}
          />
        )}
      </>
    );
  }

  return (
    <DesktopSidebar
      currentPage={currentPage}
      onNavigate={onNavigate}
      onLogout={onLogout}
      userRole={userRole}
      counts={counts}
      user={user}
    />
  );
}

export default Sidebar;