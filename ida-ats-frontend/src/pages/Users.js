import React, { useState, useEffect } from 'react';
import axios from 'axios';

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: '8px',
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'DM Sans',
  outline: 'none', boxSizing: 'border-box',
};

const roleLabels = {
  superadmin: 'Супер-адмін',
  admin: 'Адмін орг.',
  hr: 'HR менеджер',
};

const emptyCreateForm = { first_name: '', last_name: '', username: '', email: '', password: '', role: 'hr', organization: '' };

function Users() {
  const [users, setUsers] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchData = () => {
    Promise.all([
      axios.get('/api/users/all/'),
      axios.get('/api/organizations/'),
    ]).then(([usersRes, orgsRes]) => {
      setUsers(usersRes.data);
      setOrgs(orgsRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleEdit = (u) => {
    setEditUser(u);
    setForm({ first_name: u.first_name, last_name: u.last_name, email: u.email, role: u.role || 'hr', organization: u.organization_id || '', password: '' });
  };

  const handleSave = () => {
    setSaving(true);
    axios.patch(`/api/users/${editUser.id}/`, form)
      .then(() => { fetchData(); setEditUser(null); })
      .catch(() => {})
      .finally(() => setSaving(false));
  };

  const handleDelete = (userId) => {
    if (!window.confirm('Видалити юзера?')) return;
    axios.delete(`/api/users/${userId}/`).then(() => fetchData()).catch(() => {});
  };

  const handleCreate = () => {
    setCreating(true);
    setCreateError('');
    axios.post('/api/users/', createForm)
      .then(() => { fetchData(); setShowCreate(false); setCreateForm(emptyCreateForm); })
      .catch(err => setCreateError(err.response?.data?.error || 'Помилка'))
      .finally(() => setCreating(false));
  };

  const RoleSelect = ({ value, onChange }) => (
    <select value={value} onChange={onChange} style={inputStyle}>
      <option value="hr">HR менеджер</option>
      <option value="admin">Адмін організації</option>
      <option value="superadmin">Супер-адмін IDA</option>
    </select>
  );

  const OrgSelect = ({ value, onChange }) => (
    <select value={value} onChange={onChange} style={inputStyle}>
      <option value="">— Без організації —</option>
      {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );

  return (
    <div style={{ padding: '28px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>Юзери системи</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '4px', fontFamily: 'DM Mono' }}>
            Управління всіма користувачами
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} style={{
          padding: '9px 18px', borderRadius: '8px', border: 'none',
          background: 'var(--accent)', color: '#fff', fontWeight: 600,
          fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'DM Sans',
        }}>
          + Додати юзера
        </button>
      </div>

      {/* Список */}
      {loading ? (
        <div style={{ color: 'var(--muted)', fontFamily: 'DM Mono', fontSize: '0.82rem' }}>Завантаження...</div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {users.map(u => (
            <div key={u.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '16px 20px',
              display: 'flex', alignItems: 'center', gap: '16px',
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: 'var(--accent)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: '#fff', fontWeight: 700,
                fontSize: '0.85rem', flexShrink: 0,
              }}>
                {u.first_name ? u.first_name[0] : u.username[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '2px' }}>
                  {u.email} · @{u.username}
                </div>
              </div>
              <div style={{ fontSize: '0.72rem', fontFamily: 'DM Mono', color: 'var(--muted)', textAlign: 'right' }}>
                <div>{u.organization_name || '—'}</div>
                <div style={{ marginTop: '2px' }}>{roleLabels[u.role] || u.role || '—'}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleEdit(u)} style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'DM Mono' }}>
                  ✏️ Змінити
                </button>
                <button onClick={() => handleDelete(u.id)} style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid #fee2e2', background: 'transparent', color: '#dc2626', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'DM Mono' }}>
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модалка створення */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '28px', width: '440px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px' }}>Новий юзер</div>
            {createError && <div style={{ color: '#dc2626', fontSize: '0.78rem', marginBottom: '10px', fontFamily: 'DM Mono' }}>{createError}</div>}
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
                <input value={createForm.username} onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Email</div>
                <input value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Пароль</div>
                <input type="password" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Організація</div>
                <OrgSelect value={createForm.organization} onChange={e => setCreateForm(f => ({ ...f, organization: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Роль</div>
                <RoleSelect value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowCreate(false); setCreateError(''); }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'DM Sans' }}>
                Скасувати
              </button>
              <button onClick={handleCreate} disabled={creating} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                {creating ? 'Створення...' : 'Створити'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка редагування */}
      {editUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '28px', width: '440px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px' }}>Редагувати юзера</div>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Ім'я</div>
                  <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Прізвище</div>
                  <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Email</div>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Організація</div>
                <OrgSelect value={form.organization} onChange={e => setForm(f => ({ ...f, organization: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Роль</div>
                <RoleSelect value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '4px', fontFamily: 'DM Mono' }}>Новий пароль (необов'язково)</div>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditUser(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'DM Sans' }}>
                Скасувати
              </button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                {saving ? 'Збереження...' : 'Зберегти'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Users;