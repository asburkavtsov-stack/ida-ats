import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { KANBAN_COLUMNS } from '../constants/statusColors';

function Analytics() {
  const [candidates, setCandidates] = useState([]);
  const [vacancies, setVacancies] = useState([]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    Promise.all([
      axios.get('/api/candidates/?page_size=1000'),
      axios.get('/api/vacancies/')
    ]).then(([cRes, vRes]) => {
      setCandidates(cRes.data.results ?? cRes.data);
      setVacancies(vRes.data.results ?? vRes.data);
    });
  }, []);

  const total = candidates.length || 1;
  const funnel = KANBAN_COLUMNS.map(col => ({
    key: col.key, label: col.label, color: col.color,
    count: candidates.filter(c => c.status === col.key).length,
  }));

  const byVacancy = vacancies.map(v => ({
    title: v.title,
    count: candidates.filter(c => c.vacancy === v.id).length,
  })).filter(v => v.count > 0).sort((a, b) => b.count - a.count);

  const maxByVacancy = Math.max(...byVacancy.map(v => v.count), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: isMobile ? '8px' : '0' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <div style={{ padding: isMobile ? '14px 16px' : '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Воронка кандидатів</div>
        <div style={{ padding: isMobile ? '16px' : '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {funnel.map((f, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>{f.label}</span>
                <span style={{ fontFamily: 'DM Mono', fontSize: '0.78rem', color: 'var(--muted)' }}>
                  {f.count} · {Math.round(f.count / total * 100)}%
                </span>
              </div>
              <div style={{ height: '10px', background: 'var(--surface2)', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '5px', background: f.color, width: `${Math.round(f.count / total * 100)}%`, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <div style={{ padding: isMobile ? '14px 16px' : '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Кандидати по вакансіях</div>
        <div style={{ padding: isMobile ? '16px' : '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {byVacancy.length === 0 && (
            <div style={{ color: 'var(--muted)', fontSize: '0.82rem', textAlign: 'center' }}>Поки немає даних</div>
          )}
          {byVacancy.map((v, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 500, wordBreak: 'break-word', flex: 1 }}>{v.title}</span>
                <span style={{ fontFamily: 'DM Mono', fontSize: '0.78rem', color: 'var(--muted)', flexShrink: 0 }}>{v.count}</span>
              </div>
              <div style={{ height: '10px', background: 'var(--surface2)', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '5px', background: 'var(--accent)', width: `${Math.round(v.count / maxByVacancy * 100)}%`, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
        gap: isMobile ? '10px' : '16px',
      }}>
        {[
          { label: 'Конверсія в оффер', value: `${Math.round(candidates.filter(c => c.status === 'offer').length / total * 100)}%` },
          { label: 'Активних вакансій', value: vacancies.filter(v => v.is_active).length },
          { label: 'Відмов', value: candidates.filter(c => c.status === 'rejected').length },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: isMobile ? '14px' : '20px', textAlign: 'center' }}>
            <div style={{ fontSize: isMobile ? '1.6rem' : '2rem', fontWeight: 700 }}>{s.value}</div>
            <div style={{ fontSize: isMobile ? '0.7rem' : '0.78rem', color: 'var(--muted)', marginTop: '6px' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Analytics;