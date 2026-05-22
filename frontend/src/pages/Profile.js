import React, { useState, useEffect } from 'react';
import axios from '../api';

const inputStyle = (isMobile) => ({
  width: '100%', padding: isMobile ? '11px 14px' : '9px 12px', borderRadius: '8px',
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text)', fontSize: isMobile ? '0.9rem' : '0.85rem', fontFamily: 'DM Sans',
  outline: 'none', boxSizing: 'border-box',
});

function Profile() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '' });
  const [passwordForm, setPasswordForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    axios.get('/api/me/')
      .then(res => {
        setUser(res.data);
        setForm({ first_name: res.data.first_name || '', last_name: res.data.last_name || '', email: res.data.email || '' });
      });
  }, []);

  const handleSave = () => {
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    axios.patch(`/api/users/${user.id}/`, form)
      .then(() => setSuccessMsg('Профіль оновлено!'))
      .catch(() => setErrorMsg('Помилка збереження'))
      .finally(() => setSaving(false));
  };

  const handlePasswordChange = () => {
    setPasswordError('');
    setPasswordSuccess('');
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError('Паролі не співпадають');
      return;
    }
    if (passwordForm.new_password.length < 8) {
      setPasswordError('Пароль має бути мінімум 8 символів');
      return;
    }
    setSavingPassword(true);
    axios.patch(`/api/users/${user.id}/`, { password: passwordForm.new_password })
      .then(() => { setPasswordSuccess('Пароль змінено!'); setPasswordForm({ old_password: '', new_password: '', confirm_password: '' }); })
      .catch(() => setPasswordError('Помилка зміни пароля'))
      .finally(() => setSavingPassword(false));
  };

  if (!user) return <div style={{ padding: '28px', color: 'var(--muted)', fontFamily: 'DM Mono' }}>Завантаження...</div>;

  const initials = user.first_name && user.last_name
    ? `${user.first_name[0]}${user.last_name[0]}`
    : user.username?.slice(0, 2).toUpperCase();

  return (
    <div style={{ padding: isMobile ? '16px' : '28px', maxWidth: '600px' }}>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>Мій профіль</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '4px', fontFamily: 'DM Mono' }}>
          Налаштування акаунту
        </div>
      </div>

      {/* Аватар */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
        <div style={{
          width: isMobile ? '52px' : '64px', height: isMobile ? '52px' : '64px', borderRadius: '14px',
          background: 'var(--accent)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: isMobile ? '1.2rem' : '1.4rem',
        }}>
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', wordBreak: 'break-word' }}>
            {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.username}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '2px', wordBreak: 'break-word' }}>
            @{user.username} · {user.organization?.name || 'Без організації'}
          </div>
        </div>
      </div>

      {/* Основна інфо */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: isMobile ? '18px' : '24px', marginBottom: '20px' }}>
        <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '18px' }}>Особисті дані</div>
        {successMsg && <div style={{ color: '#16a34a', fontSize: '0.78rem', marginBottom: '12px', fontFamily: 'DM Mono' }}>✓ {successMsg}</div>}
        {errorMsg && <div style={{ color: '#dc2626', fontSize: '0.78rem', marginBottom: '12px', fontFamily: 'DM Mono' }}>⚠ {errorMsg}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '6px', fontFamily: 'DM Mono' }}>Ім'я</div>
            <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} style={inputStyle(isMobile)} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '6px', fontFamily: 'DM Mono' }}>Прізвище</div>
            <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} style={inputStyle(isMobile)} />
          </div>
        </div>
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '6px', fontFamily: 'DM Mono' }}>Email</div>
          <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle(isMobile)} />
        </div>
        <button onClick={handleSave} disabled={saving} style={{
          width: isMobile ? '100%' : 'auto',
          padding: isMobile ? '12px 20px' : '9px 20px', borderRadius: '8px', border: 'none',
          background: 'var(--accent)', color: '#fff', fontWeight: 600,
          fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'DM Sans',
        }}>
          {saving ? 'Збереження...' : 'Зберегти зміни'}
        </button>
      </div>

      {/* Зміна пароля */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: isMobile ? '18px' : '24px' }}>
        <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '18px' }}>Зміна пароля</div>
        {passwordError && <div style={{ color: '#dc2626', fontSize: '0.78rem', marginBottom: '12px', fontFamily: 'DM Mono' }}>⚠ {passwordError}</div>}
        {passwordSuccess && <div style={{ color: '#16a34a', fontSize: '0.78rem', marginBottom: '12px', fontFamily: 'DM Mono' }}>✓ {passwordSuccess}</div>}
        <div style={{ display: 'grid', gap: '14px', marginBottom: '18px' }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '6px', fontFamily: 'DM Mono' }}>Новий пароль</div>
            <input type="password" value={passwordForm.new_password} onChange={e => setPasswordForm(f => ({ ...f, new_password: e.target.value }))} style={inputStyle(isMobile)} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '6px', fontFamily: 'DM Mono' }}>Підтвердити пароль</div>
            <input type="password" value={passwordForm.confirm_password} onChange={e => setPasswordForm(f => ({ ...f, confirm_password: e.target.value }))} style={inputStyle(isMobile)} />
          </div>
        </div>
        <button onClick={handlePasswordChange} disabled={savingPassword} style={{
          width: isMobile ? '100%' : 'auto',
          padding: isMobile ? '12px 20px' : '9px 20px', borderRadius: '8px', border: 'none',
          background: 'var(--accent)', color: '#fff', fontWeight: 600,
          fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'DM Sans',
        }}>
          {savingPassword ? 'Збереження...' : 'Змінити пароль'}
        </button>
      </div>
    </div>
  );
}

export default Profile;