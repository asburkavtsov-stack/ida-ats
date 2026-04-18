import React, { useState, useEffect } from 'react';
import axios from 'axios';

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: '8px',
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'DM Sans',
  outline: 'none', boxSizing: 'border-box',
};

const emptyCreateForm = {
  first_name: '', last_name: '', username: '', email: '', password: '', role: 'hr',
};

function OrgSettings() {
  const [org, setOrg] = useState(null);
  const [orgName, setOrgName] = useState('');
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgSuccess, setOrgSuccess] = useState('');
  const [orgError, setOrgError] = useState('');

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Завантажуємо поточного юзера → отримуємо org
  useEffect(() => {
    axios.get('/api/me/').then(res => {
      const o = res.data.organization;
      if (o) {
        setOrg(o);
        setOrgName(o.name);
      }
    });
  }, []);

  // Завантажуємо HR-юзерів організації
  const fetchUsers = () => {
    if (!org) return;
    setLoadingUsers(true);
    axios.get(`/api/users/?organization=${org.id}`)
      .then(res => setUsers(res.data))
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  };

  useEffect(() => {
    if (org) fetchUsers();
  }, [org]);

  // Зберегти назву організації
  const handleSaveOrg = () => {
    if (!orgName.trim()) return;
    setSavingOrg(true);
    setOrgSuccess('');
    setOrgError('');
    axios.patch(`/api/organizations/${org.id}/`, { name: orgName })
      .then(res => {
        setOrg(res.data);
        setOrgSuccess('Збережено!');
        setTimeout(() => setOrgSuccess(''), 3000);
      })
      .catch(() => setOrgError('Помилка збереження'))
      .finally(() => setSavingOrg(false));
  };

  // Створити HR
  const handleCreate = () => {
    if (!createForm.username || !createForm.password) {
      setCreateError('Username і пароль обов\'язкові');
      return;
    }
    setCreating(true);
    setCreateError('');
    axios.post('/api/users/', { ...createForm, organization: org.id, role: 'hr' })
      .then(() => {
        fetchUsers();
        setShowCreate(false);
        setCreateForm(emptyCreateForm);
      })
      .catch(err => setCreateError(err.response?.data?.error || 'Помилка'))
      .finally(() => setCreating(false));
  };

  // Редагувати HR
  const handleEdit = (u) => {
    setEditUser(u);
    setEditForm({
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      email: u.email || '',
      password: '',
    });
  };

  const handleSaveEdit = () => {
    setSaving(true);
    axios.patch(`/api/users/${editUser.id}/`, editForm)
      .then(() => { fetchUsers(); setEditUser(null); })
      .catch(() => {})
      .finally(() => setSaving(false));
  };

  // Видалити HR
  const handleDelete = (userId) => {
    if (!window.confirm('Видалити HR-менеджера?')) return;
    axios.delete(`/api/users/${userId}/`)
      .then(() => fetchUsers())
      .catch(() => {});
  };

  return (
    <div style={{ padding: '28px', maxWidth: '680px' }}>

      {/* Заголовок */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>Організація</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '4px', fontFamily: 'DM Mono' }}>
          Налаштування та команда
        </div>
      </div>

      {/* Блок: назва організації */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '14px', padding: '24px', marginBottom: '24px',
      }}>
        <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '18px' }}>
          Загальні налаштування
        </div>
        {orgSuccess && (
          <div style={{ color: '#16a34a', fontSize: '0.78rem', marginBottom: '12px', fontFamily: 'DM Mono' }}>
            ✓ {orgSuccess}
          </div>
        )}
        {orgError && (
          <div style={{ color: '#dc2626', fontSize: '0.78rem', marginBottom: '12px', fontFamily: 'DM Mono' }}>
            ⚠ {orgError}
          </div>
        )}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '6px', fontFamily: 'DM Mono' }}>
            Назва організації
          </div>
          <input
            value={orgName}
            onChange={e => setOrgName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveOrg()}
            style={inputStyle}
            placeholder="Назва організації"
          />
        </div>
        <button
          onClick={handleSaveOrg}
          disabled={savingOrg}
          style={{
            padding: '9px 20px', borderRadius: '8px', border: 'none',
            background: 'var(--accent)', color: '#fff', fontWeight: 600,
            fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'DM Sans',
            opacity: savingOrg ? 0.7 : 1,
          }}
        >
          {savingOrg ? 'Збереження...' : 'Зберегти'}
        </button>
      </div>

      {/* Блок: HR-команда */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '14px', padding: '24px',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '20px',
        }}>
          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
            HR-команда
            <span style={{
              marginLeft: '10px', fontFamily: 'DM Mono', fontSize: '0.7rem',
              background: 'var(--surface2)', color: 'var(--muted)',
              padding: '2px 8px', borderRadius: '20px',
            }}>
              {users.length}
            </span>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: '7px 16px', borderRadius: '8px', border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 600,
              fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'DM Sans',
            }}
          >
            + Додати HR
          </button>
        </div>

        {loadingUsers ? (
          <div style={{ color: 'var(--muted)', fontSize: '0.82rem', fontFamily: 'DM Mono' }}>
            Завантаження...
          </div>
        ) : users.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '32px',
            color: 'var(--muted)', fontSize: '0.82rem',
            border: '1px dashed var(--border)', borderRadius: '10px',
          }}>
            Поки немає HR-менеджерів
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {users.map(u => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '12px 16px', borderRadius: '10px',
                border: '1px solid var(--border)', background: 'var(--bg)',
              }}>
                {/* Аватар */}
                <div style={{
                  width: '38px', height: '38px', borderRadius: '9px',
                  background: 'var(--accent)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: '0.82rem', flexShrink: 0,
                }}>
                  {u.first_name ? u.first_name[0] : u.username[0].toUpperCase()}
                </div>

                {/* Інфо */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {u.first_name && u.last_name
                      ? `${u.first_name} ${u.last_name}`
                      : u.username}
                  </div>
                  <div style={{
                    fontSize: '0.71rem', color: 'var(--muted)',
                    fontFamily: 'DM Mono', marginTop: '2px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    @{u.username}{u.email ? ` · ${u.email}` : ''}
                  </div>
                </div>

                {/* Роль */}
                <span style={{
                  fontSize: '0.66rem', fontFamily: 'DM Mono',
                  padding: '3px 8px', borderRadius: '4px',
                  background: '#f9eaed', color: '#7a1a2e',
                }}>
                  HR
                </span>

                {/* Дії */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => handleEdit(u)}
                    style={{
                      padding: '5px 10px', borderRadius: '6px',
                      border: '1px solid var(--border)', background: 'transparent',
                      color: 'var(--text)', fontSize: '0.72rem',
                      cursor: 'pointer', fontFamily: 'DM Mono',
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(u.id)}
                    style={{
                      padding: '5px 10px', borderRadius: '6px',
                      border: '1px solid #fee2e2', background: 'transparent',
                      color: '#dc2626', fontSize: '0.72rem',
                      cursor: 'pointer', fontFamily: 'DM Mono',
                    }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модалка: створити HR */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: '16px',
            padding: '28px', width: '420px', border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px' }}>
              Новий HR-менеджер
            </div>
            {createError && (
              <div style={{ color: '#dc2626', fontSize: '0.78rem', marginBottom: '10px', fontFamily: 'DM Mono' }}>
                ⚠ {createError}
              </div>
            )}
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Ім'я</div>
                  <input value={createForm.first_name} onChange={e => setCreateForm(f => ({ ...f, first_name: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Прізвище</div>
                  <input value={createForm.last_name} onChange={e => setCreateForm(f => ({ ...f, last_name: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Username</div>
                <input value={createForm.username} onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))} style={inputStyle} placeholder="user_login" />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Email</div>
                <input value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} placeholder="email@example.com" />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Пароль</div>
                <input type="password" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowCreate(false); setCreateError(''); setCreateForm(emptyCreateForm); }}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'DM Sans' }}
              >
                Скасувати
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}
              >
                {creating ? 'Створення...' : 'Створити'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка: редагувати HR */}
      {editUser && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: '16px',
            padding: '28px', width: '420px', border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px' }}>
              Редагувати HR
            </div>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Ім'я</div>
                  <input value={editForm.first_name} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Прізвище</div>
                  <input value={editForm.last_name} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Email</div>
                <input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Новий пароль (необов'язково)</div>
                <input type="password" value={editForm.password} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditUser(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'DM Sans' }}
              >
                Скасувати
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}
              >
                {saving ? 'Збереження...' : 'Зберегти'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default OrgSettings;