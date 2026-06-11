// Analytics.js — оновлено під динамічні стейджі + Recharts
import React, { useState, useEffect, useCallback } from 'react';
import api from 'axiosConfig';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
  LabelList, Legend,
} from 'recharts';
import { SOURCE_FILTERS } from '../constants/statusColors';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getSpeedColor  = d => d <= 14 ? '#16a34a' : d <= 30 ? '#eab308' : '#dc2626';
const getSpeedLabel  = d => d <= 7 ? 'Відмінно' : d <= 14 ? 'Добре' : d <= 30 ? 'Нормально' : d <= 60 ? 'Повільно' : 'Критично';
const getSpeedBg     = d => d <= 14 ? '#dcfce7' : d <= 30 ? '#fef3c7' : '#fee2e2';
const getSpeedText   = d => d <= 14 ? '#16a34a' : d <= 30 ? '#ca8a04' : '#dc2626';
const distributionColors = ['#16a34a', '#22c55e', '#eab308', '#f97316', '#dc2626'];

// Recharts custom tooltip
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '10px 14px',
      fontSize: '0.78rem',
      fontFamily: 'DM Mono',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--text)' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span>{p.name}: <strong>{p.value}</strong></span>
        </div>
      ))}
    </div>
  );
};

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHeader = ({ icon, title, sub, actions }) => (
  <div style={{
    padding: '14px 20px',
    borderBottom: '1px solid var(--border)',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '10px',
  }}>
    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span aria-hidden="true">{icon}</span>
      {title}
      {sub && (
        <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--muted)', fontFamily: 'DM Mono' }}>
          · {sub}
        </span>
      )}
    </span>
    {actions && <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{actions}</div>}
  </div>
);

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ value, unit, label, sub, color, isMobile }) => (
  <div style={{
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: isMobile ? '14px' : '20px',
    textAlign: 'center',
    borderTop: `3px solid ${color}`,
  }}>
    <div style={{ fontSize: isMobile ? '1.4rem' : '1.8rem', fontWeight: 700, color, lineHeight: 1 }}>
      {value}{unit && <span style={{ fontSize: '0.7em', marginLeft: '2px' }}>{unit}</span>}
    </div>
    <div style={{ fontSize: isMobile ? '0.7rem' : '0.78rem', color: 'var(--muted)', marginTop: '6px' }}>{label}</div>
    {sub && (
      <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '4px',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {sub}
      </div>
    )}
  </div>
);

// ─── Spinner ─────────────────────────────────────────────────────────────────
const Spinner = ({ text }) => (
  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
    <div style={{
      width: '24px', height: '24px', borderRadius: '50%',
      border: '2px solid var(--border)', borderTop: '2px solid var(--accent)',
      animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
    }} />
    {text}
  </div>
);

// ─── Export Button ────────────────────────────────────────────────────────────
const ExportBtn = ({ onClick, disabled, color, icon, label }) => (
  <button onClick={onClick} disabled={disabled} type="button" style={{
    padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)',
    background: 'var(--bg)', color, fontSize: '0.72rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'DM Mono', display: 'flex', alignItems: 'center', gap: '4px',
  }}>
    <span aria-hidden="true">{icon}</span> {label}
  </button>
);

// ═════════════════════════════════════════════════════════════════════════════
function Analytics() {
  const [candidates,   setCandidates]   = useState([]);
  const [vacancies,    setVacancies]    = useState([]);
  const [isMobile,     setIsMobile]     = useState(false);

  // Time-to-Hire
  const [timeToHire,        setTimeToHire]        = useState(null);
  const [timeToHirePeriod,  setTimeToHirePeriod]  = useState('month');
  const [timeToHireVacancy, setTimeToHireVacancy] = useState('all');
  const [tthLoading,        setTthLoading]        = useState(false);

  // HR Effectiveness
  const [hrEff,        setHrEff]        = useState(null);
  const [hrEffLoading, setHrEffLoading] = useState(false);

  // Monthly trend
  const [monthly,        setMonthly]        = useState([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  const [exporting, setExporting] = useState(false);

  // D&I
  const [diData,    setDiData]    = useState(null);
  const [diLoading, setDiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ─── Loads ─────────────────────────────────────────────────────────────────
  const loadTTH = useCallback(() => {
    setTthLoading(true);
    const params = new URLSearchParams({ period: timeToHirePeriod });
    if (timeToHireVacancy !== 'all') params.set('vacancy', timeToHireVacancy);
    api.get(`/api/analytics/time-to-hire/?${params}`)
      .then(r => setTimeToHire(r.data))
      .catch(() => {})
      .finally(() => setTthLoading(false));
  }, [timeToHirePeriod, timeToHireVacancy]);

  const loadHR = useCallback(() => {
    setHrEffLoading(true);
    api.get('/api/analytics/hr-effectiveness/')
      .then(r => setHrEff(r.data))
      .catch(() => {})
      .finally(() => setHrEffLoading(false));
  }, []);

  const loadMonthly = useCallback(() => {
    setMonthlyLoading(true);
    api.get('/api/analytics/monthly-trend/')
      .then(r => setMonthly(r.data.monthly || []))
      .catch(() => {})
      .finally(() => setMonthlyLoading(false));
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/api/candidates/?page_size=1000'),
      api.get('/api/vacancies/'),
    ]).then(([cRes, vRes]) => {
      setCandidates(cRes.data.results ?? cRes.data);
      setVacancies(vRes.data.results ?? vRes.data);
    }).catch(() => {});
    loadTTH();
    loadHR();
    loadMonthly();
    setDiLoading(true);
    api.get('/api/analytics/di/')
      .then(r => setDiData(r.data))
      .catch(() => {})
      .finally(() => setDiLoading(false));
  }, []); // eslint-disable-line

  useEffect(() => { loadTTH(); }, [loadTTH]);

  // ─── Export ────────────────────────────────────────────────────────────────
  const handleExport = async (type, format) => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (type === 'tth' && timeToHireVacancy !== 'all') params.set('vacancy', timeToHireVacancy);
      const urls = {
        tth: { excel: `/api/analytics/time-to-hire/export-excel/?${params}`, pdf: `/api/analytics/time-to-hire/export-pdf/?${params}` },
        hr:  { excel: '/api/analytics/hr-effectiveness/export-excel/',       pdf: '/api/analytics/hr-effectiveness/export-pdf/' },
      };
      const url = urls[type][format];
      const res = await api.get(url, { responseType: 'blob' });
      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      const mime = format === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';
      const blob = new Blob([res.data], { type: mime });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${type}_${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch { alert('Не вдалося експортувати'); }
    finally { setExporting(false); }
  };

  // ─── Derived data ──────────────────────────────────────────────────────────
  const total = candidates.length || 1;

  // Воронка — беремо з TTH response (де є funnel від бекенду) або будуємо локально
  const funnel = timeToHire?.funnel?.length
    ? timeToHire.funnel
    : [];  // fallback — порожньо, дані завантажаться після TTH

  // По вакансіях (локально)
  const byVacancy = vacancies
    .map(v => ({ title: v.title, count: candidates.filter(c => c.vacancy === v.id).length }))
    .filter(v => v.count > 0)
    .sort((a, b) => b.count - a.count);
  const maxByVacancy = Math.max(...byVacancy.map(v => v.count), 1);

  // По джерелах (локально)
  const bySource = SOURCE_FILTERS
    .filter(f => f.key !== 'all')
    .map(f => ({ key: f.key, label: f.label, count: candidates.filter(c => c.source === f.key).length }))
    .filter(s => s.count > 0)
    .sort((a, b) => b.count - a.count);

  // Topline stats — визначаємо термінальні стейджі з воронки TTH
  // funnel містить { label, count, color, stage_id, is_terminal, is_rejection } від бекенду
  const terminalStageIds = new Set(
    (timeToHire?.funnel || [])
      .filter(f => f.is_terminal)
      .map(f => f.stage_id)
  );
  const rejectedStageIds = new Set(
    (timeToHire?.funnel || [])
      .filter(f => f.is_rejection)
      .map(f => f.stage_id)
  );
  // Fallback: шукаємо по назві якщо бекенд не повертає флаги
  const offerCount = terminalStageIds.size > 0
    ? candidates.filter(c => terminalStageIds.has(c.stage_id ?? c.stage)).length
    : candidates.filter(c => {
        const stageLabel = (timeToHire?.funnel || []).find(f => f.stage_id === (c.stage_id ?? c.stage))?.label || '';
        return /оффер|offer|hired|прийнят/i.test(stageLabel);
      }).length;
  const rejectedCount = rejectedStageIds.size > 0
    ? candidates.filter(c => rejectedStageIds.has(c.stage_id ?? c.stage)).length
    : candidates.filter(c => {
        const stageLabel = (timeToHire?.funnel || []).find(f => f.stage_id === (c.stage_id ?? c.stage))?.label || '';
        return /відмов|reject|відхил/i.test(stageLabel);
      }).length;

  // Recharts funnel data (для BarChart воронки)
  const funnelChartData = funnel.map(f => ({ name: f.label, value: f.count, color: f.color }));

  // Monthly bar data
  const monthlyChartData = monthly.map(m => ({
    name: m.label,
    Всього: m.total,
    Оффери: m.offers,
    Відмови: m.rejected,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: isMobile ? '8px' : '0' }}>

      {/* ─── Top Stats ───────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: isMobile ? '10px' : '16px',
      }}>
        {[
          { label: 'Конверсія в оффер',  value: `${Math.round(offerCount / total * 100)}%`, color: '#16a34a' },
          { label: 'Активних вакансій',  value: vacancies.filter(v => v.is_active).length, color: '#2563eb' },
          { label: 'Відмов',             value: rejectedCount, color: '#dc2626' },
          { label: 'Всього кандидатів',  value: candidates.length, color: '#7a1a2e' },
        ].map((s, i) => (
          <StatCard key={i} value={s.value} label={s.label} color={s.color} isMobile={isMobile} />
        ))}
      </div>

      {/* ─── Динаміка по місяцях (Recharts LineChart) ────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <SectionHeader icon="📈" title="Динаміка по місяцях" />
        {monthlyLoading ? <Spinner text="Завантаження..." /> : monthly.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📈</div>
            Недостатньо даних для графіка
          </div>
        ) : (
          <div style={{ padding: '24px 16px 16px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyChartData} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'DM Mono', fill: 'var(--muted)' }} />
                <YAxis tick={{ fontSize: 11, fontFamily: 'DM Mono', fill: 'var(--muted)' }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.75rem', fontFamily: 'DM Mono' }} />
                <Line type="monotone" dataKey="Всього"  stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Оффери"  stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Відмови" stroke="#dc2626" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ─── Воронка Recharts ─────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <SectionHeader icon="🔻" title="Воронка кандидатів" />
        {tthLoading ? <Spinner text="Завантаження..." /> : funnelChartData.length === 0 ? (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Fallback: локальний варіант поки funnel не завантажився */}
            <div style={{ color: 'var(--muted)', fontSize: '0.82rem', textAlign: 'center', padding: '20px 0' }}>
              Завантаження воронки...
            </div>
          </div>
        ) : (
          <div style={{ padding: isMobile ? '16px' : '24px' }}>
            {/* Recharts horizontal bar — воронка */}
            <ResponsiveContainer width="100%" height={funnelChartData.length * 44 + 20}>
              <BarChart
                layout="vertical"
                data={funnelChartData}
                margin={{ top: 0, right: 40, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11, fontFamily: 'DM Mono', fill: 'var(--muted)' }} />
                <YAxis type="category" dataKey="name" width={110}
                  tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: 'var(--text)' }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Кандидатів" radius={[0, 4, 4, 0]} maxBarSize={28}>
                  {funnelChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                  <LabelList dataKey="value" position="right"
                    style={{ fontSize: '0.75rem', fontFamily: 'DM Mono', fill: 'var(--muted)' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ─── Time-to-Hire ─────────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <SectionHeader
          icon="⏱"
          title="Time-to-Hire"
          sub={timeToHire?.total_offers > 0 ? `${timeToHire.total_offers} офферів` : null}
          actions={<>
            <select value={timeToHireVacancy} onChange={e => setTimeToHireVacancy(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.78rem', fontFamily: 'DM Sans', cursor: 'pointer', outline: 'none' }}>
              <option value="all">Всі вакансії</option>
              {vacancies.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
            </select>
            <select value={timeToHirePeriod} onChange={e => setTimeToHirePeriod(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.78rem', fontFamily: 'DM Sans', cursor: 'pointer', outline: 'none' }}>
              <option value="day">По днях</option>
              <option value="week">По тижнях</option>
              <option value="month">По місяцях</option>
              <option value="quarter">По кварталах</option>
              <option value="year">По роках</option>
            </select>
            {timeToHire?.total_offers > 0 && <>
              <ExportBtn onClick={() => handleExport('tth', 'excel')} disabled={exporting} color="#16a34a" icon="📊" label="Excel" />
              <ExportBtn onClick={() => handleExport('tth', 'pdf')}   disabled={exporting} color="#dc2626" icon="📄" label="PDF" />
            </>}
          </>}
        />

        {tthLoading ? <Spinner text="Завантаження Time-to-Hire..." /> :
          !timeToHire || timeToHire.total_offers === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏱</div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Немає даних про Time-to-Hire</div>
              <div style={{ fontSize: '0.78rem' }}>Потрібен хоча б 1 кандидат на фінальному етапі</div>
            </div>
          ) : (
            <div style={{ padding: isMobile ? '16px' : '24px' }}>
              {/* Key metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: isMobile ? '10px' : '16px', marginBottom: '24px' }}>
                <StatCard value={timeToHire.overall_avg} unit="дн" label="Середній час"
                  sub={`медіана: ${timeToHire.median} дн`} color={getSpeedColor(timeToHire.overall_avg)} isMobile={isMobile} />
                <StatCard value={timeToHire.total_offers} label="Всього офферів" color="#2563eb" isMobile={isMobile} />
                {timeToHire.by_vacancy.length > 0 && <>
                  <StatCard value={Math.min(...timeToHire.by_vacancy.map(v => v.avg_days))} unit="дн"
                    label="Найшвидша вакансія" color="#16a34a"
                    sub={timeToHire.by_vacancy[0]?.vacancy_title} isMobile={isMobile} />
                  <StatCard value={Math.max(...timeToHire.by_vacancy.map(v => v.avg_days))} unit="дн"
                    label="Найповільніша" color="#dc2626"
                    sub={timeToHire.by_vacancy[timeToHire.by_vacancy.length - 1]?.vacancy_title} isMobile={isMobile} />
                </>}
              </div>

              {/* Recharts: TTH тренд по місяцях */}
              {timeToHire.by_period?.length > 1 && (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted)', marginBottom: '14px' }}>
                    Динаміка Time-to-Hire
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={timeToHire.by_period} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="period" tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: 'var(--muted)' }} />
                      <YAxis tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: 'var(--muted)' }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="avg_days" name="Середній час (дн)" radius={[3, 3, 0, 0]} maxBarSize={32}>
                        {timeToHire.by_period.map((p, i) => (
                          <Cell key={i} fill={getSpeedColor(p.avg_days)} />
                        ))}
                        <LabelList dataKey="avg_days" position="top"
                          style={{ fontSize: '0.68rem', fontFamily: 'DM Mono', fill: 'var(--muted)' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Distribution */}
              {timeToHire.distribution?.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted)', marginBottom: '14px' }}>
                    Розподіл по швидкості
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {timeToHire.distribution.map((d, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '90px', fontSize: '0.78rem', color: 'var(--text)', fontFamily: 'DM Mono', flexShrink: 0 }}>{d.range}</div>
                        <div style={{ flex: 1, height: '8px', background: 'var(--surface2)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: '4px', background: distributionColors[i], width: `${d.percentage}%`, transition: 'width 0.5s ease' }} />
                        </div>
                        <div style={{ width: '70px', textAlign: 'right', fontSize: '0.78rem', fontFamily: 'DM Mono', color: 'var(--muted)', flexShrink: 0 }}>
                          {d.count} <span style={{ opacity: 0.6 }}>({d.percentage}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* By vacancy table */}
              {timeToHire.by_vacancy?.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted)', marginBottom: '14px' }}>
                    По вакансіях
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {timeToHire.by_vacancy.map(v => {
                      const maxAvg = Math.max(...timeToHire.by_vacancy.map(x => x.avg_days), 1);
                      return (
                        <div key={v.vacancy_id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 500, flex: 1, wordBreak: 'break-word' }}>{v.vacancy_title}</span>
                            <span style={{ fontFamily: 'DM Mono', fontSize: '0.78rem', color: 'var(--muted)', flexShrink: 0 }}>
                              <strong style={{ color: 'var(--text)' }}>{v.avg_days}</strong> дн · {v.offers_count} офф.
                            </span>
                          </div>
                          <div style={{ height: '10px', background: 'var(--surface2)', borderRadius: '5px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: '5px', background: getSpeedColor(v.avg_days), width: `${(v.avg_days / maxAvg * 100)}%`, transition: 'width 0.5s ease' }} />
                          </div>
                          <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
                            <span>мін: {v.min_days} дн</span>
                            <span>макс: {v.max_days} дн</span>
                            <span>медіана: {v.median_days} дн</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Period table */}
              {timeToHire.by_period?.length > 0 && (
                <div style={{ marginTop: '24px' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted)', marginBottom: '14px' }}>
                    Деталізація по {timeToHirePeriod === 'day' ? 'днях' : timeToHirePeriod === 'week' ? 'тижнях' : timeToHirePeriod === 'month' ? 'місяцях' : timeToHirePeriod === 'quarter' ? 'кварталах' : 'роках'}
                  </div>
                  <div style={{ background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: '380px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                          {['Період', 'Середній час', 'Офферів', 'Оцінка'].map(h => (
                            <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Період' ? 'left' : 'center', fontFamily: 'DM Mono', fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {timeToHire.by_period.map((p, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontSize: '0.8rem' }}>{p.period}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>
                              <span style={{ color: getSpeedColor(p.avg_days) }}>{p.avg_days} дн</span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'DM Mono' }}>{p.offers_count}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <span style={{ fontSize: '0.68rem', padding: '3px 10px', borderRadius: '10px', fontFamily: 'DM Mono', fontWeight: 600, background: getSpeedBg(p.avg_days), color: getSpeedText(p.avg_days) }}>
                                {getSpeedLabel(p.avg_days)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )
        }
      </div>

      {/* ─── По джерелах ──────────────────────────────────────────────────────── */}
      {bySource.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
          <SectionHeader icon="🌐" title="Кандидати за джерелом" />
          <div style={{ padding: isMobile ? '16px' : '24px' }}>
            <ResponsiveContainer width="100%" height={Math.max(bySource.length * 44 + 20, 120)}>
              <BarChart layout="vertical" data={bySource.map(s => ({ name: s.label, value: s.count }))}
                margin={{ top: 0, right: 40, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11, fontFamily: 'DM Mono', fill: 'var(--muted)' }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: 'var(--text)' }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Кандидатів" fill="var(--accent)" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  <LabelList dataKey="value" position="right" style={{ fontSize: '0.75rem', fontFamily: 'DM Mono', fill: 'var(--muted)' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ─── По вакансіях ─────────────────────────────────────────────────────── */}
      {byVacancy.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
          <SectionHeader icon="💼" title="Кандидати по вакансіях" />
          <div style={{ padding: isMobile ? '16px' : '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {byVacancy.map((v, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 500, flex: 1, wordBreak: 'break-word' }}>{v.title}</span>
                  <span style={{ fontFamily: 'DM Mono', fontSize: '0.78rem', color: 'var(--muted)', flexShrink: 0 }}>{v.count}</span>
                </div>
                <div style={{ height: '10px', background: 'var(--surface2)', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '5px', background: 'var(--accent)', width: `${Math.round(v.count / maxByVacancy * 100)}%`, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── HR Effectiveness ─────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <SectionHeader
          icon="👤"
          title="Ефективність HR"
          sub={hrEff?.summary.total_hr > 0 ? `${hrEff.summary.total_hr} HR · ${hrEff.summary.overall_conversion}% конверсія` : null}
          actions={hrEff?.hr_managers.length > 0 ? <>
            <ExportBtn onClick={() => handleExport('hr', 'excel')} disabled={exporting} color="#16a34a" icon="📊" label="Excel" />
            <ExportBtn onClick={() => handleExport('hr', 'pdf')}   disabled={exporting} color="#dc2626" icon="📄" label="PDF" />
          </> : null}
        />

        {hrEffLoading ? <Spinner text="Завантаження статистики HR..." /> :
          !hrEff || hrEff.hr_managers.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>👤</div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Немає даних про ефективність HR</div>
              <div style={{ fontSize: '0.78rem' }}>Призначте кандидатів HR-менеджерам</div>
            </div>
          ) : (
            <div style={{ padding: isMobile ? '16px' : '24px' }}>
              {/* Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: isMobile ? '10px' : '16px', marginBottom: '24px' }}>
                <StatCard value={hrEff.summary.total_hr}              label="HR-менеджерів"       color="#2563eb" isMobile={isMobile} />
                <StatCard value={hrEff.summary.total_candidates}      label="Всього кандидатів"   color="#7a1a2e" isMobile={isMobile} />
                <StatCard value={hrEff.summary.overall_conversion} unit="%" label="Загальна конверсія"
                  sub={`${hrEff.summary.total_offers} офферів`} color="#16a34a" isMobile={isMobile} />
                <StatCard value={Math.max(...hrEff.hr_managers.map(h => h.conversion_rate))} unit="%"
                  label="Найкраща конверсія" sub={hrEff.hr_managers[0]?.hr_name} color="#eab308" isMobile={isMobile} />
              </div>

              {/* Recharts: conversion bar по HR */}
              {hrEff.hr_managers.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted)', marginBottom: '14px' }}>
                    Конверсія по HR-менеджерах
                  </div>
                  <ResponsiveContainer width="100%" height={hrEff.hr_managers.length * 44 + 20}>
                    <BarChart
                      layout="vertical"
                      data={hrEff.hr_managers.map(h => ({ name: h.hr_name, value: h.conversion_rate, total: h.total_candidates }))}
                      margin={{ top: 0, right: 50, left: 4, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                      <XAxis type="number" unit="%" domain={[0, 100]} tick={{ fontSize: 11, fontFamily: 'DM Mono', fill: 'var(--muted)' }} />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: 'var(--text)' }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="value" name="Конверсія %" radius={[0, 4, 4, 0]} maxBarSize={24}>
                        {hrEff.hr_managers.map((h, i) => (
                          <Cell key={i} fill={h.conversion_rate >= 20 ? '#16a34a' : h.conversion_rate >= 10 ? '#eab308' : '#dc2626'} />
                        ))}
                        <LabelList dataKey="value" position="right" formatter={v => `${v}%`}
                          style={{ fontSize: '0.75rem', fontFamily: 'DM Mono', fill: 'var(--muted)' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* HR Table */}
              <div style={{ background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: '700px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                      {['HR Менеджер', 'Кандидатів', 'Офферів', 'Відмов', 'Конверсія', 'Активних', 'Time-to-Hire'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: h === 'HR Менеджер' ? 'left' : 'center', fontFamily: 'DM Mono', fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hrEff.hr_managers.map(hr => (
                      <tr key={hr.hr_id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `hsl(${(hr.hr_id * 137) % 360}, 60%, 45%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
                              {hr.hr_name?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600 }}>{hr.hr_name}</div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>@{hr.hr_username}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'DM Mono', fontWeight: 600 }}>{hr.total_candidates}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: '#16a34a', fontWeight: 600, fontFamily: 'DM Mono' }}>{hr.offers_count}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'DM Mono', color: 'var(--muted)' }}>{hr.rejected_count}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: hr.conversion_rate >= 20 ? '#16a34a' : hr.conversion_rate >= 10 ? '#eab308' : '#dc2626' }}>
                            {hr.conversion_rate}%
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'DM Mono' }}>{hr.active_candidates}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'DM Mono', color: 'var(--muted)' }}>
                          {hr.time_to_hire_avg ? `${hr.time_to_hire_avg} дн` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        }
      </div>

      {/* ─── Diversity & Inclusion ───────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <SectionHeader icon="🌍" title="Diversity & Inclusion" sub="тільки кандидати зі згодою на D&I дані" />

        {diLoading ? <Spinner text="Завантаження D&I даних..." /> : !diData ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🌍</div>
            Немає D&I даних
          </div>
        ) : (
          <div style={{ padding: '20px' }}>

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
              {[
                { label: 'Всього кандидатів', value: diData.summary.total_candidates, color: 'var(--text)' },
                { label: 'Заповнили D&I', value: diData.summary.with_di_consent, color: '#7c3aed' },
                { label: 'Частка D&I', value: `${diData.summary.consent_rate_pct}%`, color: '#7c3aed' },
                { label: 'Ветерани', value: diData.summary.veteran_count, color: '#2563eb' },
              ].map((s, i) => (
                <div key={i} style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'DM Mono', color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--muted)', fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '3px' }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>

              {/* Гендерний розподіл */}
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: '10px' }}>
                  Гендерний розподіл
                </div>
                {diData.gender.length === 0 ? (
                  <div style={{ color: 'var(--muted)', fontSize: '0.8rem', fontFamily: 'DM Mono' }}>Немає даних</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {diData.gender.map(g => {
                      const total = diData.summary.with_di_consent || 1;
                      const pct = Math.round(g.count / total * 100);
                      const colors = { male: '#2563eb', female: '#db2777', non_binary: '#7c3aed', prefer_not: '#9ca3af', other: '#6b7280' };
                      const color = colors[g.key] || '#6b7280';
                      return (
                        <div key={g.key}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '3px' }}>
                            <span>{g.label}</span>
                            <span style={{ fontFamily: 'DM Mono', fontWeight: 600, color }}>{g.count} ({pct}%)</span>
                          </div>
                          <div style={{ height: '6px', borderRadius: '3px', background: 'var(--border)' }}>
                            <div style={{ width: `${pct}%`, height: '100%', borderRadius: '3px', background: color, transition: 'width 0.4s' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Вікові групи */}
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: '10px' }}>
                  Вікові групи
                </div>
                {diData.age.length === 0 ? (
                  <div style={{ color: 'var(--muted)', fontSize: '0.8rem', fontFamily: 'DM Mono' }}>Немає даних</div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={diData.age} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fontFamily: 'DM Mono' }} />
                      <YAxis tick={{ fontSize: 10, fontFamily: 'DM Mono' }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" name="Кандидатів" radius={[4,4,0,0]}>
                        {diData.age.map((_, i) => (
                          <Cell key={i} fill={distributionColors[i % distributionColors.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* D&I воронка по гендеру */}
            {diData.funnel?.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: '10px' }}>
                  D&I воронка по стейджах
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={diData.funnel} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="stage" tick={{ fontSize: 10, fontFamily: 'DM Mono' }} />
                    <YAxis tick={{ fontSize: 10, fontFamily: 'DM Mono' }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '0.72rem', fontFamily: 'DM Mono' }} />
                    <Bar dataKey="male"   name="Чоловіки"  stackId="a" fill="#2563eb" />
                    <Bar dataKey="female" name="Жінки"     stackId="a" fill="#db2777" />
                    <Bar dataKey="other"  name="Інші"      stackId="a" fill="#9ca3af" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Конверсія по гендеру */}
            {diData.conversion_by_gender && (
              <div style={{ marginTop: '16px', padding: '14px', background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: '10px' }}>
                  Конверсія в оффер по гендеру
                </div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {[
                    { key: 'male', label: 'Чоловіки', color: '#2563eb' },
                    { key: 'female', label: 'Жінки', color: '#db2777' },
                  ].map(g => {
                    const d = diData.conversion_by_gender[g.key];
                    return d?.total > 0 ? (
                      <div key={g.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.82rem' }}>{g.label}:</span>
                        <span style={{ fontFamily: 'DM Mono', fontWeight: 700, fontSize: '0.88rem', color: d.rate >= 20 ? '#16a34a' : d.rate >= 10 ? '#ca8a04' : '#dc2626' }}>
                          {d.rate}% ({d.hired}/{d.total})
                        </span>
                      </div>
                    ) : null;
                  })}
                </div>
                {Math.abs((diData.conversion_by_gender.male?.rate || 0) - (diData.conversion_by_gender.female?.rate || 0)) > 10 && (
                  <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '6px', background: '#fef3c7', color: '#92400e', fontSize: '0.72rem', fontFamily: 'DM Mono' }}>
                    ⚠ Різниця в конверсії між гендерами &gt; 10% — варто звернути увагу на упередженість у відборі
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: '#f0f9ff', border: '1px solid #bae6fd', fontSize: '0.72rem', color: '#0369a1', fontFamily: 'DM Mono' }}>
              🔒 D&I дані збираються тільки за добровільною згодою кандидата (окрема GDPR-згода). Використовуйте для покращення процесів, не для дискримінації.
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default Analytics;