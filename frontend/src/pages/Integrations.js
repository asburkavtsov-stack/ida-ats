import React, { useState } from 'react';

const INTEGRATIONS = [
  {
    key: 'dou',
    name: 'DOU',
    description: 'Публікація вакансій та імпорт відгуків з DOU.ua',
    color: '#f26822',
    bg: '#fff3e0',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 12h8M12 8v8"/>
      </svg>
    ),
    status: 'disconnected',
  },
  {
    key: 'work_ua',
    name: 'Work.ua',
    description: 'Автоматичний імпорт резюме та публікація вакансій на Work.ua',
    color: '#1a73e8',
    bg: '#e8f0fe',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/>
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
        <line x1="12" y1="12" x2="12" y2="16"/>
        <line x1="10" y1="14" x2="14" y2="14"/>
      </svg>
    ),
    status: 'disconnected',
  },
];

const COMING_SOON = [
  { key: 'linkedin',  name: 'LinkedIn Jobs', color: '#0a66c2' },
  { key: 'robota',    name: 'Robota.ua',     color: '#e53935' },
  { key: 'telegram',  name: 'Telegram Bot',  color: '#229ED9' },
];

function Integrations() {
  const [connected, setConnected] = useState({});
  const [loading, setLoading]   = useState({});

  const handleConnect = (key) => {
    setLoading(l => ({ ...l, [key]: true }));
    // TODO: замінити на реальний OAuth/API flow
    setTimeout(() => {
      setLoading(l => ({ ...l, [key]: false }));
      alert(`Інтеграція з ${key === 'dou' ? 'DOU' : 'Work.ua'} — скоро буде доступна. Функціонал у розробці.`);
    }, 800);
  };

  const handleDisconnect = (key) => {
    setConnected(c => ({ ...c, [key]: false }));
  };

  return (
    <div style={{ maxWidth: '720px' }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Інтеграції</h2>
        <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: 'var(--muted)' }}>
          Підключіть джоб-борди для автоматичного імпорту відгуків та публікації вакансій.
        </p>
      </div>

      {/* Active integrations */}
      <div style={{ fontFamily: 'DM Mono', fontSize: '0.6rem', color: 'var(--muted)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>
        Доступні
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '36px' }}>
        {INTEGRATIONS.map(int => {
          const isConnected = !!connected[int.key];
          const isLoading   = !!loading[int.key];

          return (
            <div key={int.key} style={{
              background: 'var(--surface)',
              border: `1px solid ${isConnected ? int.color + '60' : 'var(--border)'}`,
              borderRadius: '12px',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '18px',
              transition: 'border-color 0.2s',
            }}>
              {/* Icon */}
              <div style={{
                width: '52px', height: '52px', borderRadius: '12px',
                background: int.bg, color: int.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {int.icon}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {int.name}
                  {isConnected && (
                    <span style={{
                      fontSize: '0.62rem', fontFamily: 'DM Mono', padding: '2px 8px',
                      borderRadius: '20px', background: '#dcfce7', color: '#16a34a',
                      letterSpacing: '0.5px',
                    }}>
                      ● Підключено
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '4px' }}>
                  {int.description}
                </div>
              </div>

              {/* Action */}
              {isConnected ? (
                <button
                  onClick={() => handleDisconnect(int.key)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--muted)', fontSize: '0.78rem', fontFamily: 'DM Mono',
                    whiteSpace: 'nowrap', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#dc2626'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  Відключити
                </button>
              ) : (
                <button
                  onClick={() => handleConnect(int.key)}
                  disabled={isLoading}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', cursor: isLoading ? 'not-allowed' : 'pointer',
                    border: 'none', background: int.color,
                    color: '#fff', fontSize: '0.78rem', fontFamily: 'DM Mono',
                    whiteSpace: 'nowrap', opacity: isLoading ? 0.7 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {isLoading ? '...' : `Підключити ${int.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Coming soon */}
      <div style={{ fontFamily: 'DM Mono', fontSize: '0.6rem', color: 'var(--muted)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>
        Незабаром
      </div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {COMING_SOON.map(item => (
          <div key={item.key} style={{
            padding: '10px 16px', borderRadius: '8px',
            border: '1px dashed var(--border)',
            fontSize: '0.8rem', color: 'var(--muted)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, opacity: 0.5 }} />
            {item.name}
          </div>
        ))}
      </div>

    </div>
  );
}

export default Integrations;