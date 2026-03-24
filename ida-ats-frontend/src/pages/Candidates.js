import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Loader from '../components/Loader';

const statusConfig = {
  new:       { label: 'Новий',      bg: '#f9eaed', text: '#7a1a2e' },
  screening: { label: 'Скринінг',   bg: '#fff3e0', text: '#c94f2a' },
  interview: { label: 'Співбесіда', bg: '#f5eaf0', text: '#8a3a5a' },
  offer:     { label: 'Оффер',      bg: '#fce4ec', text: '#c2185b' },
  rejected:  { label: 'Відмова',    bg: '#f5f5f5', text: '#757575' },
};

const filters = [
  { key: 'all',       label: 'Всі'        },
  { key: 'new',       label: 'Нові'       },
  { key: 'screening', label: 'Скринінг'   },
  { key: 'interview', label: 'Співбесіда' },
  { key: 'offer',     label: 'Оффер'      },
  { key: 'rejected',  label: 'Відмова'    },
];

function Candidates({ searchQuery = '' }) {
  const [filter, setFilter] = useState('all');
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/candidates/')
      .then(res => setCandidates(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);
  const filtered = candidates.filter(c => {
    const matchesFilter = filter === 'all' || c.status === filter;
    const matchesSearch = searchQuery === '' ||
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.vacancy_title && c.vacancy_title.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  if (loading) return <Loader />;
  return (
    <div>
      {/* Фільтри */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
        {filters.map(f => (
          <div
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '6px 14px', borderRadius: '20px', fontSize: '0.78rem',
              fontWeight: 500, cursor: 'pointer',
              border: `1px solid ${filter === f.key ? 'var(--accent)' : 'var(--border)'}`,
              background: filter === f.key ? 'var(--accent)' : 'var(--surface)',
              color: filter === f.key ? '#fff' : 'var(--muted)',
              transition: 'all 0.15s',
            }}
          >
            {f.label}
          </div>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <button style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', fontSize: '0.78rem', cursor: 'pointer' }}>
            ⬇ Експорт CSV
          </button>
        </div>
      </div>

      {/* Таблиця */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              {['Кандидат', 'Вакансія', 'Статус', 'Джерело', 'Дата'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.72rem', fontFamily: 'DM Mono', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid var(--border)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
            <td style={{ padding: '13px 16px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                {c.first_name} {c.last_name}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '1px' }}>
                {c.email}
              </div>
            </td>
            <td style={{ padding: '13px 16px', fontSize: '0.82rem' }}>
              {c.vacancy_title}
            </td>
            <td style={{ padding: '13px 16px' }}>
              <span style={{ fontSize: '0.66rem', fontFamily: 'DM Mono', padding: '3px 8px', borderRadius: '4px', background: statusConfig[c.status].bg, color: statusConfig[c.status].text }}>
                {statusConfig[c.status].label}
              </span>
            </td>
            <td style={{ padding: '13px 16px' }}>
                  <span style={{ fontSize: '0.66rem', fontFamily: 'DM Mono', padding: '3px 8px', borderRadius: '4px', background: 'var(--surface2)', color: 'var(--muted)' }}>
                    {c.source || '—'}
                  </span>
                </td>
                <td style={{ padding: '13px 16px', fontFamily: 'DM Mono', fontSize: '0.72rem', color: 'var(--muted)' }}>
                  {c.created_at ? c.created_at.slice(0, 10) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Candidates;