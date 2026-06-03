// components/VacancyAccessModal.js
// Модальне вікно для адміна: хто має доступ до вакансії + додати/відкликати HR
import React, { useState, useEffect } from 'react';
import { vacanciesApi } from '../api/vacanciesApi';
import axios from 'axiosConfig';

function VacancyAccessModal({ vacancy, onClose }) {
  const [accessList, setAccessList] = useState([]);
  const [hrList,     setHrList]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [selectedHr, setSelectedHr] = useState('');
  const [error,      setError]      = useState('');

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    Promise.all([
      vacanciesApi.listAccess(vacancy.id),
      axios.get('/api/users/').then(r => r.data.results ?? r.data),
    ]).then(([access, users]) => {
      setAccessList(access);
      // Фільтруємо — тільки HR, без тих хто вже має доступ або є owner
      const accessIds = new Set(access.map(a => a.user));
      const hrOnly = users.filter(u =>
        u.role === 'hr' &&
        u.id !== vacancy.owner &&
        !accessIds.has(u.id)
      );
      setHrList(hrOnly);
    }).catch(() => setError('Помилка завантаження'))
      .finally(() => setLoading(false));
  }, [vacancy.id, vacancy.owner]);

  const handleGrant = async () => {
    if (!selectedHr) return;
    setSaving(true);
    setError('');
    try {
      const newAccess = await vacanciesApi.grantAccess(vacancy.id, Number(selectedHr));
      // Оновлюємо список доступу
      const updatedList = await vacanciesApi.listAccess(vacancy.id);
      setAccessList(updatedList);
      setHrList(prev => prev.filter(u => String(u.id) !== selectedHr));
      setSelectedHr('');
    } catch (err) {
      setError(err.response?.data?.error || 'Помилка надання доступу');
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (userId, userName) => {
    if (!window.confirm(`Відкликати доступ у ${userName}?`)) return;
    setSaving(true);
    try {
      await vacanciesApi.revokeAccess(vacancy.id, userId);
      setAccessList(prev => prev.filter(a => a.user !== userId));
      // Повертаємо HR до списку доступних
      const allUsers = await axios.get('/api/users/').then(r => r.data.results ?? r.data);
      const revoked = allUsers.find(u => u.id === userId);
      if (revoked) setHrList(prev => [...prev, revoked]);
    } catch {
      setError('Помилка відкликання доступу');
    } finally {
      setSaving(false);
    }
  };

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1100, padding: '16px',
  };
  const modal = {
    background: 'var(--surface)', borderRadius: '16px',
    width: '100%', maxWidth: '480px', boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
    display: 'flex', flexDirection: 'column', maxHeight: '80vh',
  };
  const labelStyle = {
    fontSize: '0.72rem', fontWeight: 600, fontFamily: 'DM Mono',
    textTransform: 'uppercase', letterSpacing: '0.5px',
    color: 'var(--muted)', marginBottom: '6px', display: 'block',
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Доступ до вакансії</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '2px' }}>
              {vacancy.title}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--muted)', lineHeight: 1 }}
            aria-label="Закрити"
          >✕</button>
        </div>

        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', fontSize: '0.8rem', color: '#dc2626', fontFamily: 'DM Mono' }}>
              {error}
            </div>
          )}

          {/* Owner */}
          {vacancy.owner_name && (
            <div>
              <label style={labelStyle}>Відповідальний HR (власник)</label>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', background: 'var(--bg)',
                borderRadius: '8px', border: '1px solid var(--border)',
              }}>
                <div style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  background: 'var(--accent)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0,
                }}>
                  {vacancy.owner_name[0]?.toUpperCase()}
                </div>
                <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{vacancy.owner_name}</span>
                <span style={{
                  marginLeft: 'auto', fontSize: '0.68rem', fontFamily: 'DM Mono',
                  padding: '2px 8px', borderRadius: '4px',
                  background: '#f9eaed', color: '#7a1a2e',
                }}>owner</span>
              </div>
            </div>
          )}

          {/* Поточний список доступу */}
          <div>
            <label style={labelStyle}>
              Делегований доступ ({accessList.length})
            </label>
            {loading ? (
              <div style={{ color: 'var(--muted)', fontSize: '0.82rem', fontFamily: 'DM Mono', padding: '8px 0' }}>
                Завантаження...
              </div>
            ) : accessList.length === 0 ? (
              <div style={{
                padding: '16px', background: 'var(--bg)', borderRadius: '8px',
                border: '1px solid var(--border)', fontSize: '0.8rem',
                color: 'var(--muted)', fontFamily: 'DM Mono', textAlign: 'center',
              }}>
                Жодного HR не додано
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {accessList.map(a => (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', background: 'var(--bg)',
                    borderRadius: '8px', border: '1px solid var(--border)',
                  }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: '#b03050', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: '#fff', fontWeight: 700,
                      fontSize: '0.7rem', flexShrink: 0,
                    }}>
                      {(a.user_name || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{a.user_name}</div>
                      {a.granted_by_name && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
                          Надав: {a.granted_by_name}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRevoke(a.user, a.user_name)}
                      disabled={saving}
                      style={{
                        padding: '5px 10px', borderRadius: '6px',
                        border: '1px solid #fee2e2', background: 'transparent',
                        color: '#dc2626', fontSize: '0.72rem', cursor: saving ? 'not-allowed' : 'pointer',
                        fontFamily: 'DM Mono',
                      }}
                    >
                      Відкликати
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Додати HR */}
          {hrList.length > 0 && (
            <div>
              <label style={labelStyle}>Додати HR до вакансії</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={selectedHr}
                  onChange={e => setSelectedHr(e.target.value)}
                  style={{
                    flex: 1, padding: '9px 12px', borderRadius: '8px',
                    border: '1px solid var(--border)', background: 'var(--bg)',
                    fontSize: '0.85rem', fontFamily: 'DM Sans', color: 'var(--text)', outline: 'none',
                  }}
                >
                  <option value="">— Обрати HR —</option>
                  {hrList.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || `${u.first_name} ${u.last_name}`.trim() || u.username}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleGrant}
                  disabled={!selectedHr || saving}
                  style={{
                    padding: '9px 18px', borderRadius: '8px', border: 'none',
                    background: selectedHr ? 'var(--accent)' : 'var(--border)',
                    color: selectedHr ? '#fff' : 'var(--muted)',
                    fontWeight: 600, fontSize: '0.82rem',
                    cursor: selectedHr && !saving ? 'pointer' : 'not-allowed',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {saving ? '...' : '+ Додати'}
                </button>
              </div>
            </div>
          )}

          {hrList.length === 0 && !loading && (
            <div style={{
              fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'DM Mono',
              padding: '8px 0', textAlign: 'center',
            }}>
              Усі HR вже мають доступ
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'transparent',
              cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'DM Sans',
            }}
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}

export default VacancyAccessModal;