import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { KANBAN_COLUMNS, SOURCE_CONFIG } from '../constants/statusColors';

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

  // ─── Funnel ─────────────────────────────────────────────────
  const funnel = KANBAN_COLUMNS.map(col => ({
    key: col.key, label: col.label, color: col.color,
    count: candidates.filter(c => c.status === col.key).length,
  }));

  // ─── By Vacancy ─────────────────────────────────────────────
  const byVacancy = vacancies.map(v => ({
    title: v.title,
    count: candidates.filter(c => c.vacancy === v.id).length,
  })).filter(v => v.count > 0).sort((a, b) => b.count - a.count);
  const maxByVacancy = Math.max(...byVacancy.map(v => v.count), 1);

  // ─── By Source ──────────────────────────────────────────────
  const bySource = Object.keys(SOURCE_CONFIG).map(key => ({
    key,
    label: SOURCE_CONFIG[key].label,
    color: SOURCE_CONFIG[key].color,
    count: candidates.filter(c => c.source === key).length,
  })).filter(s => s.count > 0).sort((a, b) => b.count - a.count);
  const maxBySource = Math.max(...bySource.map(s => s.count), 1);

  // ─── Source → Status conversion ─────────────────────────────
  const sourceStatusMatrix = Object.keys(SOURCE_CONFIG).map(srcKey => {
    const srcCandidates = candidates.filter(c => c.source === srcKey);
    return {
      source: SOURCE_CONFIG[srcKey].label,
      color: SOURCE_CONFIG[srcKey].color,
      total: srcCandidates.length,
      offerRate: srcCandidates.length > 0
        ? Math.round(srcCandidates.filter(c => c.status === 'offer').length / srcCandidates.length * 100)
        : 0,
      interviewRate: srcCandidates.length > 0
        ? Math.round(srcCandidates.filter(c => ['interview', 'offer'].includes(c.status)).length / srcCandidates.length * 100)
        : 0,
    };
  }).filter(s => s.total > 0).sort((a, b) => b.total - a.total);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: isMobile ? '8px' : '0' }}>
      {/* ─── Stats Cards ────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: isMobile ? '10px' : '16px',
      }}>
        {[
          { label: 'Конверсія в оффер', value: `${Math.round(candidates.filter(c => c.status === 'offer').length / total * 100)}%`, color: '#16a34a' },
          { label: 'Активних вакансій', value: vacancies.filter(v => v.is_active).length, color: '#2563eb' },
          { label: 'Відмов', value: candidates.filter(c => c.status === 'rejected').length, color: '#dc2626' },
          { label: 'Всього кандидатів', value: candidates.length, color: '#7a1a2e' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: isMobile ? '14px' : '20px', textAlign: 'center', borderTop: `3px solid ${s.color}` }}>
            <div style={{ fontSize: isMobile ? '1.6rem' : '2rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: isMobile ? '0.7rem' : '0.78rem', color: 'var(--muted)', marginTop: '6px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ─── Funnel ─────────────────────────────────────────── */}
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

      {/* ─── By Source ──────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <div style={{ padding: isMobile ? '14px 16px' : '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Кандидати за джерелом</div>
        <div style={{ padding: isMobile ? '16px' : '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {bySource.length === 0 && (
            <div style={{ color: 'var(--muted)', fontSize: '0.82rem', textAlign: 'center' }}>Поки немає даних</div>
          )}
          {bySource.map((s, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color }} />
                  {s.label}
                </span>
                <span style={{ fontFamily: 'DM Mono', fontSize: '0.78rem', color: 'var(--muted)' }}>
                  {s.count} · {Math.round(s.count / total * 100)}%
                </span>
              </div>
              <div style={{ height: '10px', background: 'var(--surface2)', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '5px', background: s.color, width: `${Math.round(s.count / maxBySource * 100)}%`, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Source Conversion Rates ──────────────────────────── */}
      {sourceStatusMatrix.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
          <div style={{ padding: isMobile ? '14px 16px' : '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
            Конверсія за джерелами
          </div>
          <div style={{ padding: isMobile ? '16px' : '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sourceStatusMatrix.map((s, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color }} />
                    {s.source}
                    <span style={{ fontFamily: 'DM Mono', fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 400 }}>
                      {s.total} кандидатів
                    </span>
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ background: 'var(--bg)', borderRadius: '6px', padding: '8px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#16a34a' }}>{s.offerRate}%</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>Оффер</div>
                  </div>
                  <div style={{ background: 'var(--bg)', borderRadius: '6px', padding: '8px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#2563eb' }}>{s.interviewRate}%</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>Співбесіда+</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── By Vacancy ─────────────────────────────────────── */}
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
    </div>
  );
}

export default Analytics;