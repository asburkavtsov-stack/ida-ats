import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { KANBAN_COLUMNS, SOURCE_CONFIG } from '../constants/statusColors';

function Analytics() {
  const [candidates, setCandidates] = useState([]);
  const [vacancies, setVacancies] = useState([]);
  const [isMobile, setIsMobile] = useState(false);

  // Time-to-Hire states
  const [timeToHire, setTimeToHire] = useState(null);
  const [timeToHirePeriod, setTimeToHirePeriod] = useState('month');
  const [timeToHireVacancy, setTimeToHireVacancy] = useState('all');
  const [timeToHireLoading, setTimeToHireLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // HR Effectiveness states
  const [hrEffectiveness, setHrEffectiveness] = useState(null);
  const [hrEffectivenessLoading, setHrEffectivenessLoading] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadTimeToHire = useCallback(() => {
    setTimeToHireLoading(true);
    const params = new URLSearchParams();
    params.set('period', timeToHirePeriod);
    if (timeToHireVacancy !== 'all') params.set('vacancy', timeToHireVacancy);

    axios.get(`/api/analytics/time-to-hire/?${params.toString()}`)
      .then(res => setTimeToHire(res.data))
      .catch(() => {})
      .finally(() => setTimeToHireLoading(false));
  }, [timeToHirePeriod, timeToHireVacancy]);

  const loadHrEffectiveness = useCallback(() => {
    setHrEffectivenessLoading(true);
    axios.get('/api/analytics/hr-effectiveness/')
      .then(res => setHrEffectiveness(res.data))
      .catch(() => {})
      .finally(() => setHrEffectivenessLoading(false));
  }, []);

  useEffect(() => {
    Promise.all([
      axios.get('/api/candidates/?page_size=1000'),
      axios.get('/api/vacancies/')
    ]).then(([cRes, vRes]) => {
      setCandidates(cRes.data.results ?? cRes.data);
      setVacancies(vRes.data.results ?? vRes.data);
    });
    loadTimeToHire();
    loadHrEffectiveness();
  }, [loadTimeToHire, loadHrEffectiveness]);

  useEffect(() => {
    loadTimeToHire();
  }, [loadTimeToHire]);

  // Експорт функції
  const handleExport = async (type, format) => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      
      if (type === 'tth') {
        if (timeToHireVacancy !== 'all') params.set('vacancy', timeToHireVacancy);
        
        const url = format === 'excel' 
          ? `/api/analytics/time-to-hire/export-excel/?${params.toString()}`
          : `/api/analytics/time-to-hire/export-pdf/?${params.toString()}`;
        
        const response = await axios.get(url, { responseType: 'blob' });
        const blob = new Blob([response.data], { 
          type: format === 'excel' 
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/pdf'
        });
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        const dateStr = new Date().toISOString().slice(0, 10);
        link.href = downloadUrl;
        link.setAttribute('download', `time_to_hire_${dateStr}.${format === 'excel' ? 'xlsx' : 'pdf'}`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);
      } else if (type === 'hr') {
        const url = format === 'excel'
          ? '/api/analytics/hr-effectiveness/export-excel/'
          : '/api/analytics/hr-effectiveness/export-pdf/';
        
        const response = await axios.get(url, { responseType: 'blob' });
        const blob = new Blob([response.data], { 
          type: format === 'excel'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/pdf'
        });
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        const dateStr = new Date().toISOString().slice(0, 10);
        link.href = downloadUrl;
        link.setAttribute('download', `hr_effectiveness_${dateStr}.${format === 'excel' ? 'xlsx' : 'pdf'}`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);
      }
    } catch (err) {
      console.error('Помилка експорту:', err);
      alert('Не вдалося експортувати звіт');
    } finally {
      setExporting(false);
    }
  };

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

  // ─── Time-to-Hire helpers ───────────────────────────────────
  const getSpeedColor = (days) => {
    if (days <= 14) return '#16a34a';
    if (days <= 30) return '#eab308';
    return '#dc2626';
  };

  const getSpeedLabel = (days) => {
    if (days <= 7) return 'Відмінно';
    if (days <= 14) return 'Добре';
    if (days <= 30) return 'Нормально';
    if (days <= 60) return 'Повільно';
    return 'Критично';
  };

  const getSpeedBg = (days) => {
    if (days <= 14) return '#dcfce7';
    if (days <= 30) return '#fef3c7';
    return '#fee2e2';
  };

  const getSpeedText = (days) => {
    if (days <= 14) return '#16a34a';
    if (days <= 30) return '#ca8a04';
    return '#dc2626';
  };

  const distributionColors = ['#16a34a', '#22c55e', '#eab308', '#f97316', '#dc2626'];

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

      {/* ═══════════════════════════════════════════════════════════
          TIME-TO-HIRE SECTION
          ═══════════════════════════════════════════════════════════ */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <div style={{
          padding: isMobile ? '14px 16px' : '16px 20px',
          borderBottom: '1px solid var(--border)',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span aria-hidden="true">⏱</span>
            Time-to-Hire
            {timeToHire && timeToHire.total_offers > 0 && (
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 400,
                color: 'var(--muted)',
                fontFamily: 'DM Mono',
              }}>
                · {timeToHire.total_offers} офферів
              </span>
            )}
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={timeToHireVacancy}
              onChange={e => setTimeToHireVacancy(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: '0.78rem',
                fontFamily: 'DM Sans',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all">Всі вакансії</option>
              {vacancies.map(v => (
                <option key={v.id} value={v.id}>{v.title}</option>
              ))}
            </select>

            <select
              value={timeToHirePeriod}
              onChange={e => setTimeToHirePeriod(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: '0.78rem',
                fontFamily: 'DM Sans',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="day">По днях</option>
              <option value="week">По тижнях</option>
              <option value="month">По місяцях</option>
              <option value="quarter">По кварталах</option>
              <option value="year">По роках</option>
            </select>

            {/* Кнопки експорту Time-to-Hire */}
            {timeToHire && timeToHire.total_offers > 0 && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => handleExport('tth', 'excel')}
                  disabled={exporting}
                  type="button"
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: '#16a34a',
                    fontSize: '0.72rem',
                    cursor: exporting ? 'not-allowed' : 'pointer',
                    fontFamily: 'DM Mono',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span aria-hidden="true">📊</span> Excel
                </button>
                <button
                  onClick={() => handleExport('tth', 'pdf')}
                  disabled={exporting}
                  type="button"
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: '#dc2626',
                    fontSize: '0.72rem',
                    cursor: exporting ? 'not-allowed' : 'pointer',
                    fontFamily: 'DM Mono',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span aria-hidden="true">📄</span> PDF
                </button>
              </div>
            )}
          </div>
        </div>

        {timeToHireLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: '2px solid var(--border)',
              borderTop: '2px solid var(--accent)',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 12px',
            }} />
            Завантаження Time-to-Hire...
          </div>
        ) : !timeToHire || timeToHire.total_offers === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }} aria-hidden="true">⏱</div>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Немає даних про Time-to-Hire</div>
            <div style={{ fontSize: '0.78rem' }}>
              Потрібен хоча б 1 кандидат зі статусом "Оффер" та історією змін
            </div>
          </div>
        ) : (
          <div style={{ padding: isMobile ? '16px' : '24px' }}>
            {/* ── Key Metrics ── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              gap: isMobile ? '10px' : '16px',
              marginBottom: '24px',
            }}>
              {[
                {
                  value: `${timeToHire.overall_avg}`,
                  unit: 'дн',
                  label: 'Середній час',
                  color: getSpeedColor(timeToHire.overall_avg),
                  sub: `медіана: ${timeToHire.median} дн`
                },
                {
                  value: timeToHire.total_offers,
                  unit: '',
                  label: 'Всього офферів',
                  color: '#2563eb',
                  sub: null
                },
                ...(timeToHire.by_vacancy.length > 0 ? [{
                  value: `${Math.min(...timeToHire.by_vacancy.map(v => v.avg_days))}`,
                  unit: 'дн',
                  label: 'Найшвидша вакансія',
                  color: '#16a34a',
                  sub: timeToHire.by_vacancy[0]?.vacancy_title
                }] : []),
                ...(timeToHire.by_vacancy.length > 0 ? [{
                  value: `${Math.max(...timeToHire.by_vacancy.map(v => v.avg_days))}`,
                  unit: 'дн',
                  label: 'Найповільніша',
                  color: '#dc2626',
                  sub: timeToHire.by_vacancy[timeToHire.by_vacancy.length - 1]?.vacancy_title
                }] : []),
              ].map((s, i) => (
                <div key={i} style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: isMobile ? '14px' : '20px',
                  textAlign: 'center',
                  borderTop: `3px solid ${s.color}`,
                }}>
                  <div style={{ fontSize: isMobile ? '1.4rem' : '1.8rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>
                    {s.value}
                    {s.unit && <span style={{ fontSize: '0.7em', marginLeft: '2px' }}>{s.unit}</span>}
                  </div>
                  <div style={{ fontSize: isMobile ? '0.7rem' : '0.78rem', color: 'var(--muted)', marginTop: '6px' }}>
                    {s.label}
                  </div>
                  {s.sub && (
                    <div style={{
                      fontSize: '0.68rem',
                      color: 'var(--muted)',
                      fontFamily: 'DM Mono',
                      marginTop: '4px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {s.sub}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* ── By Vacancy ── */}
            {timeToHire.by_vacancy.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  fontFamily: 'DM Mono',
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  color: 'var(--muted)',
                  marginBottom: '14px',
                }}>
                  По вакансіях
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {timeToHire.by_vacancy.map(v => {
                    const maxAvg = Math.max(...timeToHire.by_vacancy.map(x => x.avg_days), 1);
                    const width = (v.avg_days / maxAvg * 100);
                    const color = getSpeedColor(v.avg_days);
                    return (
                      <div key={v.vacancy_id}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '6px',
                          flexWrap: 'wrap',
                          gap: '4px',
                        }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 500, wordBreak: 'break-word', flex: 1 }}>
                            {v.vacancy_title}
                          </span>
                          <span style={{ fontFamily: 'DM Mono', fontSize: '0.78rem', color: 'var(--muted)', flexShrink: 0 }}>
                            <strong style={{ color: 'var(--text)' }}>{v.avg_days}</strong> дн · {v.offers_count} офф.
                          </span>
                        </div>
                        <div style={{ height: '10px', background: 'var(--surface2)', borderRadius: '5px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            borderRadius: '5px',
                            background: color,
                            width: `${width}%`,
                            transition: 'width 0.5s ease',
                          }} />
                        </div>
                        <div style={{
                          display: 'flex',
                          gap: '12px',
                          marginTop: '4px',
                          fontSize: '0.68rem',
                          color: 'var(--muted)',
                          fontFamily: 'DM Mono',
                        }}>
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

            {/* ── Distribution & Trend Grid ── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: '20px',
              marginBottom: '24px',
            }}>
              {/* Distribution */}
              <div>
                <div style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  fontFamily: 'DM Mono',
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  color: 'var(--muted)',
                  marginBottom: '14px',
                }}>
                  Розподіл по швидкості
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {timeToHire.distribution.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '90px',
                        fontSize: '0.78rem',
                        color: 'var(--text)',
                        fontFamily: 'DM Mono',
                        flexShrink: 0,
                      }}>
                        {d.range}
                      </div>
                      <div style={{ flex: 1, height: '8px', background: 'var(--surface2)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          borderRadius: '4px',
                          background: distributionColors[i],
                          width: `${d.percentage}%`,
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                      <div style={{
                        width: '70px',
                        textAlign: 'right',
                        fontSize: '0.78rem',
                        fontFamily: 'DM Mono',
                        color: 'var(--muted)',
                        flexShrink: 0,
                      }}>
                        {d.count} <span style={{ opacity: 0.6 }}>({d.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trend */}
              {timeToHire.trend.length > 1 && (
                <div>
                  <div style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    fontFamily: 'DM Mono',
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    color: 'var(--muted)',
                    marginBottom: '14px',
                  }}>
                    Тренд (накопичувальний)
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '3px',
                    height: '140px',
                    padding: '10px',
                    background: 'var(--bg)',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                  }}>
                    {timeToHire.trend.map((t, i) => {
                      const maxVal = Math.max(...timeToHire.trend.map(x => x.cumulative_avg), 1);
                      const height = (t.cumulative_avg / maxVal * 100);
                      return (
                        <div key={i} style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          minWidth: 0,
                        }}>
                          <div style={{
                            fontSize: '0.58rem',
                            fontFamily: 'DM Mono',
                            color: 'var(--muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            width: '100%',
                            textAlign: 'center',
                          }}>
                            {t.period}
                          </div>
                          <div style={{
                            width: '100%',
                            maxWidth: '28px',
                            height: `${Math.max(height, 4)}%`,
                            minHeight: '4px',
                            background: 'var(--accent)',
                            borderRadius: '3px 3px 0 0',
                            transition: 'height 0.5s ease',
                            position: 'relative',
                          }}>
                            <div style={{
                              position: 'absolute',
                              bottom: '100%',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              fontSize: '0.58rem',
                              fontFamily: 'DM Mono',
                              color: 'var(--text)',
                              whiteSpace: 'nowrap',
                              marginBottom: '2px',
                            }}>
                              {t.cumulative_avg}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── Period Table ── */}
            {timeToHire.by_period.length > 0 && (
              <div>
                <div style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  fontFamily: 'DM Mono',
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  color: 'var(--muted)',
                  marginBottom: '14px',
                }}>
                  Деталізація по {timeToHirePeriod === 'day' ? 'днях' :
                    timeToHirePeriod === 'week' ? 'тижнях' :
                    timeToHirePeriod === 'month' ? 'місяцях' :
                    timeToHirePeriod === 'quarter' ? 'кварталах' : 'роках'}
                </div>
                <div style={{
                  background: 'var(--bg)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                  overflowX: 'auto',
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: '400px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontFamily: 'DM Mono', fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600 }}>Період</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'DM Mono', fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600 }}>Середній час</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'DM Mono', fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600 }}>Офферів</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'DM Mono', fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600 }}>Оцінка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeToHire.by_period.map((p, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 14px', fontFamily: 'DM Mono', fontSize: '0.8rem' }}>{p.period}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>
                            <span style={{ color: getSpeedColor(p.avg_days) }}>
                              {p.avg_days} дн
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'DM Mono' }}>
                            {p.offers_count}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span style={{
                              fontSize: '0.68rem',
                              padding: '3px 10px',
                              borderRadius: '10px',
                              fontFamily: 'DM Mono',
                              fontWeight: 600,
                              background: getSpeedBg(p.avg_days),
                              color: getSpeedText(p.avg_days),
                            }}>
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
        )}
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

      {/* ═══════════════════════════════════════════════════════════
          HR EFFECTIVENESS SECTION
          ═══════════════════════════════════════════════════════════ */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', marginTop: '20px' }}>
        <div style={{
          padding: isMobile ? '14px 16px' : '16px 20px',
          borderBottom: '1px solid var(--border)',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span aria-hidden="true">👤</span>
            Ефективність HR
            {hrEffectiveness && hrEffectiveness.summary.total_hr > 0 && (
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 400,
                color: 'var(--muted)',
                fontFamily: 'DM Mono',
              }}>
                · {hrEffectiveness.summary.total_hr} HR · {hrEffectiveness.summary.overall_conversion}% конверсія
              </span>
            )}
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Кнопки експорту HR Effectiveness */}
            {hrEffectiveness && hrEffectiveness.hr_managers.length > 0 && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => handleExport('hr', 'excel')}
                  disabled={exporting}
                  type="button"
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: '#16a34a',
                    fontSize: '0.72rem',
                    cursor: exporting ? 'not-allowed' : 'pointer',
                    fontFamily: 'DM Mono',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span aria-hidden="true">📊</span> Excel
                </button>
                <button
                  onClick={() => handleExport('hr', 'pdf')}
                  disabled={exporting}
                  type="button"
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: '#dc2626',
                    fontSize: '0.72rem',
                    cursor: exporting ? 'not-allowed' : 'pointer',
                    fontFamily: 'DM Mono',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span aria-hidden="true">📄</span> PDF
                </button>
              </div>
            )}
          </div>
        </div>

        {hrEffectivenessLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: '2px solid var(--border)',
              borderTop: '2px solid var(--accent)',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 12px',
            }} />
            Завантаження статистики HR...
          </div>
        ) : !hrEffectiveness || hrEffectiveness.hr_managers.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }} aria-hidden="true">👤</div>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Немає даних про ефективність HR</div>
            <div style={{ fontSize: '0.78rem' }}>
              Призначте кандидатів HR-менеджерам для відображення статистики
            </div>
          </div>
        ) : (
          <div style={{ padding: isMobile ? '16px' : '24px' }}>
            {/* Summary Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              gap: isMobile ? '10px' : '16px',
              marginBottom: '24px',
            }}>
              {[
                {
                  value: hrEffectiveness.summary.total_hr,
                  unit: '',
                  label: 'HR-менеджерів',
                  color: '#2563eb',
                  sub: null
                },
                {
                  value: hrEffectiveness.summary.total_candidates,
                  unit: '',
                  label: 'Всього кандидатів',
                  color: '#7a1a2e',
                  sub: null
                },
                {
                  value: `${hrEffectiveness.summary.overall_conversion}`,
                  unit: '%',
                  label: 'Загальна конверсія',
                  color: '#16a34a',
                  sub: `${hrEffectiveness.summary.total_offers} офферів`
                },
                {
                  value: `${Math.max(...hrEffectiveness.hr_managers.map(h => h.conversion_rate))}`,
                  unit: '%',
                  label: 'Найкраща конверсія',
                  color: '#eab308',
                  sub: hrEffectiveness.hr_managers[0]?.hr_name
                },
              ].map((s, i) => (
                <div key={i} style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: isMobile ? '14px' : '20px',
                  textAlign: 'center',
                  borderTop: `3px solid ${s.color}`,
                }}>
                  <div style={{ fontSize: isMobile ? '1.4rem' : '1.8rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>
                    {s.value}
                    {s.unit && <span style={{ fontSize: '0.7em', marginLeft: '2px' }}>{s.unit}</span>}
                  </div>
                  <div style={{ fontSize: isMobile ? '0.7rem' : '0.78rem', color: 'var(--muted)', marginTop: '6px' }}>
                    {s.label}
                  </div>
                  {s.sub && (
                    <div style={{
                      fontSize: '0.68rem',
                      color: 'var(--muted)',
                      fontFamily: 'DM Mono',
                      marginTop: '4px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {s.sub}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* HR Managers Table */}
            <div style={{
              background: 'var(--bg)',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              overflow: 'hidden',
              overflowX: 'auto',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: '700px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontFamily: 'DM Mono', fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600 }}>HR Менеджер</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'DM Mono', fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600 }}>Кандидатів</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'DM Mono', fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600 }}>Офферів</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'DM Mono', fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600 }}>Співбесід</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'DM Mono', fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600 }}>Відмов</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'DM Mono', fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600 }}>Конверсія</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'DM Mono', fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600 }}>Активних</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'DM Mono', fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600 }}>Time-to-Hire</th>
                  </tr>
                </thead>
                <tbody>
                  {hrEffectiveness.hr_managers.map((hr, i) => (
                    <tr key={hr.hr_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: `hsl(${(hr.hr_id * 137) % 360}, 60%, 45%)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}>
                            {hr.hr_name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{hr.hr_name}</div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
                              @{hr.hr_username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'DM Mono', fontWeight: 600 }}>
                        {hr.total_candidates}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{ color: '#16a34a', fontWeight: 600, fontFamily: 'DM Mono' }}>
                          {hr.offers_count}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'DM Mono' }}>
                        {hr.interviews_count}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'DM Mono', color: 'var(--muted)' }}>
                        {hr.rejected_count}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <span style={{
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: hr.conversion_rate >= 20 ? '#16a34a' : hr.conversion_rate >= 10 ? '#eab308' : '#dc2626',
                          }}>
                            {hr.conversion_rate}%
                          </span>
                          <div style={{ width: '40px', height: '4px', background: 'var(--surface2)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${Math.min(hr.conversion_rate, 100)}%`,
                              background: hr.conversion_rate >= 20 ? '#16a34a' : hr.conversion_rate >= 10 ? '#eab308' : '#dc2626',
                              borderRadius: '2px',
                            }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'DM Mono' }}>
                        {hr.active_candidates}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'DM Mono', color: 'var(--muted)' }}>
                        {hr.time_to_hire_avg ? `${hr.time_to_hire_avg} дн` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Status Distribution Bars */}
            <div style={{ marginTop: '24px' }}>
              <div style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                fontFamily: 'DM Mono',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                color: 'var(--muted)',
                marginBottom: '14px',
              }}>
                Розподіл по статусах
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {hrEffectiveness.hr_managers.map(hr => {
                  const maxTotal = Math.max(...hrEffectiveness.hr_managers.map(h => h.total_candidates), 1);
                  const barWidth = (hr.total_candidates / maxTotal * 100);

                  return (
                    <div key={hr.hr_id}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                        flexWrap: 'wrap',
                        gap: '4px',
                      }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>{hr.hr_name}</span>
                        <span style={{ fontFamily: 'DM Mono', fontSize: '0.78rem', color: 'var(--muted)' }}>
                          <strong style={{ color: 'var(--text)' }}>{hr.total_candidates}</strong> канд. · {hr.conversion_rate}% конв.
                        </span>
                      </div>
                      <div style={{ height: '24px', background: 'var(--surface2)', borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
                        {hr.by_status.new > 0 && (
                          <div style={{
                            height: '100%',
                            width: `${hr.by_status.new / hr.total_candidates * barWidth}%`,
                            background: '#7a1a2e',
                            minWidth: hr.by_status.new > 0 ? '2px' : '0',
                          }} title={`Нові: ${hr.by_status.new}`} />
                        )}
                        {hr.by_status.screening > 0 && (
                          <div style={{
                            height: '100%',
                            width: `${hr.by_status.screening / hr.total_candidates * barWidth}%`,
                            background: '#b03050',
                            minWidth: hr.by_status.screening > 0 ? '2px' : '0',
                          }} title={`Скринінг: ${hr.by_status.screening}`} />
                        )}
                        {hr.by_status.interview > 0 && (
                          <div style={{
                            height: '100%',
                            width: `${hr.by_status.interview / hr.total_candidates * barWidth}%`,
                            background: '#8a3a5a',
                            minWidth: hr.by_status.interview > 0 ? '2px' : '0',
                          }} title={`Співбесіда: ${hr.by_status.interview}`} />
                        )}
                        {hr.by_status.offer > 0 && (
                          <div style={{
                            height: '100%',
                            width: `${hr.by_status.offer / hr.total_candidates * barWidth}%`,
                            background: '#16a34a',
                            minWidth: hr.by_status.offer > 0 ? '2px' : '0',
                          }} title={`Оффер: ${hr.by_status.offer}`} />
                        )}
                        {hr.by_status.rejected > 0 && (
                          <div style={{
                            height: '100%',
                            width: `${hr.by_status.rejected / hr.total_candidates * barWidth}%`,
                            background: '#aaaaaa',
                            minWidth: hr.by_status.rejected > 0 ? '2px' : '0',
                          }} title={`Відмова: ${hr.by_status.rejected}`} />
                        )}
                      </div>
                      <div style={{
                        display: 'flex',
                        gap: '12px',
                        marginTop: '4px',
                        fontSize: '0.68rem',
                        color: 'var(--muted)',
                        fontFamily: 'DM Mono',
                        flexWrap: 'wrap',
                      }}>
                        <span style={{ color: '#7a1a2e' }}>● нові: {hr.by_status.new}</span>
                        <span style={{ color: '#b03050' }}>● скринінг: {hr.by_status.screening}</span>
                        <span style={{ color: '#8a3a5a' }}>● співбесіда: {hr.by_status.interview}</span>
                        <span style={{ color: '#16a34a' }}>● оффер: {hr.by_status.offer}</span>
                        <span style={{ color: '#aaaaaa' }}>● відмова: {hr.by_status.rejected}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default Analytics;