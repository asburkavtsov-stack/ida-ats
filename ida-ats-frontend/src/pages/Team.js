// pages/Team.js - оновлена версія з діагностикою
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: '8px',
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'DM Sans',
  outline: 'none', boxSizing: 'border-box',
};

function Team() {
  const [hrs, setHrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orgInfo, setOrgInfo] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    password: '',
  });
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    
    try {
      // Отримуємо інфо про поточного користувача
      const meRes = await axios.get('/api/me/');
      console.log('Me response:', meRes.data);
      setOrgInfo(meRes.data.organization);
      
      // Отримуємо список юзерів через /api/users/
      const usersRes = await axios.get('/api/users/');
      console.log('Users response:', usersRes.data);
      
      // Фільтруємо HR
      const hrsList = usersRes.data.filter(u => u.role === 'hr');
      console.log('Filtered HRs:', hrsList);
      setHrs(hrsList);
      
    } catch (err) {
      console.error('Помилка завантаження:', err);
      setErrorMsg(`Помилка: ${err.response?.status} ${err.response?.data?.detail || err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (userId) => {
    if (!window.confirm('Видалити цього HR-менеджера?')) return;
    
    try {
      await axios.delete(`/api/users/${userId}/`);
      await fetchData();
    } catch (err) {
      console.error('Помилка видалення:', err);
      setErrorMsg(`Помилка видалення: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleCreate = async () => {
    if (!form.username.trim()) {
      setErrorMsg('Username обов\'язковий');
      return;
    }
    if (!form.email.trim()) {
      setErrorMsg('Email обов\'язковий');
      return;
    }
    if (!form.password.trim()) {
      setErrorMsg('Пароль обов\'язковий');
      return;
    }

    setCreating(true);
    setErrorMsg('');

    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        username: form.username,
        email: form.email,
        password: form.password,
        role: 'hr',
      };
      
      // Додаємо organization тільки якщо є
      if (orgInfo?.id) {
        payload.organization = orgInfo.id;
      }
      
      console.log('Creating HR with payload:', payload);
      await axios.post('/api/users/', payload);
      
      await fetchData();
      setShowAddModal(false);
      setForm({ first_name: '', last_name: '', username: '', email: '', password: '' });
    } catch (err) {
      console.error('Помилка створення:', err);
      const errorText = err.response?.data?.error || 
                       err.response?.data?.detail || 
                       JSON.stringify(err.response?.data) ||
                       'Помилка створення HR';
      setErrorMsg(errorText);
    } finally {
      setCreating(false);
    }
  };

  const currentHrCount = hrs.length;
  const maxHrLimit = orgInfo?.max_hr || 3;
  const isLimitReached = currentHrCount >= maxHrLimit;

  // Показуємо діагностику якщо є помилка
  if (errorMsg && !loading) {
    return (
      <div style={{ padding: '28px' }}>
        <div style={{
          background: '#fee2e2', border: '1px solid #fecaca',
          borderRadius: '12px', padding: '20px', color: '#dc2626',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '8px' }}>⚠ Помилка</div>
          <div style={{ fontSize: '0.85rem', fontFamily: 'DM Mono' }}>{errorMsg}</div>
          <button
            onClick={fetchData}
            style={{
              marginTop: '16px', padding: '8px 16px',
              borderRadius: '8px', border: 'none',
              background: 'var(--accent)', color: '#fff',
              cursor: 'pointer',
            }}
          >
            Спробувати знову
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: '28px', color: 'var(--muted)' }}>Завантаження...</div>;
  }

  return (
    <div style={{ padding: '28px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>Команда HR</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '4px', fontFamily: 'DM Mono' }}>
            {orgInfo ? `Організація: ${orgInfo.name}` : 'Завантаження організації...'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginBottom: '8px', textAlign: 'right' }}>
            HR: {currentHrCount} / {maxHrLimit}
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={isLimitReached}
            style={{
              padding: '9px 18px', borderRadius: '8px', border: 'none',
              background: isLimitReached ? '#e5e7eb' : 'var(--accent)',
              color: isLimitReached ? '#9ca3af' : '#fff',
              fontWeight: 600, fontSize: '0.82rem', cursor: isLimitReached ? 'not-allowed' : 'pointer',
              fontFamily: 'DM Sans',
            }}
            title={isLimitReached ? `Ліміт ${maxHrLimit} HR досягнуто` : ''}
          >
            {isLimitReached ? '⛔ Ліміт досягнуто' : '+ Додати HR'}
          </button>
        </div>
      </div>

      {/* Ліміт warning */}
      {isLimitReached && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px',
          background: '#fee2e2', color: '#dc2626',
          fontSize: '0.78rem', marginBottom: '20px',
          fontFamily: 'DM Mono', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span>⚠</span> Ви досягли ліміту HR-менеджерів ({maxHrLimit}).
        </div>
      )}

      {/* Debug info (прибрати після налагодження) */}
      <div style={{
        background: '#f0f0f0', padding: '8px 12px', borderRadius: '8px',
        fontSize: '0.7rem', fontFamily: 'DM Mono', marginBottom: '16px',
        color: '#666',
      }}>
        Debug: {hrs.length} HR знайдено, orgId: {orgInfo?.id || 'немає'}
      </div>

      {/* Список HR */}
      {hrs.length === 0 ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '48px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>👥</div>
          <div style={{ fontWeight: 500, marginBottom: '6px' }}>Немає HR-менеджерів</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
            Додайте першого HR-менеджера
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {hrs.map(hr => (
            <div
              key={hr.id}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '12px', padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: '16px',
              }}
            >
              <div style={{
                width: '44px', height: '44px', borderRadius: '10px',
                background: 'var(--accent)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: '#fff', fontWeight: 700,
                fontSize: '0.95rem', flexShrink: 0,
              }}>
                {hr.first_name ? hr.first_name[0] : hr.username[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  {hr.first_name && hr.last_name ? `${hr.first_name} ${hr.last_name}` : hr.username}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '2px' }}>
                  {hr.email}
                </div>
              </div>
              <div style={{
                padding: '4px 12px', borderRadius: '20px', fontSize: '0.7rem',
                fontFamily: 'DM Mono', fontWeight: 600,
                background: '#f9eaed', color: '#7a1a2e',
              }}>
                HR
              </div>
              <button
                onClick={() => handleDelete(hr.id)}
                style={{
                  padding: '6px 12px', borderRadius: '7px',
                  border: '1px solid #fee2e2', background: 'transparent',
                  color: '#dc2626', fontSize: '0.75rem', cursor: 'pointer',
                  fontFamily: 'DM Mono',
                }}
              >
                🗑 Видалити
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Модалка додавання HR */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: '16px', padding: '28px',
            width: '440px', border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px' }}>
              Новий HR-менеджер
            </div>

            {errorMsg && (
              <div style={{ color: '#dc2626', fontSize: '0.78rem', marginBottom: '14px', padding: '8px', background: '#fee2e2', borderRadius: '6px' }}>
                {errorMsg}
              </div>
            )}

            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Ім'я</div>
                  <input
                    value={form.first_name}
                    onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Прізвище</div>
                  <input
                    value={form.last_name}
                    onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Username *</div>
                <input
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  style={inputStyle}
                  placeholder="hr_username"
                />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Email *</div>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  style={inputStyle}
                  placeholder="hr@company.com"
                />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Пароль *</div>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  style={inputStyle}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowAddModal(false); setErrorMsg(''); }}
                style={{
                  padding: '8px 16px', borderRadius: '8px',
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text)', cursor: 'pointer', fontFamily: 'DM Sans',
                }}
              >
                Скасувати
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                style={{
                  padding: '8px 18px', borderRadius: '8px', border: 'none',
                  background: 'var(--accent)', color: '#fff', fontWeight: 600,
                  cursor: creating ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans',
                  opacity: creating ? 0.7 : 1,
                }}
              >
                {creating ? 'Створення...' : 'Створити HR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Team;