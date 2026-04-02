import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: '8px',
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'DM Sans',
  outline: 'none', boxSizing: 'border-box',
};

const emptyForm = { name: '', slug: '', max_hr: 3, max_vacancies: 10, is_active: true };

function OrgModal({ org, onClose, onSave }) {
  const [form, setForm] = useState(org || emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm(f => {
      const newForm = { ...f, [name]: type === 'checkbox' ? checked : value };

      // Автогенерація slug ТІЛЬКИ при створенні нової організації
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
      setError('Назва організації є обов’язковою');
      return;
    }
    if (!form.slug?.trim() && !org) {
      setError('Slug є обов’язковим');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = { ...form };

      const req = org
        ? axios.patch(`/api/organizations/${org.id}/`, payload)
        : axios.post('/api/organizations/', payload);

      await req;
      onSave();
      onClose();                    // закриваємо модалку після успіху
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '28px', width: '420px', border: '1px solid var(--border)' }}>
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
            <input name="name" value={form.name} onChange={handleChange} placeholder="WinWin Travel" style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '6px', fontFamily: 'DM Mono' }}>Slug</div>
            <input 
              name="slug" 
              value={form.slug} 
              onChange={handleChange} 
              disabled={!!org}   // при редагуванні slug краще не міняти
              style={{ ...inputStyle, opacity: org ? 0.7 : 1 }} 
            />
          </div>
          <div style={{ display: 'flex', gap: '14px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '6px', fontFamily: 'DM Mono' }}>HR ліміт</div>
              <input name="max_hr" type="number" value={form.max_hr} onChange={handleChange} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '6px', fontFamily: 'DM Mono' }}>Вакансій ліміт</div>
              <input name="max_vacancies" type="number" value={form.max_vacancies} onChange={handleChange} style={inputStyle} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
            Активна
          </label>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'DM Sans' }}>
            Скасувати
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={saving} 
            style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}
          >
            {saving ? 'Збереження...' : org ? 'Зберегти' : 'Створити'}
          </button>
        </div>
      </div>
    </div>
  );
}

const emptyUserForm = { first_name: '', last_name: '', username: '', email: '', password: '', role: 'hr' };

function UsersModal({ org, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState(emptyUserForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchUsers = useCallback(() => {
    setLoading(true);
    axios.get(`/api/users/?organization=${org.id}`)
      .then(res => setUsers(res.data))
      .catch(err => console.error('Помилка завантаження юзерів:', err))
      .finally(() => setLoading(false));
  }, [org.id]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

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
      setError('Email є обов’язковим');
      return;
    }
    if (!editUser && !form.password?.trim()) {
      setError('Пароль є обов’язковим при створенні юзера');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = { ...form, organization: org.id };

      // Видаляємо порожній пароль при редагуванні
      if (editUser && (!payload.password || payload.password.trim() === '')) {
        delete payload.password;
      }

      const req = editUser
        ? axios.patch(`/api/users/${editUser.id}/`, payload)
        : axios.post('/api/users/', payload);

      await req;
      fetchUsers();
      setShowForm(false);
      setEditUser(null);
      setForm(emptyUserForm);
    } catch (err) {
      console.error('Помилка збереження юзера:', err.response?.data || err);
      const msg = err.response?.data?.detail ||
                  err.response?.data?.email?.[0] ||
                  err.response?.data?.username?.[0] ||
                  'Не вдалося зберегти користувача';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (userId) => {
    if (!window.confirm('Видалити юзера?')) return;
    axios.delete(`/api/users/${userId}/`)
      .then(() => fetchUsers())
      .catch(err => console.error('Помилка видалення:', err));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '28px', width: '520px', border: '1px solid var(--border)', maxHeight: '85vh', overflowY: 'auto' }}>
        {/* ... (шапка залишається без змін) */}
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
              style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 600 }}
            >
              + Додати
            </button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        {/* Форма */}
        {showForm && (
          <div style={{ background: 'var(--bg)', borderRadius: '12px', padding: '16px', marginBottom: '20px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '14px' }}>
              {editUser ? 'Редагувати юзера' : 'Новий юзер'}
            </div>

            {error && <div style={{ color: '#dc2626', fontSize: '0.78rem', marginBottom: '10px' }}>{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {/* Поля форми (без змін) */}
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Ім'я</div>
                <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Прізвище</div>
                <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Username</div>
                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} disabled={!!editUser} style={{ ...inputStyle, opacity: editUser ? 0.6 : 1 }} />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Email</div>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>
                  {editUser ? 'Новий пароль (необов’язково)' : 'Пароль'}
                </div>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Роль</div>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={inputStyle}>
                  <option value="hr">HR менеджер</option>
                  <option value="admin">Адмін організації</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowForm(false); setEditUser(null); setError(''); }} style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: '0.82rem' }}>
                Скасувати
              </button>
              <button onClick={handleSubmit} disabled={saving} style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', fontSize: '0.82rem' }}>
                {saving ? 'Збереження...' : editUser ? 'Зберегти' : 'Створити'}
              </button>
            </div>
          </div>
        )}

        {/* Список юзерів (без змін) */}
        {loading ? (
          <div style={{ color: 'var(--muted)', fontFamily: 'DM Mono', fontSize: '0.82rem' }}>Завантаження...</div>
        ) : users.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontFamily: 'DM Mono', fontSize: '0.82rem' }}>Юзерів немає</div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {users.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                {/* ... решта коду списку без змін ... */}
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                  {u.first_name ? u.first_name[0] : u.username[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>{u.email}</div>
                </div>
                <div style={{ fontSize: '0.72rem', fontFamily: 'DM Mono', color: 'var(--muted)', marginRight: '8px' }}>{u.role}</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleEdit(u)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'DM Mono' }}>
                    ✏️
                  </button>
                  <button onClick={() => handleDelete(u.id)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #fee2e2', background: 'transparent', color: '#dc2626', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'DM Mono' }}>
                    🗑
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

// DeleteConfirmationModal залишається без змін
function DeleteConfirmationModal({ org, onClose, onConfirm }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '28px', width: '360px', border: '1px solid var(--border)', textAlign: 'center' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '10px' }}>Видалити організацію?</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '24px' }}>
          «{org.name}» буде видалено назавжди.
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'DM Sans' }}>
            Скасувати
          </button>
          <button onClick={onConfirm} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
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

  const fetchOrgs = () => {
    setLoading(true);
    axios.get('/api/organizations/')
      .then(res => setOrgs(res.data))
      .catch(err => console.error('Помилка завантаження організацій:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrgs(); }, []);

  const handleDelete = (id) => {
    axios.delete(`/api/organizations/${id}/`)
      .then(() => {
        fetchOrgs();
        setConfirmDelete(null);
      })
      .catch(err => console.error('Помилка видалення:', err));
  };

  const handleViewOrg = (orgId) => {
    if (onViewOrg) onViewOrg(orgId);
    else console.warn('onViewOrg не передано як проп');
  };

  return (
    <div style={{ padding: '28px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>Адмін панель IDA</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '4px', fontFamily: 'DM Mono' }}>Управління організаціями</div>
        </div>
        <button onClick={() => { setEditOrg(null); setShowOrgModal(true); }} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'DM Sans' }}>
          + Нова організація
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontFamily: 'DM Mono', fontSize: '0.82rem' }}>Завантаження...</div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {orgs.map(org => (
            <div key={org.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
              {/* ... картка організації без змін ... */}
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '1rem', flexShrink: 0 }}>
                {org.name[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{org.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '2px' }}>{org.slug}</div>
              </div>
              <div style={{ display: 'flex', gap: '24px', textAlign: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{org.max_hr}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>HR ліміт</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{org.max_vacancies}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>Вакансій</div>
                </div>
              </div>
              <div style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.72rem', fontFamily: 'DM Mono', fontWeight: 600, background: org.is_active ? '#dcfce7' : '#fee2e2', color: org.is_active ? '#16a34a' : '#dc2626' }}>
                {org.is_active ? 'Активна' : 'Неактивна'}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleViewOrg(org.id)} style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'DM Mono' }}>
                  🖥 ATS
                </button>
                <button onClick={() => setUsersOrg(org)} style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'DM Mono' }}>
                  👥 Юзери
                </button>
                <button onClick={() => { setEditOrg(org); setShowOrgModal(true); }} style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'DM Mono' }}>
                  ✏️ Змінити
                </button>
                <button onClick={() => setConfirmDelete(org)} style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid #fee2e2', background: 'transparent', color: '#dc2626', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'DM Mono' }}>
                  🗑 Видалити
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
          onSave={() => { fetchOrgs(); }}
        />
      )}

      {usersOrg && <UsersModal org={usersOrg} onClose={() => setUsersOrg(null)} />}

      {confirmDelete && (
        <DeleteConfirmationModal
          org={confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => handleDelete(confirmDelete.id)}
        />
      )}
    </div>
  );
}

export default Admin;