// components/GDPRConsentCheckbox.js
// Компонент згоди GDPR — використовується в AddCandidateModal та публічних формах
import React, { useState, useEffect } from 'react';
import axios from 'axiosConfig';

function GDPRConsentCheckbox({ checked, onChange, required = true, isMobile = false }) {
  const [consentText, setConsentText] = useState('');
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    axios.get('/api/gdpr/settings/')
      .then(res => setConsentText(res.data.consent_text || ''))
      .catch(() => setConsentText(
        'Я надаю згоду на обробку моїх персональних даних відповідно до вимог GDPR.'
      ));
  }, []);

  const preview = consentText.length > 120
    ? consentText.slice(0, 120) + '...'
    : consentText;

  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: '10px',
      border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
      background: checked ? '#f9eaed33' : 'var(--bg)',
      transition: 'all 0.15s',
    }}>
      <label style={{
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        cursor: 'pointer',
      }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          required={required}
          style={{
            marginTop: '2px',
            width: '16px',
            height: '16px',
            accentColor: 'var(--accent)',
            flexShrink: 0,
            cursor: 'pointer',
          }}
        />
        <div style={{ fontSize: isMobile ? '0.82rem' : '0.78rem', lineHeight: '1.5', color: 'var(--text)' }}>
          <span style={{ fontWeight: 600 }}>Згода на обробку персональних даних</span>
          {required && <span style={{ color: '#dc2626', marginLeft: '3px' }}>*</span>}
          <div style={{ marginTop: '4px', color: 'var(--muted)', fontSize: '0.75rem' }}>
            {showFull ? consentText : preview}
            {consentText.length > 120 && (
              <button
                type="button"
                onClick={() => setShowFull(v => !v)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--accent)', fontSize: '0.73rem',
                  fontFamily: 'DM Mono', marginLeft: '4px', padding: 0,
                  textDecoration: 'underline',
                }}
              >
                {showFull ? 'Згорнути' : 'Читати повністю'}
              </button>
            )}
          </div>
        </div>
      </label>

      {checked && (
        <div style={{
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.7rem',
          color: '#16a34a',
          fontFamily: 'DM Mono',
        }}>
          ✓ Згоду надано
        </div>
      )}
    </div>
  );
}

export default GDPRConsentCheckbox;