import React, { useState, useEffect } from 'react';
import axios from 'axios';

// 🔧 ДОДАНО: Надійне форматування дати
const formatDate = (dateString) => {
  if (!dateString || dateString === 'Invalid date') return '';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}.${month}.${year}`;
};

function Dashboard() {
  const [stats, setStats] = useState({
    total: 0, active_vacancies: 0, offers: 0, new: 0
  });
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    Promise.all([
      axios.get('/api/candidates/'),
      axios.get('/api/vacancies/')
    ]).then(([candidatesRes, vacanciesRes]) => {
      const candidates = candidatesRes.data;
      const vacancies = vacanciesRes.data;
      setStats({
        total: candidates.length,
        offers: candidates.filter(c => c.status === 'offer').length,
        new: candidates.filter(c => c.status === 'new').length,
        active_vacancies: vacancies.filter(v => v.is_active).length,
      });
      setActivity(candidates.slice(-4).reverse());
    });
  }, []);

  const statusLabels = {
    new: 'Новий', screen: 'Скринінг', inter: 'Співбесіда', offer: 'Оффер', reject: 'Відмова'
  };
  const statusColors = {
    new: 'var(--accent)', screen: '#b03050', inter: '#8a3a5a', offer: '#e8a0b0', reject: 'var(--muted)'
  };

  return (
    <div>
      {/* Статистика */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { value: stats.total,            label: 'Всього кандидатів',    color: '#7a1a2e' },
          { value: stats.active_vacancies, label: 'Активних вакансій',    color: '#b03050' },
          { value: stats.offers,           label: 'Офферів надіслано',    color: '#8a3a5a' },
          { value: stats.new,              label: 'Нових кандидатів',     color: '#e8a0b0' },
        ].map((s, i) => (
          <div key={i} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '20px', borderTop: `3px solid ${s.color}`,
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '6px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Активність */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
          Останні кандидати
        </div>
        {activity.length === 0 && (
          <div style={{ padding: '24px', color: 'var(--muted)', fontSize: '0.82rem', textAlign: 'center' }}>
            Поки немає кандидатів
          </div>
        )}
        {activity.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColors[c.status] || 'var(--muted)', marginTop: '5px', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.8rem' }}>
                <strong>{c.first_name} {c.last_name}</strong> · {c.vacancy_title}
              </div>
              {/* 🔧 ВИПРАВЛЕНО: formatDate замість slice */}
              <div style={{ fontFamily: 'DM Mono', fontSize: '0.65rem', color: 'var(--muted)', marginTop: '2px' }}>
                {statusLabels[c.status]} · {formatDate(c.created_at)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;