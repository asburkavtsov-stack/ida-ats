import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import AddVacancyModal from '../components/AddVacancyModal';
import Loader from '../components/Loader';

function Vacancies() {
  const [vacancies, setVacancies] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedVacancy, setSelectedVacancy] = useState(null);
  const [editModalVacancy, setEditModalVacancy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [updateKey, setUpdateKey] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [vacRes, candRes] = await Promise.all([
        axios.get('/api/vacancies/'),
        axios.get('/api/candidates/')
      ]);
      setVacancies(vacRes.data);
      setCandidates(candRes.data);
    } catch (err) {
      console.error('Помилка завантаження:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, updateKey]);

  const getVacancyStats = (vacancyId) => {
    const vacancyCandidates = candidates.filter(c => c.vacancy === vacancyId);
    return {
      total: vacancyCandidates.length,
      interviews: vacancyCandidates.filter(c => 
        ['interview', 'offer'].includes(c.status)
      ).length,
      new: vacancyCandidates.filter(c => c.status === 'new').length,
    };
  };

  const handleVacancyClick = (vacancy) => {
    console.log('Opening vacancy:', vacancy);
    setSelectedVacancy(vacancy);
    setEditModalVacancy(vacancy);
    setViewMode('detail');
  };

  const handleEdit = (e, vacancy) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Edit clicked:', vacancy);
    setEditModalVacancy(vacancy);
    setShowEditModal(true);
  };

  const handleToggleStatus = async (e, vacancy) => {
    e.preventDefault();
    e.stopPropagation();
    
    const newStatus = !vacancy.is_active;
    const originalStatus = vacancy.is_active;
    
    // Оптимістичне оновлення
    setVacancies(prev => prev.map(v => 
      v.id === vacancy.id ? { ...v, is_active: newStatus } : v
    ));
    
    if (selectedVacancy && selectedVacancy.id === vacancy.id) {
      setSelectedVacancy(prev => ({ ...prev, is_active: newStatus }));
    }
    
    try {
      const response = await axios.patch(`/api/vacancies/${vacancy.id}/`, {
        is_active: newStatus
      });
      // 🔧 ОНОВЛЕНО: Якщо API повертає дані, використовуємо їх
      if (response.data) {
        setVacancies(prev => prev.map(v => 
          v.id === vacancy.id ? response.data : v
        ));
        if (selectedVacancy && selectedVacancy.id === vacancy.id) {
          setSelectedVacancy(response.data);
        }
      }
    } catch (err) {
      console.error('Помилка оновлення статусу:', err);
      // Rollback
      setVacancies(prev => prev.map(v => 
        v.id === vacancy.id ? { ...v, is_active: originalStatus } : v
      ));
      if (selectedVacancy && selectedVacancy.id === vacancy.id) {
        setSelectedVacancy(prev => ({ ...prev, is_active: originalStatus }));
      }
      alert('Помилка оновлення статусу');
    }
  };

  const handleDelete = async (e, vacancy) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!window.confirm(`Видалити вакансію "${vacancy.title}"?`)) return;
    
    try {
      await axios.delete(`/api/vacancies/${vacancy.id}/`);
      setUpdateKey(k => k + 1);
    } catch (err) {
      console.error('Помилка видалення:', err);
      alert('Помилка видалення вакансії');
    }
  };

  const handleBack = () => {
    setViewMode('grid');
    setSelectedVacancy(null);
    setEditModalVacancy(null);
  };

  const handleBackAndRefresh = () => {
    handleBack();
    setUpdateKey(k => k + 1);
  };

  // 🔧 НОВА ФУНКЦІЯ: Оновлення вакансії після редагування
  const handleVacancyUpdated = (updatedVacancy) => {
    console.log('Vacancy updated:', updatedVacancy);
    setUpdateKey(k => k + 1);
    
    // Оновлюємо в списку
    setVacancies(prev => prev.map(v => 
      v.id === updatedVacancy.id ? updatedVacancy : v
    ));
    
    // 🔧 КЛЮЧОВЕ: Оновлюємо selectedVacancy якщо в детальному view
    if (selectedVacancy && selectedVacancy.id === updatedVacancy.id) {
      setSelectedVacancy(updatedVacancy);
    }
    
    // Очищаємо стан модалки
    setShowEditModal(false);
    setEditModalVacancy(null);
  };

  if (loading && vacancies.length === 0) return <Loader />;

  if (viewMode === 'detail' && selectedVacancy) {
    const stats = getVacancyStats(selectedVacancy.id);
    const vacancyCandidates = candidates.filter(c => c.vacancy === selectedVacancy.id);

    return (
      <div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '16px', 
          marginBottom: '16px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border)'
        }}>
          <button 
            onClick={handleBackAndRefresh}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ← Назад до вакансій
          </button>
          <div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{selectedVacancy.title}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
              {selectedVacancy.department}
            </div>
          </div>
        </div>

        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          marginBottom: '24px',
          padding: '12px 16px',
          background: 'var(--bg)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
        }}>
          <button 
            onClick={() => {
              console.log('Edit in detail, selectedVacancy:', selectedVacancy);
              if (selectedVacancy) {
                setEditModalVacancy(selectedVacancy);
                setShowEditModal(true);
              }
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ✏️ Редагувати
          </button>
          <button 
            onClick={(e) => handleToggleStatus(e, selectedVacancy)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: selectedVacancy?.is_active ? '#fee2e2' : '#dcfce7',
              color: selectedVacancy?.is_active ? '#dc2626' : '#16a34a',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {selectedVacancy?.is_active ? '⏸ Закрити вакансію' : '▶ Відкрити вакансію'}
          </button>
          <button 
            onClick={(e) => handleDelete(e, selectedVacancy)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #fee2e2',
              background: '#fee2e2',
              color: '#dc2626',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600,
              marginLeft: 'auto',
            }}
          >
            🗑 Видалити
          </button>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: '16px', 
          marginBottom: '24px' 
        }}>
          {[
            { value: stats.total, label: 'Всього заявок', color: '#7a1a2e' },
            { value: stats.interviews, label: 'На співбесіді', color: '#b03050' },
            { value: stats.new, label: 'Нових', color: '#8a3a5a' },
            { value: selectedVacancy?.is_active ? 'Активна' : 'Закрита', label: 'Статус', color: selectedVacancy?.is_active ? '#16a34a' : '#757575', isText: true },
          ].map((s, i) => (
            <div key={i} style={{
              background: 'var(--surface)', 
              border: '1px solid var(--border)',
              borderRadius: '12px', 
              padding: '20px', 
              borderTop: `3px solid ${s.color}`,
            }}>
              <div style={{ fontSize: s.isText ? '1.2rem' : '2rem', fontWeight: 700, lineHeight: 1, color: s.isText ? s.color : 'var(--text)' }}>
                {s.value}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '6px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Кандидати на вакансію</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
              {stats.total} кандидатів
            </span>
          </div>
          
          {vacancyCandidates.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '12px' }}>👤</div>
              <div>Поки немає кандидатів на цю вакансію</div>
              <div style={{ fontSize: '0.78rem', marginTop: '8px' }}>Додайте кандидата з головного меню</div>
            </div>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {vacancyCandidates.map((c, i) => (
                <div key={i} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  padding: '12px 20px',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ 
                    width: '36px', 
                    height: '36px', 
                    borderRadius: '8px', 
                    background: 'var(--accent)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                  }}>
                    {c.first_name?.[0]}{c.last_name?.[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      {c.first_name} {c.last_name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
                      {c.email}
                    </div>
                  </div>
                  <span style={{ 
                    fontSize: '0.66rem', 
                    fontFamily: 'DM Mono', 
                    padding: '3px 8px', 
                    borderRadius: '4px', 
                    background: c.status === 'new' ? '#f9eaed' : 
                                c.status === 'screening' ? '#fff3e0' :
                                c.status === 'interview' ? '#f5eaf0' :
                                c.status === 'offer' ? '#fce4ec' : '#f5f5f5',
                    color: c.status === 'new' ? '#7a1a2e' : 
                           c.status === 'screening' ? '#c94f2a' :
                           c.status === 'interview' ? '#8a3a5a' :
                           c.status === 'offer' ? '#c2185b' : '#757575',
                  }}>
                    {c.status === 'new' ? 'Новий' :
                     c.status === 'screening' ? 'Скринінг' :
                     c.status === 'interview' ? 'Співбесіда' :
                     c.status === 'offer' ? 'Оффер' : 'Відмова'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {showEditModal && editModalVacancy && (
          <EditVacancyModal
            vacancy={editModalVacancy}
            onClose={() => {
              setShowEditModal(false);
              setEditModalVacancy(null);
            }}
            onUpdated={handleVacancyUpdated} // 🔧 ВИКОРИСТОВУЄМО НОВУ ФУНКЦІЮ
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
          Всього: {vacancies.length} вакансій
        </div>
        <button onClick={() => setShowModal(true)} style={{
          padding: '8px 16px', borderRadius: '8px', border: 'none',
          background: 'var(--accent)', color: '#fff', fontSize: '0.82rem',
          fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans',
        }}>
          + Нова вакансія
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {vacancies.map((v, i) => {
          const stats = getVacancyStats(v.id);
          
          return (
            <div 
              key={v.id}
              onClick={() => handleVacancyClick(v)}
              style={{
                background: 'var(--surface)', 
                border: '1px solid var(--border)',
                borderRadius: '12px', 
                padding: '20px', 
                cursor: 'pointer',
                boxShadow: 'var(--shadow)', 
                transition: 'all 0.15s',
                position: 'relative',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow)';
              }}
            >
              <div 
                style={{ 
                  position: 'absolute', 
                  top: '12px', 
                  right: '12px',
                  display: 'flex',
                  gap: '6px',
                  zIndex: 5,
                }}
                onClick={e => e.stopPropagation()}
              >
                <button 
                  onClick={(e) => handleEdit(e, v)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    zIndex: 10,
                    position: 'relative',
                  }}
                  type="button"
                >
                  ✏️
                </button>
                <button 
                  onClick={(e) => handleDelete(e, v)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #fee2e2',
                    background: '#fee2e2',
                    color: '#dc2626',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    zIndex: 10,
                    position: 'relative',
                  }}
                  type="button"
                >
                  🗑
                </button>
              </div>

              <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px', paddingRight: '70px' }}>
                {v.title}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '14px', fontFamily: 'DM Mono' }}>
                {v.department}
              </div>

              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                  <strong style={{ color: 'var(--text)', fontFamily: 'DM Mono' }}>{stats.total}</strong> заявок
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                  <strong style={{ color: 'var(--text)', fontFamily: 'DM Mono' }}>{stats.interviews}</strong> співбесід
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                <span style={{
                  fontSize: '0.7rem', 
                  fontFamily: 'DM Mono', 
                  padding: '3px 8px', 
                  borderRadius: '4px',
                  background: v.is_active ? '#f9eaed' : '#f5f5f5',
                  color: v.is_active ? '#7a1a2e' : '#757575',
                }}>
                  {v.is_active ? 'Активна' : 'Закрита'}
                </span>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--muted)' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 700, color: '#fff' }}>
                    HR
                  </div>
                  HR Manager
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <AddVacancyModal
          onClose={() => setShowModal(false)}
          onAdded={() => setUpdateKey(k => k + 1)}
        />
      )}

      {showEditModal && editModalVacancy && (
        <EditVacancyModal
          vacancy={editModalVacancy}
          onClose={() => {
            setShowEditModal(false);
            setEditModalVacancy(null);
          }}
          onUpdated={handleVacancyUpdated} // 🔧 ВИКОРИСТОВУЄМО НОВУ ФУНКЦІЮ
        />
      )}
    </div>
  );
}

function EditVacancyModal({ vacancy, onClose, onUpdated }) {
  const [form, setForm] = useState({
    title: vacancy?.title || '',
    department: vacancy?.department || '',
    is_active: vacancy?.is_active !== false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (vacancy) {
      setForm({
        title: vacancy.title || '',
        department: vacancy.department || '',
        is_active: vacancy.is_active !== false,
      });
    }
  }, [vacancy]);

  const handleChange = e => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm({ ...form, [e.target.name]: value });
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    
    setSaving(true);
    try {
      const response = await axios.patch(`/api/vacancies/${vacancy.id}/`, form);
      // 🔧 ОНОВЛЕНО: Передаємо оновлені дані назад
      onUpdated(response.data);
    } catch (err) {
      console.error('Помилка оновлення:', err);
      alert('Помилка збереження');
      setSaving(false);
    }
  };

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  };
  const modal = {
    background: 'var(--surface)', borderRadius: '16px',
    width: '440px', boxShadow: 'var(--shadow-lg)', zIndex: 1001,
  };
  const input = {
    width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
    borderRadius: '8px', fontSize: '0.85rem', fontFamily: 'DM Sans',
    background: 'var(--bg)', outline: 'none',
  };
  const label = {
    display: 'block', fontSize: '0.72rem', fontWeight: 600,
    fontFamily: 'DM Mono', textTransform: 'uppercase',
    letterSpacing: '0.5px', marginBottom: '6px',
  };

  if (!vacancy) return null;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>Редагувати вакансію</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={label}>Назва вакансії</label>
            <input 
              style={input} 
              name="title" 
              value={form.title}
              placeholder="Python Developer" 
              onChange={handleChange} 
            />
          </div>
          <div>
            <label style={label}>Відділ</label>
            <input 
              style={input} 
              name="department" 
              value={form.department}
              placeholder="Engineering · Remote" 
              onChange={handleChange} 
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input 
              type="checkbox" 
              name="is_active" 
              checked={form.is_active} 
              onChange={handleChange} 
              id="is_active_edit" 
              style={{ width: '16px', height: '16px', cursor: 'pointer' }} 
            />
            <label htmlFor="is_active_edit" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
              Активна вакансія
            </label>
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '0.82rem' }}>
            Скасувати
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={saving}
            style={{ 
              padding: '8px 16px', 
              borderRadius: '8px', 
              border: 'none', 
              background: 'var(--accent)', 
              color: '#fff', 
              cursor: saving ? 'not-allowed' : 'pointer', 
              fontSize: '0.82rem', 
              fontWeight: 600,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Збереження...' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Vacancies;