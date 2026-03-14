import React, { useState, useEffect } from 'react';
import axios from 'axios';

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: '8px',
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'DM Sans',
  outline: 'none', boxSizing: 'border-box',
};

function Admin() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', max_hr: 3, max_vacancies: 10, is_active: true });
  const [saving, setSaving] = useState(false);

  const fetchOrgs = () => {
    axios.get('http://127.0.0.1:8000/api/organizations/')
      .then(res => { setOrgs(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchOrgs(); }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    if (name === 'name') {
      setForm(f => ({ ...f, name: value, slug: value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') }));
    }
  };

  const handleSubmit = () => {
    setSaving(true);
    axios.post('http://127.0.0.1:8000/api/organizations/', form)
      .then(() => {
        fetchOrgs();
        setShowModal(false);
        setForm({ name: '', slug: '', max_hr: 3, max_vacancies: 10, is_active: true });
      })
      .catch(() => {})
      .finally(() => setSaving(false));
  };

  return (
    <div style={{ padding: '28px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>Адмін панель IDA</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '4px', fontFamily: 'DM Mono' }}>
            Управління організаціями
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: '9px 18px', borderRadius: '8px', border: 'none',
            background: 'var(--accent)', color: '#fff', fontWeight: 600,
            fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'DM Sans',
          }}>
          + Нова організація
        </button>
      </div>

      {/* Список */}
      {loading ? (
        <div style={{ color: 'var(--muted)', fontFamily: 'DM Mono', fontSize: '0.82rem' }}>Завантаження...</div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {orgs.map(org => (
            <div key={org.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '20px 24px',
              display: 'flex', alignItems: 'center', gap: '20px',
            }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '10px',
                background: 'var(--accent)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '1rem', flexShrink: 0,
              }}>
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
              <div style={{
                padding: '4px 12px', borderRadius: '20px', fontSize: '0.72rem',
                fontFamily: 'DM Mono', fontWeight: 600,
                background: org.is_active ? '#dcfce7' : '#fee2e2',
                color: org.is_active ? '#16a34a' : '#dc2626',
              }}>
                {org.is_active ? 'Активна' : 'Неактивна'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модалка */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: '16px', padding: '28px',
            width: '420px', border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px' }}>Нова організація</div>

            <div style={{ display: 'grid', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '6px', fontFamily: 'DM Mono' }}>Назва</div>
                <input name="name" value={form.name} onChange={handleChange} placeholder="WinWin Travel" style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '6px', fontFamily: 'DM Mono' }}>Slug</div>
                <input name="slug" value={form.slug} onChange={handleChange} placeholder="winwin-travel" style={inputStyle} />
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
              <button
                onClick={() => setShowModal(false)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'DM Sans' }}>
                Скасувати
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                {saving ? 'Збереження...' : 'Створити'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;