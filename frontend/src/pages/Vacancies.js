// Vacancies.js
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axiosConfig';
import AddVacancyModal from '../components/AddVacancyModal';
import Loader from '../components/Loader';
import CandidateCardModal from '../components/CandidateCardModal';
import VacancyAccessModal from '../components/VacancyAccessModal';
import JobBoardSelector from '../components/JobBoardSelector';

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
  const [isMobile, setIsMobile] = useState(false);
  const [vacancyLimit, setVacancyLimit] = useState({ current: 0, max: 10 });
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [accessModalVacancy, setAccessModalVacancy] = useState(null);
  const [jobBoardVacancy, setJobBoardVacancy] = useState(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [vacRes, candRes, meRes] = await Promise.all([
        axios.get('/api/vacancies/'),
        axios.get('/api/candidates/'),
        axios.get('/api/me/')
      ]);
      const vacsData = vacRes.data.results ?? vacRes.data;
      const candsData = candRes.data.results ?? candRes.data;
      setVacancies(vacsData);
      setCandidates(candsData);
      const maxVacancies = meRes.data.organization?.max_vacancies || 10;
      setVacancyLimit({ current: vacsData.length, max: maxVacancies });
      
      // Перевірка ролі - така сама, як в Sidebar
      const role = meRes.data.role;
      setIsAdmin(role === 'admin');
      setUserRole(role);
    } catch (err) {
      console.error('Помилка завантаження:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, updateKey]);

  const isLimitReached = vacancyLimit.current >= vacancyLimit.max;

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
    setSelectedVacancy(vacancy);
    setEditModalVacancy(vacancy);
    setViewMode('detail');
  };

  const handleEdit = (e, vacancy) => {
    e.preventDefault();
    e.stopPropagation();
    setEditModalVacancy(vacancy);
    setShowEditModal(true);
  };

  const handleToggleStatus = async (e, vacancy) => {
    e.preventDefault();
    e.stopPropagation();

    const newStatus = !vacancy.is_active;
    const originalStatus = vacancy.is_active;

    setVacancies(prev => prev.map(v =>
      v.id === vacancy.id ? { ...v, is_active: newStatus } : v
    ));

    if (selectedVacancy && selectedVacancy.id === vacancy.id) {
      setSelectedVacancy(prev => ({ ...prev, is_active: newStatus }));
    }

    try {
      await axios.patch(`/api/vacancies/${vacancy.id}/`, {
        is_active: newStatus
      });
      setUpdateKey(k => k + 1);
    } catch (err) {
      console.error('Помилка оновлення статусу:', err);
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

  if (loading && vacancies.length === 0) return <Loader />;

  if (viewMode === 'detail' && selectedVacancy) {
    const stats = getVacancyStats(selectedVacancy.id);
    const vacancyCandidates = candidates.filter(c => c.vacancy === selectedVacancy.id);

    return (
      <div style={{ padding: isMobile ? '8px' : '0' }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          marginBottom: '16px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border)',
          flexDirection: isMobile ? 'column' : 'row',
        }}>
          <button
            onClick={handleBackAndRefresh}
            style={{
              padding: isMobile ? '10px 16px' : '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
            }}
          >
            <span aria-hidden="true">←</span> Назад до вакансій
          </button>
          <div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, wordBreak: 'break-word' }}>{selectedVacancy.title}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
              {selectedVacancy.department}
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          padding: '12px 16px',
          background: 'var(--bg)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          flexWrap: 'wrap',
        }}>
          <button
            onClick={() => {
              if (selectedVacancy) {
                setEditModalVacancy(selectedVacancy);
                setShowEditModal(true);
              }
            }}
            aria-label={`Редагувати вакансію ${selectedVacancy?.title}`}
            type="button"
            style={{
              padding: isMobile ? '10px 14px' : '8px 16px',
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
            <span aria-hidden="true">✏️</span> Редагувати
          </button>
          {isAdmin && (
            <button
              onClick={() => setAccessModalVacancy(selectedVacancy)}
              type="button"
              style={{
                padding: isMobile ? '10px 14px' : '8px 16px',
                borderRadius: '8px', border: '1px solid var(--border)',
                background: 'var(--surface)', color: 'var(--text)',
                cursor: 'pointer', fontSize: '0.82rem',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              <span aria-hidden="true">🔑</span> Доступ
            </button>
          )}
          <button
            onClick={() => setJobBoardVacancy(selectedVacancy)}
            type="button"
            style={{
              padding: isMobile ? '10px 14px' : '8px 16px',
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
            <span aria-hidden="true">📢</span> Job Boards
            {(() => {
              const boards = ['published_rabota_ua','published_work_ua','published_dou','published_linkedin'];
              const count = boards.filter(f => selectedVacancy?.[f]).length;
              return count > 0 ? (
                <span style={{
                  background: '#16a34a', color: '#fff',
                  borderRadius: '10px', fontSize: '0.65rem',
                  padding: '1px 6px', fontFamily: 'DM Mono', fontWeight: 700,
                }}>{count}</span>
              ) : null;
            })()}
          </button>
          <button
            onClick={(e) => handleToggleStatus(e, selectedVacancy)}
            aria-label={selectedVacancy?.is_active ? `Закрити вакансію ${selectedVacancy?.title}` : `Відкрити вакансію ${selectedVacancy?.title}`}
            type="button"
            style={{
              padding: isMobile ? '10px 14px' : '8px 16px',
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
            <span aria-hidden="true">{selectedVacancy?.is_active ? '⏸' : '▶'}</span>
            {selectedVacancy?.is_active ? 'Закрити вакансію' : 'Відкрити вакансію'}
          </button>
          <button
            onClick={(e) => handleDelete(e, selectedVacancy)}
            aria-label={`Видалити вакансію ${selectedVacancy?.title}`}
            type="button"
            style={{
              padding: isMobile ? '10px 14px' : '8px 16px',
              borderRadius: '8px',
              border: '1px solid #fee2e2',
              background: '#fee2e2',
              color: '#dc2626',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600,
              marginLeft: isMobile ? '0' : 'auto',
            }}
          >
            <span aria-hidden="true">🗑</span> Видалити
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: isMobile ? '10px' : '16px',
          marginBottom: '24px',
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
              padding: isMobile ? '14px' : '20px',
              borderTop: `3px solid ${s.color}`,
            }}>
              <div style={{ fontSize: s.isText ? (isMobile ? '1rem' : '1.2rem') : (isMobile ? '1.6rem' : '2rem'), fontWeight: 700, lineHeight: 1, color: s.isText ? s.color : 'var(--text)' }}>
                {s.value}
              </div>
              <div style={{ fontSize: isMobile ? '0.7rem' : '0.78rem', color: 'var(--muted)', marginTop: '6px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {(selectedVacancy.description || selectedVacancy.requirements || selectedVacancy.city || selectedVacancy.employment_type) && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            marginBottom: '16px',
          }}>
            <div style={{
              padding: isMobile ? '14px 16px' : '16px 20px',
              borderBottom: '1px solid var(--border)',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}>
              Опис посади
            </div>
            <div style={{ padding: isMobile ? '16px' : '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {(userRole === 'admin' || userRole === 'superadmin') && (selectedVacancy.salary_min || selectedVacancy.salary_max) && (
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: '8px' }}>
                    Зарплатна вилка
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>
                    {selectedVacancy.salary_min && selectedVacancy.salary_max
                      ? `${selectedVacancy.salary_min.toLocaleString()} — ${selectedVacancy.salary_max.toLocaleString()} грн`
                      : selectedVacancy.salary_min
                        ? `від ${selectedVacancy.salary_min.toLocaleString()} грн`
                        : `до ${selectedVacancy.salary_max.toLocaleString()} грн`
                    }
                  </div>
                </div>
              )}
              {(selectedVacancy.city || selectedVacancy.employment_type) && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedVacancy.city && (
                    <span style={{
                      fontSize: '0.75rem',
                      fontFamily: 'DM Mono',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                    }}>
                      📍 {selectedVacancy.city}
                    </span>
                  )}
                  {selectedVacancy.employment_type && (
                    <span style={{
                      fontSize: '0.75rem',
                      fontFamily: 'DM Mono',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                    }}>
                      {{
                        full_time: '⏱ Повна зайнятість',
                        part_time: '⏱ Часткова зайнятість',
                        volunteer: '🤝 Волонтерство',
                        contract: '📄 Контракт',
                      }[selectedVacancy.employment_type] || selectedVacancy.employment_type}
                    </span>
                  )}
                </div>
              )}

              {selectedVacancy.description && (
                <div>
                  <div style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    fontFamily: 'DM Mono',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--muted)',
                    marginBottom: '8px',
                  }}>
                    Опис
                  </div>
                  <div style={{
                    fontSize: '0.88rem',
                    lineHeight: 1.6,
                    color: 'var(--text)',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {selectedVacancy.description}
                  </div>
                </div>
              )}

              {selectedVacancy.requirements && (
                <div>
                  <div style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    fontFamily: 'DM Mono',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--muted)',
                    marginBottom: '8px',
                  }}>
                    Вимоги
                  </div>
                  <div style={{
                    fontSize: '0.88rem',
                    lineHeight: 1.6,
                    color: 'var(--text)',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {selectedVacancy.requirements}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
          <div style={{ padding: isMobile ? '14px 16px' : '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Кандидати на вакансію</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
              {stats.total} кандидатів
            </span>
          </div>

          {vacancyCandidates.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '12px' }} aria-hidden="true">👤</div>
              <div>Поки немає кандидатів на цю вакансію</div>
              <div style={{ fontSize: '0.78rem', marginTop: '8px' }}>Додайте кандидата з головного меню</div>
            </div>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {vacancyCandidates.map((c, i) => (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedCandidateId(c.id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCandidateId(c.id); }}}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: isMobile ? '10px 16px' : '12px 20px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: isMobile ? '32px' : '36px',
                    height: isMobile ? '32px' : '36px',
                    borderRadius: '8px',
                    background: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    flexShrink: 0,
                  }}>
                    {c.first_name?.[0]}{c.last_name?.[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', wordBreak: 'break-word' }}>
                      {c.first_name} {c.last_name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'DM Mono', wordBreak: 'break-word' }}>
                      {c.email}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.66rem',
                    fontFamily: 'DM Mono',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    flexShrink: 0,
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
            onUpdated={() => setUpdateKey(k => k + 1)}
          />
        )}

        {accessModalVacancy && (
          <VacancyAccessModal
            vacancy={accessModalVacancy}
            onClose={() => setAccessModalVacancy(null)}
          />
        )}

        {selectedCandidateId && (
          <CandidateCardModal
            candidateId={selectedCandidateId}
            onClose={() => setSelectedCandidateId(null)}
            onStatusChange={(id, status) => {
              setCandidates(prev => prev.map(c =>
                c.id === id ? { ...c, status } : c
              ));
              setUpdateKey(k => k + 1);
            }}
            onDelete={(id) => {
              setCandidates(prev => prev.filter(c => c.id !== id));
              setSelectedCandidateId(null);
              setUpdateKey(k => k + 1);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? '8px' : '0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
            Всього: {vacancyLimit.current} / {vacancyLimit.max} вакансій
          </div>
          {isLimitReached && (
            <span style={{
              fontSize: '0.72rem',
              color: '#dc2626',
              background: '#fee2e2',
              padding: '2px 8px',
              borderRadius: '4px',
              fontFamily: 'DM Mono',
              fontWeight: 600
            }}>
              <span aria-hidden="true">⚠</span> Ліміт досягнуто
            </span>
          )}
        </div>
        
        {/* Кнопка додавання вакансії - доступна лише адміністраторам */}
        {isAdmin ? (
          <button
            onClick={() => setShowModal(true)}
            disabled={isLimitReached}
            style={{
              padding: isMobile ? '10px 16px' : '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: isLimitReached ? '#e5e7eb' : 'var(--accent)',
              color: isLimitReached ? '#9ca3af' : '#fff',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: isLimitReached ? 'not-allowed' : 'pointer',
              fontFamily: 'DM Sans',
              transition: 'all 0.15s',
            }}
            title={isLimitReached ? `Ліміт ${vacancyLimit.max} вакансій досягнуто` : ''}
          >
            <span aria-hidden="true">{isLimitReached ? '⛔' : '+'}</span> {isLimitReached ? 'Ліміт досягнуто' : 'Нова вакансія'}
          </button>
        ) : (
          <div style={{
            padding: isMobile ? '10px 16px' : '8px 16px',
            borderRadius: '8px',
            background: '#f3f4f6',
            color: '#6b7280',
            fontSize: '0.75rem',
            fontFamily: 'DM Mono',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span aria-hidden="true">🔒</span> Тільки для адміністраторів
          </div>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
        gap: isMobile ? '12px' : '16px',
      }}>
        {vacancies.map((v, i) => {
          const stats = getVacancyStats(v.id);

          return (
            <div
              key={v.id}
              onClick={() => handleVacancyClick(v)}
              role="button"
              tabIndex={0}
              aria-label={`Вакансія ${v.title}, ${v.department}, ${v.is_active ? 'Активна' : 'Закрита'}`}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleVacancyClick(v); }}}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: isMobile ? '16px' : '20px',
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
                  aria-label={`Редагувати вакансію ${v.title}`}
                  type="button"
                  style={{
                    padding: isMobile ? '8px 12px' : '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    zIndex: 10,
                    position: 'relative',
                  }}
                >
                  <span aria-hidden="true">✏️</span>
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setJobBoardVacancy(v); }}
                  aria-label={`Job Boards для ${v.title}`}
                  type="button"
                  title="Публікація на Job Boards"
                  style={{
                    padding: isMobile ? '8px 12px' : '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    zIndex: 10,
                    position: 'relative',
                  }}
                >
                  <span aria-hidden="true">📢</span>
                </button>
                <button
                  onClick={(e) => handleDelete(e, v)}
                  aria-label={`Видалити вакансію ${v.title}`}
                  type="button"
                  style={{
                    padding: isMobile ? '8px 12px' : '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #fee2e2',
                    background: '#fee2e2',
                    color: '#dc2626',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    zIndex: 10,
                    position: 'relative',
                  }}
                >
                  <span aria-hidden="true">🗑</span>
                </button>
              </div>

              <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px', paddingRight: '70px', wordBreak: 'break-word' }}>
                {v.title}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '14px', fontFamily: 'DM Mono', wordBreak: 'break-word' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
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
                  {/* Індикатори job boards */}
                  {[
                    { field: 'published_rabota_ua', label: 'R', title: 'Rabota.ua', color: '#0066cc' },
                    { field: 'published_work_ua',   label: 'W', title: 'Work.ua',   color: '#e65c00' },
                    { field: 'published_dou',        label: 'D', title: 'DOU',       color: '#1a56db' },
                    { field: 'published_linkedin',   label: 'in', title: 'LinkedIn', color: '#0a66c2' },
                  ].filter(b => v[b.field]).map(b => (
                    <span key={b.field} title={b.title} style={{
                      fontSize: '0.58rem', fontWeight: 700, fontFamily: 'DM Mono',
                      padding: '2px 5px', borderRadius: '3px',
                      background: b.color + '18', color: b.color,
                      border: `1px solid ${b.color}44`,
                    }}>{b.label}</span>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--muted)', flexWrap: 'wrap' }}>
                  {v.owner_name ? (
                    <>
                      <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 700, color: '#fff' }}>
                        {v.owner_name[0]?.toUpperCase()}
                      </div>
                      <span>{v.owner_name}</span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--muted)', fontFamily: 'DM Mono', fontSize: '0.7rem' }}>Без відповідального</span>
                  )}
                  {isAdmin && (
                    <button
                      onClick={e => { e.stopPropagation(); setAccessModalVacancy(v); }}
                      title="Керувати доступом"
                      type="button"
                      style={{
                        marginLeft: '4px', padding: '2px 8px', borderRadius: '5px',
                        border: '1px solid var(--border)', background: 'var(--surface)',
                        cursor: 'pointer', fontSize: '0.68rem', fontFamily: 'DM Mono', color: 'var(--muted)',
                      }}
                    >
                      🔑 Доступ
                    </button>
                  )}
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
          vacancyLimit={vacancyLimit}
          isLimitReached={isLimitReached}
        />
      )}

      {showEditModal && editModalVacancy && (
        <EditVacancyModal
          vacancy={editModalVacancy}
          onClose={() => {
            setShowEditModal(false);
            setEditModalVacancy(null);
          }}
          onUpdated={() => setUpdateKey(k => k + 1)}
        />
      )}

      {accessModalVacancy && (
        <VacancyAccessModal
          vacancy={accessModalVacancy}
          onClose={() => setAccessModalVacancy(null)}
        />
      )}

      {jobBoardVacancy && (
        <JobBoardSelector
          vacancy={jobBoardVacancy}
          onClose={() => setJobBoardVacancy(null)}
          onUpdated={() => setUpdateKey(k => k + 1)}
        />
      )}
    </div>
  );
}

function EditVacancyModal({ vacancy, onClose, onUpdated }) {
  const [form, setForm] = useState({
    title: vacancy?.title || '',
    department: vacancy?.department || '',
    description: vacancy?.description || '',
    requirements: vacancy?.requirements || '',
    city: vacancy?.city || '',
    employment_type: vacancy?.employment_type || 'volunteer',
    is_active: vacancy?.is_active !== false,
  });
  const [saving, setSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (vacancy) {
      setForm({
        title: vacancy.title || '',
        department: vacancy.department || '',
        description: vacancy.description || '',
        requirements: vacancy.requirements || '',
        city: vacancy.city || '',
        employment_type: vacancy.employment_type || 'volunteer',
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
      await axios.patch(`/api/vacancies/${vacancy.id}/`, form);
      onUpdated();
      onClose();
    } catch (err) {
      console.error('Помилка оновлення:', err);
      alert('Помилка збереження');
    } finally {
      setSaving(false);
    }
  };

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    padding: isMobile ? '16px' : '0',
  };
  const modal = {
    background: 'var(--surface)', borderRadius: '16px',
    width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow-lg)', zIndex: 1001,
    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
  };
  const input = {
    width: '100%', padding: isMobile ? '11px 14px' : '9px 12px', border: '1px solid var(--border)',
    borderRadius: '8px', fontSize: isMobile ? '0.9rem' : '0.85rem', fontFamily: 'DM Sans',
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
          <button
            onClick={onClose}
            aria-label="Закрити модальне вікно"
            type="button"
            style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--muted)' }}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
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
          <div>
            <label style={label}>Місто</label>
            <input
              style={input}
              name="city"
              value={form.city}
              placeholder="Київ / Remote"
              onChange={handleChange}
            />
          </div>
          <div>
            <label style={label}>Тип зайнятості</label>
            <select
              style={{ ...input, cursor: 'pointer' }}
              name="employment_type"
              value={form.employment_type}
              onChange={handleChange}
            >
              <option value="full_time">Повна зайнятість</option>
              <option value="part_time">Часткова зайнятість</option>
              <option value="volunteer">Волонтерство</option>
              <option value="contract">Контракт</option>
            </select>
          </div>
          <div>
            <label style={label}>Опис вакансії</label>
            <textarea
              style={{ ...input, minHeight: '100px', resize: 'vertical' }}
              name="description"
              value={form.description}
              placeholder="Розкажіть про роль, команду, задачі..."
              onChange={handleChange}
            />
          </div>
          <div>
            <label style={label}>Вимоги</label>
            <textarea
              style={{ ...input, minHeight: '100px', resize: 'vertical' }}
              name="requirements"
              value={form.requirements}
              placeholder="Навички, досвід, освіта..."
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
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <label htmlFor="is_active_edit" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
              Активна вакансія
            </label>
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={onClose} style={{ padding: isMobile ? '10px 16px' : '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '0.82rem' }}>
            Скасувати
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              padding: isMobile ? '10px 16px' : '8px 16px',
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