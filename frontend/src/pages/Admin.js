import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const inputStyle = (isMobile) => ({
  width: '100%', padding: isMobile ? '11px 14px' : '9px 12px', borderRadius: '8px',
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text)', fontSize: isMobile ? '0.9rem' : '0.85rem', fontFamily: 'DM Sans',
  outline: 'none', boxSizing: 'border-box',
});

const emptyForm = { name: '', slug: '', max_hr: 3, max_vacancies: 10, is_active: true };

function OrgModal({ org, onClose, onSave, isMobile }) {
  const [form, setForm] = useState(() => {
    if (!org) return emptyForm;
    return {
      name: org.name || '',
      slug: org.slug || '',
      max_hr: org.max_hr != null && !isNaN(org.max_hr) ? Number(org.max_hr) : 3,
      max_vacancies: org.max_vacancies != null && !isNaN(org.max_vacancies) ? Number(org.max_vacancies) : 10,
      is_active: org.is_active ?? true,
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (org) {
      setForm({
        name: org.name || '',
        slug: org.slug || '',
        max_hr: org.max_hr != null && !isNaN(org.max_hr) ? Number(org.max_hr) : 3,
        max_vacancies: org.max_vacancies != null && !isNaN(org.max_vacancies) ? Number(org.max_vacancies) : 10,
        is_active: org.is_active ?? true,
      });
    } else {
      setForm(emptyForm);
    }
  }, [org]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm(f => {
      let newValue;
      if (type === 'checkbox') {
        newValue = checked;
      } else if (type === 'number') {
        if (value === '') {
          newValue = 0;
        } else {
          const num = Number(value);
          newValue = isNaN(num) ? 0 : num;
        }
      } else {
        newValue = value;
      }

      const newForm = { ...f, [name]: newValue };

      if (name === 'name' && !org) {
        newForm.slug = value
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
      }
      return newForm;
    });
  };

  const handleSubmit = async () => {
    if (!form.name?.trim()) {
      setError('Назва організації є обов\'язковою');
      return;
    }
    if (!form.slug?.trim() && !org) {
      setError('Slug є обов\'язковим');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        max_hr: Number(form.max_hr) || 0,
        max_vacancies: Number(form.max_vacancies) || 0,
        is_active: form.is_active,
      };

      console.log('Sending payload:', JSON.stringify(payload));

      const req = org
        ? axios.patch(`/api/organizations/${org.id}/`, payload)
        : axios.post('/api/organizations/', payload);

      await req;
      onSave();
      onClose();
    } catch (err) {
      console.error('Помилка збереження організації:', err.response?.data || err);
      const msg = err.response?.data?.detail ||
                  err.response?.data?.name?.[0] ||
                  err.response?.data?.slug?.[0] ||
                  JSON.stringify(err.response?.data) ||
                  'Не вдалося зберегти організацію';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: isMobile ? 'flex-end' : 'center',
      justifyContent: 'center', zIndex: 1000,
      padding: isMobile ? '0' : '0',
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: isMobile ? '16px 16px 0 0' : '16px',
        padding: isMobile ? '20px' : '28px',
        width: '100%', maxWidth: '420px',
        maxHeight: isMobile ? '85vh' : 'auto',
        overflowY: 'auto',
        border: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px' }}>
          {org ? 'Редагувати організацію' : 'Нова організація'}
        </div>

        {error && (
          <div style={{ color: '#dc2626', fontSize: '0.82rem', marginBottom: '14px', padding: '8px', background: '#fee2e2', borderRadius: '6px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gap: '14px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '6px', fontFamily: 'DM Mono' }}>Назва</div>
            <input name="name" value={form.name} onChange={handleChange} placeholder="Organization" style={inputStyle(isMobile)} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '6px', fontFamily: 'DM Mono' }}>Slug</div>
            <input
              name="slug"
              value={form.slug}
              onChange={handleChange}
              disabled={!!org}
              style={{ ...inputStyle(isMobile), opacity: org ? 0.7 : 1 }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '6px', fontFamily: 'DM Mono' }}>HR ліміт</div>
              <input
                name="max_hr"
                type="number"
                min="0"
                max="100"
                value={form.max_hr}
                onChange={handleChange}
                style={inputStyle(isMobile)}
              />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '6px', fontFamily: 'DM Mono' }}>Вакансій ліміт</div>
              <input
                name="max_vacancies"
                type="number"
                min="0"
                max="1000"
                value={form.max_vacancies}
                onChange={handleChange}
                style={inputStyle(isMobile)}
              />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
            Активна
          </label>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={onClose} style={{ padding: isMobile ? '10px 16px' : '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'DM Sans' }}>
            Скасувати
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{ padding: isMobile ? '10px 18px' : '8px 18px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}
          >
            {saving ? 'Збереження...' : org ? 'Зберегти' : 'Створити'}
          </button>
        </div>
      </div>
    </div>
  );
}

const emptyUserForm = { first_name: '', last_name: '', username: '', email: '', password: '', role: 'hr' };

function UsersModal({ org, onClose, isMobile }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState(emptyUserForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/users/?organization=${org.id}`);
      setUsers(res.data.results ?? res.data);
    } catch (err) {
      console.error('Помилка завантаження юзерів:', err);
      setError('Не вдалося завантажити користувачів');
    } finally {
      setLoading(false);
    }
  }, [org.id]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleEdit = (user) => {
    setEditUser(user);
    setForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      username: user.username || '',
      email: user.email || '',
      password: '',
      role: user.role || 'hr'
    });
    setShowForm(true);
    setError('');
  };

  const handleSubmit = async () => {
    if (!form.email?.trim()) {
      setError('Email є обов\'язковим');
      return;
    }
    if (!editUser && !form.password?.trim()) {
      setError('Пароль є обов\'язковим при створенні юзера');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        username: form.username,
        email: form.email,
        role: form.role,
        organization: org.id
      };

      if (form.password && form.password.trim() !== '') {
        payload.password = form.password;
      }

      if (editUser) {
        await axios.patch(`/api/users-detail/${editUser.id}/`, payload);
      } else {
        await axios.post('/api/users/', payload);
      }

      await fetchUsers();
      setShowForm(false);
      setEditUser(null);
      setForm(emptyUserForm);
    } catch (err) {
      console.error('Помилка збереження юзера:', err.response?.data || err);
      const msg = err.response?.data?.detail ||
                  err.response?.data?.email?.[0] ||
                  err.response?.data?.username?.[0] ||
                  err.response?.data?.password?.[0] ||
                  err.response?.data?.non_field_errors?.[0] ||
                  JSON.stringify(err.response?.data) ||
                  'Не вдалося зберегти користувача';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Видалити юзера?')) return;
    try {
      await axios.delete(`/api/users-detail/${userId}/`);
      await fetchUsers();
    } catch (err) {
      console.error('Помилка видалення:', err);
      setError('Не вдалося видалити користувача');
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditUser(null);
    setForm(emptyUserForm);
    setError('');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: isMobile ? 'flex-end' : 'center',
      justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: isMobile ? '16px 16px 0 0' : '16px',
        padding: isMobile ? '20px' : '28px',
        width: '100%', maxWidth: '520px',
        border: '1px solid var(--border)',
        maxHeight: isMobile ? '85vh' : '85vh',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Юзери — {org.name}</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => {
                setShowForm(true);
                setEditUser(null);
                setForm(emptyUserForm);
                setError('');
              }}
              style={{ padding: isMobile ? '8px 14px' : '6px 14px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 600 }}
            >
              <span aria-hidden="true">+</span> Додати
            </button>
            <button
              onClick={onClose}
              aria-label="Закрити вікно користувачів"
              type="button"
              style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '1.2rem', cursor: 'pointer' }}
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        </div>

        {error && !showForm && (
          <div style={{ color: '#dc2626', fontSize: '0.82rem', marginBottom: '14px', padding: '8px', background: '#fee2e2', borderRadius: '6px' }}>
            {error}
          </div>
        )}

        {showForm && (
          <div style={{ background: 'var(--bg)', borderRadius: '12px', padding: '16px', marginBottom: '20px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '14px' }}>
              {editUser ? 'Редагувати юзера' : 'Новий юзер'}
            </div>

            {error && <div style={{ color: '#dc2626', fontSize: '0.78rem', marginBottom: '10px' }}>{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Ім'я</div>
                <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} style={inputStyle(isMobile)} />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Прізвище</div>
                <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} style={inputStyle(isMobile)} />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Username</div>
                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} disabled={!!editUser} style={{ ...inputStyle(isMobile), opacity: editUser ? 0.6 : 1 }} />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Email</div>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle(isMobile)} />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>
                  {editUser ? 'Новий пароль (необов\'язково)' : 'Пароль *'}
                </div>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={inputStyle(isMobile)} />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Роль</div>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={inputStyle(isMobile)}>
                  <option value="hr">HR менеджер</option>
                  <option value="admin">Адмін організації</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button onClick={handleCloseForm} style={{ padding: isMobile ? '9px 14px' : '7px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: '0.82rem' }}>
                Скасувати
              </button>
              <button onClick={handleSubmit} disabled={saving} style={{ padding: isMobile ? '9px 16px' : '7px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', fontSize: '0.82rem' }}>
                {saving ? 'Збереження...' : editUser ? 'Зберегти' : 'Створити'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ color: 'var(--muted)', fontFamily: 'DM Mono', fontSize: '0.82rem' }}>Завантаження...</div>
        ) : users.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontFamily: 'DM Mono', fontSize: '0.82rem' }}>Юзерів немає</div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {users.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                  {u.first_name ? u.first_name[0] : u.username[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', wordBreak: 'break-word' }}>
                    {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'DM Mono', wordBreak: 'break-word' }}>{u.email}</div>
                </div>
                <div style={{ fontSize: '0.72rem', fontFamily: 'DM Mono', color: 'var(--muted)', marginRight: '8px', flexShrink: 0 }}>{u.role}</div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button
                    onClick={() => handleEdit(u)}
                    aria-label={`Редагувати користувача ${u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}`}
                    type="button"
                    style={{ padding: isMobile ? '6px 10px' : '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'DM Mono' }}
                  >
                    <span aria-hidden="true">✏️</span>
                  </button>
                  <button
                    onClick={() => handleDelete(u.id)}
                    aria-label={`Видалити користувача ${u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}`}
                    type="button"
                    style={{ padding: isMobile ? '6px 10px' : '4px 10px', borderRadius: '6px', border: '1px solid #fee2e2', background: 'transparent', color: '#dc2626', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'DM Mono' }}
                  >
                    <span aria-hidden="true">🗑</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DeleteConfirmationModal({ org, onClose, onConfirm, isMobile }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: isMobile ? 'flex-end' : 'center',
      justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: isMobile ? '16px 16px 0 0' : '16px',
        padding: isMobile ? '20px' : '28px',
        width: '100%', maxWidth: '360px',
        border: '1px solid var(--border)', textAlign: 'center',
      }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '10px' }}>Видалити організацію?</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '24px' }}>
          «{org.name}» буде видалено назавжди.
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={onClose} style={{ padding: isMobile ? '10px 16px' : '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'DM Sans' }}>
            Скасувати
          </button>
          <button onClick={onConfirm} style={{ padding: isMobile ? '10px 18px' : '8px 18px', borderRadius: '8px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
            Видалити
          </button>
        </div>
      </div>
    </div>
  );
}

function Admin({ onViewOrg }) {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [editOrg, setEditOrg] = useState(null);
  const [usersOrg, setUsersOrg] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/organizations/');
      setOrgs(res.data.results ?? res.data);
    } catch (err) {
      console.error('Помилка завантаження організацій:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/organizations/${id}/`);
      await fetchOrgs();
      setConfirmDelete(null);
    } catch (err) {
      console.error('Помилка видалення:', err);
    }
  };

  const handleViewOrg = (orgId) => {
    if (onViewOrg) onViewOrg(orgId);
    else console.warn('onViewOrg не передано як проп');
  };

  return (
    <div style={{ padding: isMobile ? '16px' : '28px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>Адмін панель IDA</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '4px', fontFamily: 'DM Mono' }}>Управління організаціями</div>
        </div>
        <button onClick={() => { setEditOrg(null); setShowOrgModal(true); }} style={{
          padding: isMobile ? '10px 16px' : '9px 18px', borderRadius: '8px', border: 'none',
          background: 'var(--accent)', color: '#fff', fontWeight: 600,
          fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'DM Sans',
        }}>
          <span aria-hidden="true">+</span> Нова організація
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontFamily: 'DM Mono', fontSize: '0.82rem' }}>Завантаження...</div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {orgs.map(org => (
            <div key={org.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: isMobile ? '16px' : '20px 24px',
              display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
              gap: isMobile ? '12px' : '20px',
              flexDirection: isMobile ? 'column' : 'row',
            }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '10px',
                background: 'var(--accent)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: '#fff', fontWeight: 700,
                fontSize: '1rem', flexShrink: 0,
              }}>
                {org.name[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', wordBreak: 'break-word' }}>{org.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '2px', wordBreak: 'break-word' }}>{org.slug}</div>
              </div>
              <div style={{
                display: 'flex', gap: isMobile ? '12px' : '24px',
                textAlign: 'center',
                width: isMobile ? '100%' : 'auto',
                justifyContent: isMobile ? 'flex-start' : 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{org.max_hr ?? 0}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>HR ліміт</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{org.max_vacancies ?? 0}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>Вакансій</div>
                </div>
              </div>
              <div style={{
                padding: '4px 12px', borderRadius: '20px',
                fontSize: '0.72rem', fontFamily: 'DM Mono', fontWeight: 600,
                background: org.is_active ? '#dcfce7' : '#fee2e2',
                color: org.is_active ? '#16a34a' : '#dc2626',
                flexShrink: 0,
              }}>
                {org.is_active ? 'Активна' : 'Неактивна'}
              </div>
              <div style={{
                display: 'flex', gap: '8px',
                flexWrap: 'wrap',
                width: isMobile ? '100%' : 'auto',
              }}>
                <button
                  onClick={() => handleViewOrg(org.id)}
                  aria-label={`Переглянути ATS організації ${org.name}`}
                  type="button"
                  style={{ padding: isMobile ? '8px 12px' : '6px 12px', borderRadius: '7px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'DM Mono' }}
                >
                  <span aria-hidden="true">🖥</span> ATS
                </button>
                <button
                  onClick={() => setUsersOrg(org)}
                  aria-label={`Користувачі організації ${org.name}`}
                  type="button"
                  style={{ padding: isMobile ? '8px 12px' : '6px 12px', borderRadius: '7px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'DM Mono' }}
                >
                  <span aria-hidden="true">👥</span> Юзери
                </button>
                <button
                  onClick={() => { setEditOrg(org); setShowOrgModal(true); }}
                  aria-label={`Редагувати організацію ${org.name}`}
                  type="button"
                  style={{ padding: isMobile ? '8px 12px' : '6px 12px', borderRadius: '7px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'DM Mono' }}
                >
                  <span aria-hidden="true">✏️</span> Змінити
                </button>
                <button
                  onClick={() => setConfirmDelete(org)}
                  aria-label={`Видалити організацію ${org.name}`}
                  type="button"
                  style={{ padding: isMobile ? '8px 12px' : '6px 12px', borderRadius: '7px', border: '1px solid #fee2e2', background: 'transparent', color: '#dc2626', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'DM Mono' }}
                >
                  <span aria-hidden="true">🗑</span> Видалити
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showOrgModal && (
        <OrgModal
          org={editOrg}
          onClose={() => setShowOrgModal(false)}
          onSave={fetchOrgs}
          isMobile={isMobile}
        />
      )}

      {usersOrg && <UsersModal org={usersOrg} onClose={() => setUsersOrg(null)} isMobile={isMobile} />}

      {confirmDelete && (
        <DeleteConfirmationModal
          org={confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => handleDelete(confirmDelete.id)}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}

export default Admin;