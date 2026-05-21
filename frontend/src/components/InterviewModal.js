// src/components/InterviewModal.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { interviewsApi } from '../api/interviewsApi';

const DURATION_OPTIONS = [30, 45, 60, 90, 120];

const STATUS_OPTIONS = [
  { value: 'scheduled',   label: 'Заплановано' },
  { value: 'completed',   label: 'Проведено' },
  { value: 'cancelled',   label: 'Скасовано' },
  { value: 'rescheduled', label: 'Перенесено' },
];

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: '8px',
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'DM Sans',
  outline: 'none', boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block', fontSize: '0.72rem', fontWeight: 600,
  fontFamily: 'DM Mono', textTransform: 'uppercase',
  letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: '6px',
};

function InterviewModal({ interview, candidateId, onClose, onSaved }) {
  const isEdit = !!interview;

  const [form, setForm] = useState({
    title: '',
    candidate: candidateId || '',
    vacancy: '',
    interview_type: 'online',
    status: 'scheduled',
    scheduled_at: '',
    duration_minutes: 60,
    location: '',
    notes: '',
    interviewer_ids: [],
  });

  const [candidates, setCandidates] = useState([]);
  const [vacancies, setVacancies] = useState([]);
  const [hrUsers, setHrUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [googleWarning, setGoogleWarning] = useState('');

  useEffect(() => {
    if (isEdit) {
      setForm({
        title: interview.title || '',
        candidate: interview.candidate || '',
        vacancy: interview.vacancy || '',
        interview_type: interview.interview_type || 'online',
        status: interview.status || 'scheduled',
        scheduled_at: interview.scheduled_at
          ? interview.scheduled_at.slice(0, 16)  // datetime-local format
          : '',
        duration_minutes: interview.duration_minutes || 60,
        location: interview.location || '',
        notes: interview.notes || '',
        interviewer_ids: interview.interviewers?.map(i => i.id) || [],
      });
    }
  }, [interview, isEdit]);

  useEffect(() => {
    Promise.all([
      axios.get('/api/candidates/?page_size=200'),
      axios.get('/api/vacancies/'),
      axios.get('/api/users/'),
    ]).then(([cRes, vRes, uRes]) => {
      setCandidates(cRes.data.results ?? cRes.data);
      setVacancies(vRes.data.results ?? vRes.data);
      setHrUsers(uRes.data.results ?? uRes.data);
    }).catch(() => {});
  }, []);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const toggleInterviewer = (userId) => {
    setForm(f => ({
      ...f,
      interviewer_ids: f.interviewer_ids.includes(userId)
        ? f.interviewer_ids.filter(id => id !== userId)
        : [...f.interviewer_ids, userId],
    }));
  };

  const handleSave = async () => {
    setError('');
    setGoogleWarning('');
    if (!form.title.trim()) { setError("Введіть назву інтерв'ю"); return; }
    if (!form.candidate) { setError('Оберіть кандидата'); return; }
    if (!form.scheduled_at) { setError('Вкажіть дату та час'); return; }

    // Конвертуємо datetime-local → ISO з timezone offset
    const localDate = new Date(form.scheduled_at);
    const payload = {
      ...form,
      scheduled_at: localDate.toISOString(),
    };

    setSaving(true);
    try {
      let result;
      if (isEdit) {
        result = await interviewsApi.update(interview.id, payload);
      } else {
        result = await interviewsApi.create(payload);
      }
      if (result.warning) setGoogleWarning(result.warning);
      onSaved(result);
      if (!result.warning) onClose();
    } catch (e) {
      setError(e.response?.data?.detail || 'Помилка збереження');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncGoogle = async () => {
    if (!interview?.id) return;
    setSaving(true);
    try {
      const result = await interviewsApi.syncGoogle(interview.id);
      onSaved(result);
      setGoogleWarning('');
    } catch {
      setGoogleWarning('Не вдалося синхронізувати');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '16px',
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: '16px',
        border: '1px solid var(--border)',
        width: '100%', maxWidth: '560px',
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>
              {isEdit ? "Редагувати інтерв'ю" : "Нове інтерв'ю"}
            </div>
            {isEdit && interview.google_event_id && (
              <div style={{ fontSize: '0.7rem', color: '#16a34a', fontFamily: 'DM Mono', marginTop: '2px' }}>
                ✓ Синхронізовано з Google Calendar
              </div>
            )}
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: '1.3rem',
            cursor: 'pointer', color: 'var(--muted)', lineHeight: 1,
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px',
              background: '#fce4ec', color: '#c2185b',
              fontSize: '0.78rem', fontFamily: 'DM Mono',
            }}>⚠ {error}</div>
          )}
          {googleWarning && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px',
              background: '#fff8e1', color: '#b45309',
              fontSize: '0.78rem', fontFamily: 'DM Mono',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
            }}>
              <span>⚠ {googleWarning}</span>
              {isEdit && (
                <button onClick={handleSyncGoogle} style={{
                  padding: '4px 10px', borderRadius: '6px', border: '1px solid #b45309',
                  background: 'none', color: '#b45309', fontSize: '0.72rem',
                  cursor: 'pointer', fontFamily: 'DM Mono', whiteSpace: 'nowrap',
                }}>Повторити sync</button>
              )}
            </div>
          )}

          {/* Назва */}
          <div>
            <label style={labelStyle}>Назва інтерв'ю</label>
            <input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Наприклад: Технічна співбесіда — HR Manager"
              style={inputStyle}
            />
          </div>

          {/* Кандидат */}
          {!candidateId && (
            <div>
              <label style={labelStyle}>Кандидат</label>
              <select value={form.candidate} onChange={e => set('candidate', e.target.value)} style={inputStyle}>
                <option value="">— Оберіть кандидата —</option>
                {candidates.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name} — {c.vacancy_title || 'Без вакансії'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Вакансія */}
          <div>
            <label style={labelStyle}>Вакансія</label>
            <select value={form.vacancy} onChange={e => set('vacancy', e.target.value)} style={inputStyle}>
              <option value="">— Вакансія (необов'язково) —</option>
              {vacancies.filter(v => v.is_active).map(v => (
                <option key={v.id} value={v.id}>{v.title}</option>
              ))}
            </select>
          </div>

          {/* Дата + Час */}
          <div>
            <label style={labelStyle}>Дата та час</label>
            <input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={e => set('scheduled_at', e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Тривалість + Тип */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Тривалість</label>
              <select value={form.duration_minutes} onChange={e => set('duration_minutes', Number(e.target.value))} style={inputStyle}>
                {DURATION_OPTIONS.map(d => (
                  <option key={d} value={d}>{d} хв</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Тип</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { value: 'online', label: '🌐 Онлайн' },
                  { value: 'offline', label: '📍 Офлайн' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => set('interview_type', opt.value)}
                    style={{
                      flex: 1, padding: '9px 8px', borderRadius: '8px',
                      border: `1px solid ${form.interview_type === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                      background: form.interview_type === opt.value ? '#7a1a2e15' : 'var(--bg)',
                      color: form.interview_type === opt.value ? 'var(--accent)' : 'var(--muted)',
                      fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'DM Sans',
                      transition: 'all 0.15s',
                    }}
                  >{opt.label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Локація / Посилання */}
          <div>
            <label style={labelStyle}>
              {form.interview_type === 'online' ? 'Посилання на відео (якщо не Google Meet)' : 'Адреса'}
            </label>
            <input
              value={form.location}
              onChange={e => set('location', e.target.value)}
              placeholder={form.interview_type === 'online' ? 'https://zoom.us/...' : 'м. Київ, вул. Хрещатик, 1'}
              style={inputStyle}
            />
            {form.interview_type === 'online' && (
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '4px', fontFamily: 'DM Mono' }}>
                Google Meet буде створено автоматично при синхронізації
              </div>
            )}
          </div>

          {/* Статус (тільки при редагуванні) */}
          {isEdit && (
            <div>
              <label style={labelStyle}>Статус</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} style={inputStyle}>
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Інтерв'юери */}
          {hrUsers.length > 0 && (
            <div>
              <label style={labelStyle}>Інтерв'юери</label>
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '6px',
                padding: '10px', borderRadius: '8px',
                border: '1px solid var(--border)', background: 'var(--bg)',
              }}>
                {hrUsers.map(u => {
                  const selected = form.interviewer_ids.includes(u.id);
                  const initials = u.first_name && u.last_name
                    ? `${u.first_name[0]}${u.last_name[0]}`
                    : u.username.slice(0, 2).toUpperCase();
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleInterviewer(u.id)}
                      title={u.first_name ? `${u.first_name} ${u.last_name}` : u.username}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '4px 10px', borderRadius: '20px',
                        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                        background: selected ? '#7a1a2e15' : 'transparent',
                        color: selected ? 'var(--accent)' : 'var(--muted)',
                        fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'DM Sans',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: selected ? 'var(--accent)' : 'var(--border)',
                        color: selected ? '#fff' : 'var(--muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.6rem', fontWeight: 700, flexShrink: 0,
                      }}>{initials}</span>
                      {u.first_name || u.username}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Нотатки */}
          <div>
            <label style={labelStyle}>Нотатки</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Деталі, питання для співбесіди, особливі вимоги..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', minHeight: '72px' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid var(--border)',
          display: 'flex', gap: '10px', justifyContent: 'flex-end',
        }}>
          <button onClick={onClose} style={{
            padding: '9px 20px', borderRadius: '8px',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text)', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'DM Sans',
          }}>Скасувати</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '9px 20px', borderRadius: '8px',
            border: 'none', background: 'var(--accent)', color: '#fff',
            fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans',
            opacity: saving ? 0.7 : 1,
          }}>
            {saving ? 'Збереження...' : (isEdit ? 'Зберегти' : 'Створити + Google Calendar')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InterviewModal;
