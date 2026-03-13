import React, { useState } from 'react';
import axios from 'axios';

function Login({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = () => {
    setLoading(true);
    setError('');
    axios.post('http://127.0.0.1:8000/api/auth/login/', form)
      .then(res => {
        localStorage.setItem('access_token', res.data.access);
        localStorage.setItem('refresh_token', res.data.refresh);
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.access}`;
        onLogin();
      })
      .catch(() => {
        setError('Невірний логін або пароль');
        setLoading(false);
      });
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '40px', width: '380px',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Лого */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            fontFamily: 'DM Sans', fontSize: '2rem', fontWeight: 700,
            color: 'var(--accent)', letterSpacing: '-1px',
          }}>
            IDA
          </div>
          <div style={{
            fontFamily: 'DM Mono', fontSize: '0.65rem', color: 'var(--muted)',
            letterSpacing: '3px', textTransform: 'uppercase', marginTop: '4px',
          }}>
            ATS System
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>
            Вхід в систему
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
            Введіть ваші дані для входу
          </div>
        </div>

        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: '8px',
            background: '#fce4ec', color: '#c2185b',
            fontSize: '0.78rem', marginBottom: '16px',
            fontFamily: 'DM Mono',
          }}>
            ⚠ {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{
              display: 'block', fontSize: '0.72rem', fontWeight: 600,
              fontFamily: 'DM Mono', textTransform: 'uppercase',
              letterSpacing: '0.5px', marginBottom: '6px',
            }}>
              Логін
            </label>
            <input
              name="username"
              placeholder="your_username"
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              style={{
                width: '100%', padding: '10px 14px',
                border: '1px solid var(--border)', borderRadius: '8px',
                fontSize: '0.85rem', fontFamily: 'DM Sans',
                background: 'var(--bg)', outline: 'none',
              }}
            />
          </div>
          <div>
            <label style={{
              display: 'block', fontSize: '0.72rem', fontWeight: 600,
              fontFamily: 'DM Mono', textTransform: 'uppercase',
              letterSpacing: '0.5px', marginBottom: '6px',
            }}>
              Пароль
            </label>
            <input
              name="password"
              type="password"
              placeholder="••••••••"
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              style={{
                width: '100%', padding: '10px 14px',
                border: '1px solid var(--border)', borderRadius: '8px',
                fontSize: '0.85rem', fontFamily: 'DM Sans',
                background: 'var(--bg)', outline: 'none',
              }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%', padding: '11px', borderRadius: '8px',
              border: 'none', background: 'var(--accent)', color: '#fff',
              fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'DM Sans', marginTop: '4px',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Вхід...' : 'Увійти →'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;