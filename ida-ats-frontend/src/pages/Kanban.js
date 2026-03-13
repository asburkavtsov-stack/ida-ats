import React, { useState, useEffect } from 'react';
import axios from 'axios';

const vacancies = [
  { key: 'all',      label: 'Всі',             count: 24 },
  { key: 'python',   label: 'Python Developer', count: 8  },
  { key: 'frontend', label: 'Frontend Dev',     count: 5  },
  { key: 'qa',       label: 'QA Engineer',      count: 4  },
  { key: 'ux',       label: 'UX Designer',      count: 3  },
  { key: 'pm',       label: 'Project Manager',  count: 2  },
  { key: 'backend',  label: 'Backend Dev',      count: 2  },
];

const candidates = [ ];

const columns = [
  { key: 'new',        label: 'Нові',       color: '#7a1a2e' },
  { key: 'screening',  label: 'Скринінг',   color: '#b03050' },
  { key: 'interview',  label: 'Співбесіда', color: '#8a3a5a' },
  { key: 'offer',      label: 'Оффер',      color: '#e8a0b0' },
  { key: 'rejected',   label: 'Відмова',    color: '#aaaaaa' },
];

const statusColors = {
  new:       { bg: '#f9eaed', text: '#7a1a2e' },
  screening: { bg: '#fff3e0', text: '#c94f2a' },
  interview: { bg: '#f5eaf0', text: '#8a3a5a' },
  offer:     { bg: '#fce4ec', text: '#c2185b' },
  rejected:  { bg: '#f5f5f5', text: '#757575' },
};

const statusLabels = {
  new: 'Новий', screening: 'Скринінг', interview: 'Співбесіда', offer: 'Оффер', rejected: 'Відмова'
};

function Kanban({ searchQuery = '' }) {
  const [filter, setFilter] = useState('all');
  const [selectedCard, setSelectedCard] = useState(null);

  const updateStatus = (candidateId, newStatus) => {
    axios.patch(`http://127.0.0.1:8000/api/candidates/${candidateId}/update_status/`, 
      { status: newStatus }
    ).then(res => {
      setCandidates(prev => prev.map(c => c.id === candidateId ? res.data : c));
      setSelectedCard(null);
    });
  };

  const [candidates, setCandidates] = useState([]);

  useEffect(() => {
    axios.get('http://127.0.0.1:8000/api/candidates/')
      .then(res => setCandidates(res.data))
      .catch(err => console.error(err));
  }, []);

const filtered = candidates.filter(c => {
  const matchesFilter = filter === 'all' ||
    (c.vacancy_title && c.vacancy_title.toLowerCase().includes(filter));
  const matchesSearch = searchQuery === '' ||
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.vacancy_title && c.vacancy_title.toLowerCase().includes(searchQuery.toLowerCase()));
  return matchesFilter && matchesSearch;
});

  return (
    <div>
      {/* Фільтри */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'DM Mono', fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Вакансія:
        </span>
        {vacancies.map(v => (
          <div
            key={v.key}
            onClick={() => setFilter(v.key)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '6px 12px', borderRadius: '20px', fontSize: '0.78rem',
              fontWeight: 500, cursor: 'pointer',
              border: `1px solid ${filter === v.key ? 'var(--accent)' : 'var(--border)'}`,
              background: filter === v.key ? 'var(--accent)' : 'var(--surface)',
              color: filter === v.key ? '#fff' : 'var(--muted)',
              transition: 'all 0.15s',
            }}
          >
            {v.label}
            <span style={{
              fontFamily: 'DM Mono', fontSize: '0.65rem',
              background: filter === v.key ? 'rgba(255,255,255,0.2)' : 'var(--surface2)',
              color: filter === v.key ? '#fff' : 'var(--muted)',
              padding: '1px 6px', borderRadius: '10px',
            }}>
              {v.count}І
            </span>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: '20px', padding: '10px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '16px' }}>
        {columns.map(col => {
          const count = filtered.filter(c => c.status === col.key).length;
          return (
            <div key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--muted)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color }} />
              <strong style={{ color: 'var(--text)', fontFamily: 'DM Mono' }}>{count}</strong> {col.label.toLowerCase()}
            </div>
          );
        })}
      </div>

      {/* Канбан дошка */}
      <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px' }}>
        {columns.map(col => {
          const cards = filtered.filter(c => c.status === col.key);
          return (
            <div key={col.key} style={{ width: '250px', flexShrink: 0 }}>
              {/* Заголовок колонки */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 4px', marginBottom: '10px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: col.color }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{col.label}</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'DM Mono', fontSize: '0.7rem', background: 'var(--surface2)', color: 'var(--muted)', padding: '2px 8px', borderRadius: '20px' }}>
                  {cards.length}
                </span>
              </div>

              {/* Картки */}
              {cards.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)', fontSize: '0.8rem', border: '1px dashed var(--border)', borderRadius: '10px' }}>
                  Немає кандидатів
                </div>
              ) : (
                cards.map((c, i) => (
                <div key={i} style={{
                  background: 'var(--surface)', border: `1px solid ${selectedCard === c.id ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: '10px', padding: '14px', marginBottom: '10px',
                  cursor: 'pointer', boxShadow: 'var(--shadow)',
                  transition: 'all 0.15s',
                }} onClick={() => setSelectedCard(selectedCard === c.id ? null : c.id)}>
                  {selectedCard === c.id && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                      {columns.filter(col => col.key !== c.status).map(col => (
                        <button key={col.key} onClick={e => { e.stopPropagation(); updateStatus(c.id, col.key); }} style={{
                          padding: '4px 10px', borderRadius: '6px', border: 'none',
                          background: col.color, color: '#fff', fontSize: '0.7rem',
                          cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 600,
                        }}>
                          → {col.label}
                        </button>
                      ))}
                    </div>
                  )}
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '4px' }}>{c.first_name} {c.last_name}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: '10px' }}>{c.vacancy_title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontSize: '0.66rem', fontFamily: 'DM Mono', padding: '3px 8px', borderRadius: '4px',
                        background: statusColors[c.status].bg, color: statusColors[c.status].text,
                      }}>
                        {statusLabels[c.status]}
                      </span>
                      <span style={{ fontSize: '0.62rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>{c.created_at ? c.created_at.slice(0, 10) : ''}</span>
                      <div style={{ marginLeft: 'auto', width: '24px', height: '24px', borderRadius: '6px', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'var(--muted)' }}>
                        {c.first_name ? c.first_name[0] : ''}{c.last_name ? c.last_name[0] : ''}
                      </div>
                    </div>
                  </div>
                ))
              )}

              <button style={{
                width: '100%', padding: '10px', border: '1px dashed var(--border)',
                borderRadius: '10px', background: 'transparent', color: 'var(--muted)',
                fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'DM Sans',
              }}>
                + Додати кандидата
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Kanban;