import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AddVacancyModal from '../components/AddVacancyModal';

/*const statusConfig = {
  active: { label: 'Активна',    bg: '#f9eaed', text: '#7a1a2e' },
  final:  { label: 'Фінал',      bg: '#fff3e0', text: '#c94f2a' },
  paused: { label: 'Призупинена',bg: '#f5f5f5', text: '#757575' },
};*/

function Vacancies() {
  const [vacancies, setVacancies] = useState([]);
  const [showModal, setShowModal] = useState(false);

  const loadVacancies = () => {
    axios.get('/api/vacancies/')
      .then(res => setVacancies(res.data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    loadVacancies();
  }, []);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button onClick={() => setShowModal(true)} style={{
          padding: '8px 16px', borderRadius: '8px', border: 'none',
          background: 'var(--accent)', color: '#fff', fontSize: '0.82rem',
          fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans',
        }}>
          + Нова вакансія
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {vacancies.map((v, i) => (
          <div key={i} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '20px', cursor: 'pointer',
            boxShadow: 'var(--shadow)', transition: 'all 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px' }}>{v.title}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '14px', fontFamily: 'DM Mono' }}>{v.department}</div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                <strong style={{ color: 'var(--text)' }}>{}</strong> заявок
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                <strong style={{ color: 'var(--text)' }}>{}</strong> співбесід
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
            <span style={{
              fontSize: '0.7rem', fontFamily: 'DM Mono', padding: '3px 8px', borderRadius: '4px',
              background: v.is_active ? '#f9eaed' : '#f5f5f5',
              color: v.is_active ? '#7a1a2e' : '#757575',
            }}>
              {v.is_active ? 'Активна' : 'Закрита'}
            </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--muted)' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 700, color: '#fff' }}>
                  АБ
                </div>
                Артем Б.
              </div>
            </div>
          </div>
        ))}
      </div>
      {showModal && (
      <AddVacancyModal
        onClose={() => setShowModal(false)}
        onAdded={loadVacancies}
      />
    )}
    </div>
  );
}

export default Vacancies;