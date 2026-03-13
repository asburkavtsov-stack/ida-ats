import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Admin() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('http://127.0.0.1:8000/api/organizations/')
      .then(res => { setOrgs(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '28px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>Адмін панель IDA</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '4px', fontFamily: 'DM Mono' }}>
            Управління організаціями
          </div>
        </div>
        <button style={{
          padding: '9px 18px', borderRadius: '8px', border: 'none',
          background: 'var(--accent)', color: '#fff', fontWeight: 600,
          fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'DM Sans',
        }}>
          + Нова організація
        </button>
      </div>

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
                justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '1rem',
                flexShrink: 0,
              }}>
                {org.name[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{org.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '2px' }}>
                  {org.slug}
                </div>
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
    </div>
  );
}

export default Admin;