import React, { useState, useEffect } from 'react';
import axios from '../axiosConfig';
import CandidateCardModal from '../components/CandidateCardModal';
import { SOURCE_CONFIG, getSourceLabel, getSourceColor } from '../constants/statusColors';

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
};

function Dashboard() {
  const [stats, setStats] = useState({ total: 0, active_vacancies: 0, offers: 0, new: 0, by_source: [] });
  const [activity, setActivity] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    Promise.all([
      axios.get('/api/candidates/?page_size=100'),
      axios.get('/api/vacancies/')
    ]).then(([candidatesRes, vacanciesRes]) => {
      const candidates = candidatesRes.data.results ?? candidatesRes.data;
      const vacancies = vacanciesRes.data.results ?? vacanciesRes.data;

      // Calculate source distribution
      const bySource = Object.keys(SOURCE_CONFIG).map(key => ({
        key,
        label: SOURCE_CONFIG[key].label,
        count: candidates.filter(c => c.source === key).length,
        color: SOURCE_CONFIG[key].color,
      })).filter(s => s.count > 0).sort((a, b) => b.count - a.count);

      setStats({
        total: candidatesRes.data.count ?? candidates.length,
        offers: candidates.filter(c => c.status === 'offer').length,
        new: candidates.filter(c => c.status === 'new').length,
        active_vacancies: vacancies.filter(v => v.is_active).length,
        by_source: bySource,
      });
      setActivity([...candidates].slice(-4).reverse());
    });
  }, []);

  const statusLabels = {
    new: 'Новий', screening: 'Скринінг', interview: 'Співбесіда', offer: 'Оффер', rejected: 'Відмова'
  };
  const statusColors = {
    new: 'var(--accent)', screening: '#b03050', interview: '#8a3a5a', offer: '#e8a0b0', rejected: 'var(--muted)'
  };

  return (
    <div style={{ padding: isMobile ? '8px' : '0' }}>
      {/* ─── Main Stats ─────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: isMobile ? '10px' : '16px',
        marginBottom: '24px',
      }}>
        {[
          { value: stats.total,            label: 'Всього кандидатів', color: '#7a1a2e' },
          { value: stats.active_vacancies, label: 'Активних вакансій', color: '#b03050' },
          { value: stats.offers,           label: 'Офферів надіслано', color: '#8a3a5a' },
          { value: stats.new,              label: 'Нових кандидатів',  color: '#e8a0b0' },
        ].map((s, i) => (
          <div key={i} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: isMobile ? '14px' : '20px', borderTop: `3px solid ${s.color}`,
          }}>
            <div style={{ fontSize: isMobile ? '1.6rem' : '2rem', fontWeight: 700, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: isMobile ? '0.7rem' : '0.78rem', color: 'var(--muted)', marginTop: '6px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ─── Source Distribution ────────────────────────────── */}
      {stats.by_source.length > 0 && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: isMobile ? '14px 16px' : '16px 20px',
          marginBottom: '24px',
        }}>
          <div style={{
            fontSize: '0.72rem', fontWeight: 600, fontFamily: 'DM Mono',
            textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted)',
            marginBottom: '14px',
          }}>
            Розподіл за джерелами
          </div>
          <div style={{ display: 'flex', gap: isMobile ? '10px' : '16px', flexWrap: 'wrap' }}>
            {stats.by_source.map(s => (
              <div key={s.key} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: isMobile ? '8px 12px' : '10px 14px',
                background: 'var(--bg)', borderRadius: '8px',
                border: '1px solid var(--border)',
              }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: isMobile ? '0.75rem' : '0.82rem', fontFamily: 'DM Mono' }}>
                  <strong style={{ color: 'var(--text)' }}>{s.count}</strong>
                  <span style={{ color: 'var(--muted)', marginLeft: '4px' }}>{s.label}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Recent Candidates ──────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <div style={{ padding: isMobile ? '14px 16px' : '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
          Останні кандидати
        </div>
        {activity.length === 0 && (
          <div style={{ padding: '24px', color: 'var(--muted)', fontSize: '0.82rem', textAlign: 'center' }}>
            Поки немає кандидатів
          </div>
        )}
        {activity.map((c, i) => (
          <div
            key={i}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedCandidateId(c.id)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCandidateId(c.id); }}}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '12px',
              padding: isMobile ? '10px 16px' : '12px 20px',
              borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColors[c.status] || 'var(--muted)', marginTop: '5px', flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.8rem', wordBreak: 'break-word' }}>
                <strong>{c.first_name} {c.last_name}</strong> · {c.vacancy_title}
              </div>
              <div style={{ fontFamily: 'DM Mono', fontSize: '0.65rem', color: 'var(--muted)', marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span>{statusLabels[c.status]}</span>
                <span>·</span>
                <span>{formatDate(c.created_at)}</span>
                {c.source && c.source !== 'other' && (
                  <>
                    <span>·</span>
                    <span style={{ color: getSourceColor(c.source) }}>{getSourceLabel(c.source)}</span>
                  </>
                )}
                {c.tags && c.tags.length > 0 && (
                  <>
                    <span>·</span>
                    <span style={{ display: 'flex', gap: '4px' }}>
                      {c.tags.map(tag => (
                        <span key={tag.id} style={{
                          fontSize: '0.6rem', padding: '1px 4px', borderRadius: '4px',
                          background: tag.color + '20', border: `1px solid ${tag.color}`, color: tag.color
                        }}>
                          {tag.name}
                        </span>
                      ))}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedCandidateId && (
        <CandidateCardModal
          candidateId={selectedCandidateId}
          onClose={() => setSelectedCandidateId(null)}
          onStatusChange={(id, status) => {
            setActivity(prev => prev.map(c =>
              c.id === id ? { ...c, status } : c
            ));
          }}
          onDelete={(id) => {
            setActivity(prev => prev.filter(c => c.id !== id));
            setSelectedCandidateId(null);
          }}
        />
      )}
    </div>
  );
}

export default Dashboard;