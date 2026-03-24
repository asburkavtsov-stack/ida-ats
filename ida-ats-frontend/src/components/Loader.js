import React from 'react';

function Loader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '60px', flexDirection: 'column', gap: '14px',
    }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: '50%',
        border: '3px solid var(--border)',
        borderTop: '3px solid var(--accent)',
        animation: 'spin 0.8s linear infinite',
      }} />
      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
        Завантаження...
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default Loader;