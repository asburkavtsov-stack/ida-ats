// src/pages/InterviewCalendar.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { interviewsApi } from '../api/interviewsApi';
import InterviewModal from '../components/InterviewModal';

// ── Утиліти ──────────────────────────────────────────────────

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  return `${formatDate(dateStr)} ${formatTime(dateStr)}`;
};

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Понеділок = 0
};

const MONTH_NAMES_UA = [
  'Січень','Лютий','Березень','Квітень','Травень','Червень',
  'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень',
];
const DAY_NAMES_UA = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];

// ── Конфіги статусів ─────────────────────────────────────────

const STATUS_CONFIG = {
  scheduled:   { label: 'Заплановано', color: '#7a1a2e', bg: '#f9eaed' },
  completed:   { label: 'Проведено',   color: '#16a34a', bg: '#dcfce7' },
  cancelled:   { label: 'Скасовано',   color: '#757575', bg: '#f5f5f5' },
  rescheduled: { label: 'Перенесено',  color: '#b45309', bg: '#fff8e1' },
};

const TYPE_CONFIG = {
  online:  { label: 'Онлайн',  icon: '🌐' },
  offline: { label: 'Офлайн', icon: '📍' },
};

// ── Картка інтерв'ю (у списку) ───────────────────────────────

function InterviewCard({ interview, onEdit, onDelete, onStatusChange }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const st = STATUS_CONFIG[interview.status] || STATUS_CONFIG.scheduled;
  const tp = TYPE_CONFIG[interview.interview_type] || TYPE_CONFIG.online;

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderLeft: `3px solid ${st.color}`,
      borderRadius: '10px', padding: '14px 16px',
      position: 'relative', cursor: 'pointer',
      transition: 'box-shadow 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.1)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Верхній рядок */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '4px', wordBreak: 'break-word' }}>
            {interview.title}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
            👤 {interview.candidate_name}
            {interview.vacancy_title && ` · ${interview.vacancy_title}`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <span style={{
            fontSize: '0.68rem', padding: '2px 8px', borderRadius: '20px',
            background: st.bg, color: st.color, fontFamily: 'DM Mono',
            border: `1px solid ${st.color}30`,
          }}>{st.label}</span>
          {/* Меню */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(m => !m); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', fontSize: '1rem', padding: '2px 6px', borderRadius: '6px',
              }}
            >⋯</button>
            {menuOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                  onClick={() => setMenuOpen(false)}
                />
                <div style={{
                  position: 'absolute', right: 0, top: '100%', zIndex: 20,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  minWidth: '160px', overflow: 'hidden',
                }}>
                  <button onClick={() => { onEdit(interview); setMenuOpen(false); }} style={menuItemStyle}>
                    ✏️ Редагувати
                  </button>
                  {['scheduled','completed','cancelled','rescheduled']
                    .filter(s => s !== interview.status)
                    .map(s => (
                      <button key={s} onClick={() => { onStatusChange(interview.id, s); setMenuOpen(false); }} style={menuItemStyle}>
                        → {STATUS_CONFIG[s].label}
                      </button>
                    ))
                  }
                  <button onClick={() => { onDelete(interview.id); setMenuOpen(false); }} style={{ ...menuItemStyle, color: '#dc2626' }}>
                    🗑 Видалити
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Деталі */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '10px',
        marginTop: '10px', fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'DM Mono',
      }}>
        <span>📅 {formatDateTime(interview.scheduled_at)}</span>
        <span>⏱ {interview.duration_minutes} хв</span>
        <span>{tp.icon} {tp.label}</span>
        {interview.interviewers?.length > 0 && (
          <span>👥 {interview.interviewers.map(i => i.full_name || i.username).join(', ')}</span>
        )}
      </div>

      {/* Google links */}
      {(interview.google_calendar_link || interview.google_meet_link) && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
          {interview.google_calendar_link && (
            <a href={interview.google_calendar_link} target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                fontSize: '0.68rem', padding: '3px 10px', borderRadius: '6px',
                background: '#e8f0fe', color: '#1a73e8', textDecoration: 'none',
                fontFamily: 'DM Mono', border: '1px solid #1a73e830',
              }}>
              📅 Google Calendar
            </a>
          )}
          {interview.google_meet_link && (
            <a href={interview.google_meet_link} target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                fontSize: '0.68rem', padding: '3px 10px', borderRadius: '6px',
                background: '#e6f4ea', color: '#137333', textDecoration: 'none',
                fontFamily: 'DM Mono', border: '1px solid #13733330',
              }}>
              📹 Google Meet
            </a>
          )}
        </div>
      )}
    </div>
  );
}

const menuItemStyle = {
  display: 'block', width: '100%', padding: '9px 14px',
  border: 'none', background: 'transparent', textAlign: 'left',
  fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'DM Sans',
  color: 'var(--text)',
};

// ── Міні-календар ────────────────────────────────────────────

function MiniCalendar({ interviews, selectedDate, onSelectDate, currentMonth, onChangeMonth }) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date();

  // Дні з інтерв'ю
  const interviewDays = new Set(
    interviews.map(iv => {
      const d = new Date(iv.scheduled_at);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isSelected = (d) => {
    if (!selectedDate || !d) return false;
    return selectedDate.getFullYear() === year && selectedDate.getMonth() === month && selectedDate.getDate() === d;
  };
  const isToday = (d) => {
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
  };
  const hasInterview = (d) => d && interviewDays.has(`${year}-${month}-${d}`);

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '14px', padding: '16px', userSelect: 'none',
    }}>
      {/* Навігація місяць */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <button onClick={() => onChangeMonth(-1)} style={navBtnStyle}>‹</button>
        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
          {MONTH_NAMES_UA[month]} {year}
        </div>
        <button onClick={() => onChangeMonth(1)} style={navBtnStyle}>›</button>
      </div>

      {/* Дні тижня */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
        {DAY_NAMES_UA.map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: '0.65rem', color: 'var(--muted)',
            fontFamily: 'DM Mono', padding: '4px 0',
          }}>{d}</div>
        ))}
      </div>

      {/* Клітинки */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {cells.map((d, i) => (
          <div
            key={i}
            onClick={() => d && onSelectDate(new Date(year, month, d))}
            style={{
              textAlign: 'center', padding: '6px 2px', borderRadius: '8px',
              fontSize: '0.78rem', cursor: d ? 'pointer' : 'default',
              background: isSelected(d) ? 'var(--accent)' : isToday(d) ? '#7a1a2e15' : 'transparent',
              color: isSelected(d) ? '#fff' : isToday(d) ? 'var(--accent)' : d ? 'var(--text)' : 'transparent',
              fontWeight: isToday(d) || isSelected(d) ? 700 : 400,
              position: 'relative',
              transition: 'background 0.1s',
            }}
          >
            {d}
            {hasInterview(d) && !isSelected(d) && (
              <div style={{
                position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)',
                width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent)',
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Кнопка "Сьогодні" */}
      <button
        onClick={() => { onSelectDate(today); onChangeMonth(0, today); }}
        style={{
          width: '100%', marginTop: '12px', padding: '7px', borderRadius: '8px',
          border: '1px solid var(--border)', background: 'transparent',
          color: 'var(--muted)', fontSize: '0.72rem', cursor: 'pointer',
          fontFamily: 'DM Mono',
        }}
      >Сьогодні</button>
    </div>
  );
}

const navBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--muted)', fontSize: '1.1rem', padding: '4px 8px', borderRadius: '6px',
};

// ── Головна сторінка ─────────────────────────────────────────

function InterviewCalendar() {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [editingInterview, setEditingInterview] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [isMobile, setIsMobile] = useState(false);
  const [showCalendarMobile, setShowCalendarMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const loadInterviews = useCallback(async () => {
    setLoading(true);
    try {
      const data = await interviewsApi.list();
      setInterviews(Array.isArray(data) ? data : data.results ?? []);
    } catch {
      setInterviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadInterviews(); }, [loadInterviews]);

  // Інтерв'ю для вибраної дати
  const dayInterviews = interviews.filter(iv => {
    const d = new Date(iv.scheduled_at);
    const match =
      d.getFullYear() === selectedDate.getFullYear() &&
      d.getMonth() === selectedDate.getMonth() &&
      d.getDate() === selectedDate.getDate();
    if (!match) return false;
    if (filterStatus !== 'all' && iv.status !== filterStatus) return false;
    return true;
  }).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

  // Найближчі (якщо дата не вибрана — заглушка)
  const upcomingInterviews = [...interviews]
    .filter(iv => new Date(iv.scheduled_at) >= new Date() && iv.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
    .slice(0, 5);

  const handleChangeMonth = (dir, targetDate = null) => {
    if (targetDate) {
      setCurrentMonth(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1));
      return;
    }
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + dir, 1));
  };

  const handleEdit = (interview) => {
    setEditingInterview(interview);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Видалити інтерв'ю? Подію буде також видалено з Google Calendar.")) return;
    await interviewsApi.delete(id);
    setInterviews(prev => prev.filter(iv => iv.id !== id));
  };

  const handleStatusChange = async (id, newStatus) => {
    const updated = await interviewsApi.changeStatus(id, newStatus);
    setInterviews(prev => prev.map(iv => iv.id === id ? updated : iv));
  };

  const handleSaved = (savedInterview) => {
    setInterviews(prev => {
      const exists = prev.find(iv => iv.id === savedInterview.id);
      if (exists) return prev.map(iv => iv.id === savedInterview.id ? savedInterview : iv);
      return [savedInterview, ...prev];
    });
    setEditingInterview(null);
    if (!savedInterview.warning) setShowModal(false);
  };

  const openNew = () => {
    setEditingInterview(null);
    setShowModal(true);
  };

  const totalToday = interviews.filter(iv => {
    const d = new Date(iv.scheduled_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  const totalScheduled = interviews.filter(iv => iv.status === 'scheduled').length;

  return (
    <div style={{ padding: isMobile ? '8px' : '0' }}>
      {/* Шапка */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '20px', flexWrap: 'wrap', gap: '10px',
      }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
          {totalScheduled} заплановано · {totalToday} сьогодні
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isMobile && (
            <button onClick={() => setShowCalendarMobile(m => !m)} style={{
              padding: '8px 14px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--muted)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'DM Mono',
            }}>
              {showCalendarMobile ? 'Список' : '📅 Календар'}
            </button>
          )}
          <button onClick={openNew} style={{
            padding: '9px 18px', borderRadius: '8px',
            border: 'none', background: 'var(--accent)', color: '#fff',
            fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans',
          }}>
            + Інтерв'ю
          </button>
        </div>
      </div>

      {/* Фільтр статусів */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[{ value: 'all', label: 'Всі' }, ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))].map(f => (
          <button
            key={f.value}
            onClick={() => setFilterStatus(f.value)}
            style={{
              padding: '5px 14px', borderRadius: '20px', cursor: 'pointer',
              fontSize: '0.75rem', fontFamily: 'DM Mono',
              border: `1px solid ${filterStatus === f.value ? 'var(--accent)' : 'var(--border)'}`,
              background: filterStatus === f.value ? '#7a1a2e15' : 'transparent',
              color: filterStatus === f.value ? 'var(--accent)' : 'var(--muted)',
              transition: 'all 0.15s',
            }}
          >{f.label}</button>
        ))}
      </div>

      {/* Основний layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '280px 1fr',
        gap: '20px',
        alignItems: 'start',
      }}>
        {/* Ліва колонка: міні-календар + найближчі */}
        {(!isMobile || showCalendarMobile) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <MiniCalendar
              interviews={interviews}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              currentMonth={currentMonth}
              onChangeMonth={handleChangeMonth}
            />

            {/* Найближчі інтерв'ю */}
            {upcomingInterviews.length > 0 && (
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '14px', overflow: 'hidden',
              }}>
                <div style={{
                  padding: '12px 16px', borderBottom: '1px solid var(--border)',
                  fontSize: '0.72rem', fontWeight: 600, fontFamily: 'DM Mono',
                  textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted)',
                }}>Найближчі</div>
                {upcomingInterviews.map(iv => (
                  <div
                    key={iv.id}
                    onClick={() => {
                      const d = new Date(iv.scheduled_at);
                      setSelectedDate(d);
                      setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                      if (isMobile) setShowCalendarMobile(false);
                    }}
                    style={{
                      padding: '10px 16px', borderBottom: '1px solid var(--border)',
                      cursor: 'pointer', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '2px' }}>{iv.title}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
                      {formatDateTime(iv.scheduled_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Права колонка: список дня */}
        {(!isMobile || !showCalendarMobile) && (
          <div>
            {/* Заголовок дня */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '16px',
            }}>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 700 }}>
                  {selectedDate.getDate()} {MONTH_NAMES_UA[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
                  {dayInterviews.length} інтерв'ю
                </div>
              </div>
              {/* Стрілки дня */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => {
                    const prev = new Date(selectedDate);
                    prev.setDate(prev.getDate() - 1);
                    setSelectedDate(prev);
                    setCurrentMonth(new Date(prev.getFullYear(), prev.getMonth(), 1));
                  }}
                  style={navBtnStyle}
                >‹</button>
                <button
                  onClick={() => {
                    const next = new Date(selectedDate);
                    next.setDate(next.getDate() + 1);
                    setSelectedDate(next);
                    setCurrentMonth(new Date(next.getFullYear(), next.getMonth(), 1));
                  }}
                  style={navBtnStyle}
                >›</button>
              </div>
            </div>

            {/* Список інтерв'ю дня */}
            {loading ? (
              <div style={{ color: 'var(--muted)', fontFamily: 'DM Mono', fontSize: '0.82rem', padding: '24px 0' }}>
                Завантаження...
              </div>
            ) : dayInterviews.length === 0 ? (
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '12px', padding: '40px 24px',
                textAlign: 'center', color: 'var(--muted)',
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📭</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                  Інтерв'ю не заплановані
                </div>
                <div style={{ fontSize: '0.75rem', fontFamily: 'DM Mono' }}>
                  Натисніть «+ Інтерв'ю» щоб додати
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {dayInterviews.map(iv => (
                  <InterviewCard
                    key={iv.id}
                    interview={iv}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Модал */}
      {showModal && (
        <InterviewModal
          interview={editingInterview}
          onClose={() => { setShowModal(false); setEditingInterview(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

export default InterviewCalendar;