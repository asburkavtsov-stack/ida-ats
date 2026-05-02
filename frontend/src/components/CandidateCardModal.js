import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { KANBAN_COLUMNS, getStatusLabel, getStatusBg, getStatusText } from '../constants/statusColors';

const formatDate = (dateString) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const formatDateShort = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
};

function CandidateCardModal({ candidateId, onClose, onStatusChange, onDelete }) {
  const [candidate, setCandidate] = useState(null);
  const [vacancy, setVacancy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [vacancies, setVacancies] = useState([]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!candidateId) return;
    setLoading(true);
    setError('');

    Promise.all([
      axios.get(`/api/candidates/${candidateId}/`),
      axios.get('/api/vacancies/'),
    ])
      .then(([candRes, vacsRes]) => {
        const cand = candRes.data;
        setCandidate(cand);
        setEditForm({
          first_name: cand.first_name || '',
          last_name: cand.last_name || '',
          email: cand.email || '',
          phone: cand.phone || '',
          vacancy: cand.vacancy || '',
          status: cand.status || 'new',
          notes: cand.notes || '',
        });

        const vacs = vacsRes.data.results ?? vacsRes.data;
        setVacancies(vacs);
        const matched = vacs.find(v => v.id === cand.vacancy);
        setVacancy(matched || null);
      })
      .catch(err => {
        console.error('Помилка завантаження кандидата:', err);
        setError('Не вдалося завантажити дані кандидата');
      })
      .finally(() => setLoading(false));
  }, [candidateId]);

  const handleStatusUpdate = (newStatus) => {
    if (!candidate || newStatus === candidate.status) return;

    setSaving(true);
    axios.patch(`/api/candidates/${candidateId}/update_status/`, { status: newStatus })
      .then(res => {
        const updated = res.data;
        setCandidate(updated);
        setEditForm(prev => ({ ...prev, status: newStatus }));
        if (onStatusChange) onStatusChange(candidateId, newStatus);
      })
      .catch(err => {
        console.error('Помилка оновлення статусу:', err);
        setError('Не вдалося оновити статус');
      })
      .finally(() => setSaving(false));
  };

  const handleSaveEdit = () => {
    setSaving(true);
    axios.patch(`/api/candidates/${candidateId}/`, editForm)
      .then(res => {
        const updated = res.data;
        setCandidate(updated);
        setEditMode(false);

        const matched = vacancies.find(v => v.id === updated.vacancy);
        setVacancy(matched || null);
      })
      .catch(err => {
        console.error('Помилка збереження:', err);
        setError('Не вдалося зберегти зміни');
      })
      .finally(() => setSaving(false));
  };

  const handleDelete = () => {
    setSaving(true);
    axios.delete(`/api/candidates/${candidateId}/`)
      .then(() => {
        if (onDelete) onDelete(candidateId);
        onClose();
      })
      .catch(err => {
        console.error('Помилка видалення:', err);
        setError('Не вдалося видалити кандидата');
        setSaving(false);
      });
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const inputStyle = {
    width: '100%',
    padding: isMobile ? '11px 14px' : '9px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: isMobile ? '0.9rem' : '0.85rem',
    fontFamily: 'DM Sans',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.72rem',
    fontWeight: 600,
    fontFamily: 'DM Mono',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '6px',
    color: 'var(--muted)',
  };

  const initials = candidate
    ? `${candidate.first_name?.[0] || ''}${candidate.last_name?.[0] || ''}`.toUpperCase()
    : '';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: isMobile ? '0' : '20px',
      }}
      onClick={handleBackdropClick}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: isMobile ? '16px 16px 0 0' : '16px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: isMobile ? '90vh' : '85vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="candidate-card-title"
      >
        {/* Header */}
        <div style={{
          padding: isMobile ? '16px 20px' : '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          position: 'sticky',
          top: 0,
          background: 'var(--surface)',
          zIndex: 10,
          borderRadius: isMobile ? '16px 16px 0 0' : '16px 16px 0 0',
        }}>
          {loading ? (
            <div style={{
              width: '44px', height: '44px', borderRadius: '10px',
              background: 'var(--surface2)', flexShrink: 0,
            }} />
          ) : (
            <div style={{
              width: '44px', height: '44px', borderRadius: '10px',
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: '0.95rem',
              flexShrink: 0,
            }}>
              {initials}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            {loading ? (
              <>
                <div style={{ height: '20px', width: '60%', background: 'var(--surface2)', borderRadius: '4px', marginBottom: '6px' }} />
                <div style={{ height: '14px', width: '40%', background: 'var(--surface2)', borderRadius: '4px' }} />
              </>
            ) : (
              <>
                <div id="candidate-card-title" style={{ fontWeight: 700, fontSize: '1rem', wordBreak: 'break-word' }}>
                  {candidate?.first_name} {candidate?.last_name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '2px' }}>
                  ID: {candidate?.id} · Додано {formatDateShort(candidate?.created_at)}
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            {!loading && (
              <button
                onClick={() => setEditMode(!editMode)}
                aria-label={editMode ? 'Скасувати редагування' : 'Редагувати кандидата'}
                type="button"
                style={{
                  padding: isMobile ? '7px 10px' : '6px 10px',
                  borderRadius: '7px',
                  border: '1px solid var(--border)',
                  background: editMode ? 'var(--accent)' : 'transparent',
                  color: editMode ? '#fff' : 'var(--text)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontFamily: 'DM Mono',
                }}
              >
                <span aria-hidden="true">{editMode ? '✕' : '✏️'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Закрити картку кандидата"
              type="button"
              style={{
                padding: isMobile ? '7px 10px' : '6px 10px',
                borderRadius: '7px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontFamily: 'DM Mono',
              }}
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: isMobile ? '16px 20px' : '20px 24px', flex: 1 }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i}>
                  <div style={{ height: '12px', width: '80px', background: 'var(--surface2)', borderRadius: '4px', marginBottom: '8px' }} />
                  <div style={{ height: '40px', background: 'var(--surface2)', borderRadius: '8px' }} />
                </div>
              ))}
            </div>
          ) : error ? (
            <div style={{ color: '#dc2626', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>
              ⚠ {error}
            </div>
          ) : editMode ? (
            /* Edit Mode */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Ім'я</label>
                  <input
                    style={inputStyle}
                    value={editForm.first_name}
                    onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Прізвище</label>
                  <input
                    style={inputStyle}
                    value={editForm.last_name}
                    onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Email</label>
                <input
                  style={inputStyle}
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>

              <div>
                <label style={labelStyle}>Телефон</label>
                <input
                  style={inputStyle}
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+380 XX XXX XX XX"
                />
              </div>

              <div>
                <label style={labelStyle}>Вакансія</label>
                <select
                  style={inputStyle}
                  value={editForm.vacancy}
                  onChange={e => setEditForm(f => ({ ...f, vacancy: e.target.value }))}
                >
                  <option value="">— Без вакансії —</option>
                  {vacancies.map(v => (
                    <option key={v.id} value={v.id}>{v.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Статус</label>
                <select
                  style={inputStyle}
                  value={editForm.status}
                  onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                >
                  {KANBAN_COLUMNS.map(col => (
                    <option key={col.key} value={col.key}>{col.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Нотатки</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Коментарі про кандидата..."
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setEditMode(false)}
                  style={{
                    padding: isMobile ? '10px 16px' : '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    fontFamily: 'DM Sans',
                    fontSize: '0.82rem',
                  }}
                >
                  Скасувати
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  style={{
                    padding: isMobile ? '10px 18px' : '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--accent)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontFamily: 'DM Sans',
                    fontSize: '0.82rem',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Збереження...' : 'Зберегти зміни'}
                </button>
              </div>
            </div>
          ) : (
            /* Info View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Status Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '0.75rem',
                  fontFamily: 'DM Mono',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  background: getStatusBg(candidate.status),
                  color: getStatusText(candidate.status),
                  fontWeight: 600,
                }}>
                  {getStatusLabel(candidate.status)}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
                  {formatDate(candidate.created_at)}
                </span>
              </div>

              {/* Contact Info */}
              <div>
                <div style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  fontFamily: 'DM Mono',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--muted)',
                  marginBottom: '12px',
                }}>
                  Контактна інформація
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    background: 'var(--bg)',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                  }}>
                    <span aria-hidden="true" style={{ fontSize: '1rem' }}>✉️</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>Email</div>
                      <div style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>{candidate.email}</div>
                    </div>
                    <a
                      href={`mailto:${candidate.email}`}
                      aria-label={`Написати листа на ${candidate.email}`}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        textDecoration: 'none',
                        fontFamily: 'DM Mono',
                        flexShrink: 0,
                      }}
                    >
                      Написати
                    </a>
                  </div>

                  {candidate.phone && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      background: 'var(--bg)',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                    }}>
                      <span aria-hidden="true" style={{ fontSize: '1rem' }}>📞</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>Телефон</div>
                        <div style={{ fontSize: '0.85rem' }}>{candidate.phone}</div>
                      </div>
                      <a
                        href={`tel:${candidate.phone}`}
                        aria-label={`Подзвонити на ${candidate.phone}`}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          background: 'var(--surface)',
                          color: 'var(--text)',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          textDecoration: 'none',
                          fontFamily: 'DM Mono',
                          flexShrink: 0,
                        }}
                      >
                        Подзвонити
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Vacancy Info */}
              <div>
                <div style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  fontFamily: 'DM Mono',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--muted)',
                  marginBottom: '12px',
                }}>
                  Вакансія
                </div>
                <div style={{
                  padding: '14px',
                  background: 'var(--bg)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <span aria-hidden="true" style={{ fontSize: '1.2rem' }}>💼</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      {vacancy?.title || '—'}
                    </div>
                    {vacancy?.department && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '2px' }}>
                        {vacancy.department}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {candidate.notes && (
                <div>
                  <div style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    fontFamily: 'DM Mono',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--muted)',
                    marginBottom: '12px',
                  }}>
                    Нотатки
                  </div>
                  <div style={{
                    padding: '14px',
                    background: 'var(--bg)',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '0.85rem',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {candidate.notes}
                  </div>
                </div>
              )}

              {/* Quick Status Change */}
              <div>
                <div style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  fontFamily: 'DM Mono',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--muted)',
                  marginBottom: '12px',
                }}>
                  Швидка зміна статусу
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {KANBAN_COLUMNS.map(col => (
                    <button
                      key={col.key}
                      onClick={() => handleStatusUpdate(col.key)}
                      disabled={candidate.status === col.key || saving}
                      aria-label={`Змінити статус на ${col.label}`}
                      aria-pressed={candidate.status === col.key}
                      type="button"
                      style={{
                        padding: '8px 14px',
                        borderRadius: '20px',
                        border: `1px solid ${candidate.status === col.key ? col.color : 'var(--border)'}`,
                        background: candidate.status === col.key ? col.color : 'var(--surface)',
                        color: candidate.status === col.key ? '#fff' : 'var(--text)',
                        fontSize: '0.78rem',
                        fontWeight: 500,
                        cursor: candidate.status === col.key || saving ? 'not-allowed' : 'pointer',
                        fontFamily: 'DM Sans',
                        opacity: candidate.status === col.key ? 1 : saving ? 0.6 : 1,
                        transition: 'all 0.15s',
                      }}
                    >
                      {col.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!loading && !editMode && (
          <div style={{
            padding: isMobile ? '14px 20px' : '16px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: '10px',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            position: 'sticky',
            bottom: 0,
            background: 'var(--surface)',
            borderRadius: isMobile ? '0' : '0 0 16px 16px',
          }}>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              aria-label="Видалити кандидата"
              type="button"
              style={{
                padding: isMobile ? '9px 14px' : '7px 14px',
                borderRadius: '8px',
                border: '1px solid #fee2e2',
                background: 'transparent',
                color: '#dc2626',
                fontSize: '0.78rem',
                cursor: 'pointer',
                fontFamily: 'DM Sans',
                fontWeight: 500,
              }}
            >
              <span aria-hidden="true">🗑</span> Видалити
            </button>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <a
                href={`mailto:${candidate.email}`}
                style={{
                  padding: isMobile ? '9px 14px' : '7px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  fontFamily: 'DM Sans',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span aria-hidden="true">✉️</span> Email
              </a>
              {candidate.phone && (
                <a
                  href={`tel:${candidate.phone}`}
                  style={{
                    padding: isMobile ? '9px 14px' : '7px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    fontFamily: 'DM Sans',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span aria-hidden="true">📞</span> Дзвінок
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '16px',
          }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '16px',
              padding: isMobile ? '20px' : '28px',
              width: '100%',
              maxWidth: '360px',
              border: '1px solid var(--border)',
              textAlign: 'center',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '10px' }}>
              Видалити кандидата?
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '24px' }}>
              <strong>{candidate?.first_name} {candidate?.last_name}</strong> буде видалено назавжди.
              Цю дію неможливо скасувати.
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: isMobile ? '10px 16px' : '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontFamily: 'DM Sans',
                }}
              >
                Скасувати
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                style={{
                  padding: isMobile ? '10px 18px' : '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontFamily: 'DM Sans',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Видалення...' : 'Видалити'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CandidateCardModal;