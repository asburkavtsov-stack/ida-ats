import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Analytics() {
  const [candidates, setCandidates] = useState([]);
  const [vacancies, setVacancies] = useState([]);

  useEffect(() => {
    Promise.all([
      axios.get('http://127.0.0.1:8000/api/candidates/'),
      axios.get('http://127.0.0.1:8000/api/vacancies/')
    ]).then(([cRes, vRes]) => {
      setCandidates(cRes.data);
      setVacancies(vRes.data);
    });
  }, []);

const statuses = ['new', 'screening', 'interview', 'offer', 'rejected'];
const statusLabels = {
  new: 'Нові', screening: 'Скринінг', interview: 'Співбесіда', offer: 'Оффер', rejected: 'Відмова'
};
const statusColors = {
  new: '#7a1a2e', screening: '#b03050', interview: '#8a3a5a', offer: '#e8a0b0', rejected: '#aaaaaa'
};

  const total = candidates.length || 1;
  const funnel = statuses.map(s => ({
    key: s,
    label: statusLabels[s],
    color: statusColors[s],
    count: candidates.filter(c => c.status === s).length,
  }));

  const byVacancy = vacancies.map(v => ({
    title: v.title,
    count: candidates.filter(c => c.vacancy === v.id).length,
  })).filter(v => v.count > 0).sort((a, b) => b.count - a.count);

  const maxByVacancy = Math.max(...byVacancy.map(v => v.count), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Воронка */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
          Воронка кандидатів
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {funnel.map((f, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>{f.label}</span>
                <span style={{ fontFamily: 'DM Mono', fontSize: '0.78rem', color: 'var(--muted)' }}>
                  {f.count} · {total > 0 ? Math.round(f.count / total * 100) : 0}%
                </span>
              </div>
              <div style={{ height: '10px', background: 'var(--surface2)', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '5px',
                  background: f.color,
                  width: `${Math.round(f.count / total * 100)}%`,
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* По вакансіях */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
          Кандидати по вакансіях
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {byVacancy.length === 0 && (
            <div style={{ color: 'var(--muted)', fontSize: '0.82rem', textAlign: 'center' }}>
              Поки немає даних
            </div>
          )}
          {byVacancy.map((v, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>{v.title}</span>
                <span style={{ fontFamily: 'DM Mono', fontSize: '0.78rem', color: 'var(--muted)' }}>{v.count}</span>
              </div>
              <div style={{ height: '10px', background: 'var(--surface2)', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '5px',
                  background: 'var(--accent)',
                  width: `${Math.round(v.count / maxByVacancy * 100)}%`,
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Загальна статистика */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {[
          { label: 'Конверсія в оффер', value: `${total > 0 ? Math.round(candidates.filter(c => c.status === 'offer').length / total * 100) : 0}%` },
          { label: 'Активних вакансій', value: vacancies.filter(v => v.is_active).length },
          { label: 'Відмов', value: candidates.filter(c => c.status === 'reject').length },
        ].map((s, i) => (
          <div key={i} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{s.value}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '6px' }}>{s.label}</div>
          </div>
        ))}
      </div>

    </div>
  );
}

export default Analytics;