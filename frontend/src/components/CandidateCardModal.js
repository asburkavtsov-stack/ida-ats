// CandidateCardModal.js
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axiosConfig';
import { SOURCE_CONFIG, getSourceLabel, getSourceBg, getSourceText, getHrAvatarColor } from '../constants/statusColors';

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

const hex2rgba = (hex, alpha = 0.13) => {
  if (!hex || hex.length < 7) return `rgba(122,26,46,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

function CandidateCardModal({ candidateId, onClose, onStatusChange, onDelete }) {
  const [candidate, setCandidate] = useState(null);
  const [vacancy, setVacancy] = useState(null);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [vacancies, setVacancies] = useState([]);
  const [users, setUsers] = useState([]);

  const [emailTemplates, setEmailTemplates] = useState([]);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [previewEmail, setPreviewEmail] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState('');

  const [emailHistory, setEmailHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [availableTags, setAvailableTags] = useState([]);
  const [candidateTags, setCandidateTags] = useState([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [newTagForm, setNewTagForm] = useState({ name: '', color: '#7a1a2e' });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch initial data
  useEffect(() => {
    if (!candidateId) return;

    axios.get('/api/email-templates/')
      .then(res => setEmailTemplates((res.data.results ?? res.data).filter(t => t.is_active)))
      .catch(() => setEmailError('Не вдалося завантажити шаблони листів'));

    axios.get('/api/tags/')
      .then(res => setAvailableTags(res.data.results ?? res.data))
      .catch(() => {});

    setLoading(true);
    setError('');

    Promise.all([
      axios.get(`/api/candidates/${candidateId}/`),
      axios.get('/api/vacancies/'),
      axios.get('/api/users/'),
    ])
      .then(([candRes, vacsRes, usersRes]) => {
        const usersData = usersRes.data.results ?? usersRes.data;
        setUsers(usersData);
        const cand = candRes.data;
        setCandidate(cand);
        setCandidateTags(cand.tags || []);
        setEditForm({
          first_name: cand.first_name || '',
          last_name: cand.last_name || '',
          email: cand.email || '',
          phone: cand.phone || '',
          vacancy: cand.vacancy != null ? String(cand.vacancy) : '',
          source: cand.source || 'other',
          notes: cand.notes || '',
        });
        const vacs = vacsRes.data.results ?? vacsRes.data;
        setVacancies(vacs);
        setVacancy(vacs.find(v => v.id === cand.vacancy) || null);
      })
      .catch(() => setError('Не вдалося завантажити дані кандидата'))
      .finally(() => setLoading(false));
  }, [candidateId]);

  // Fetch stages when candidate or vacancy changes
  const fetchStages = useCallback(async () => {
    if (!candidate) return;
    const params = candidate.vacancy
      ? { vacancy: candidate.vacancy }
      : { org_template: true };
    try {
      const res = await axios.get('/api/vacancy-stages/', { params });
      setStages(res.data.results ?? res.data);
    } catch (err) {
      // Silent fail
    }
  }, [candidate]);

  useEffect(() => {
    fetchStages();
  }, [fetchStages]);

  const fetchEmailHistory = useCallback(async () => {
    if (!candidateId) return;
    setLoadingHistory(true);
    try {
      const res = await axios.get(`/api/sent-emails/?candidate=${candidateId}`);
      setEmailHistory(res.data.results ?? res.data);
    } catch {
      setEmailError('Не вдалося завантажити історію листів');
    } finally {
      setLoadingHistory(false);
    }
  }, [candidateId]);

  useEffect(() => {
    if (activeTab === 'emails' && candidateId) fetchEmailHistory();
  }, [activeTab, candidateId, fetchEmailHistory]);

  const updateTags = async (tagIds) => {
    setSaving(true);
    try {
      const res = await axios.patch(`/api/candidates/${candidateId}/`, { tag_ids: tagIds });
      setCandidate(res.data);
      setCandidateTags(res.data.tags || []);
    } catch {
      setError('Не вдалося оновити теги');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = async (tagId) => {
    const currentIds = candidateTags.map(t => t.id);
    if (currentIds.includes(tagId)) return;
    await updateTags([...currentIds, tagId]);
  };

  const handleRemoveTag = async (tagId) => {
    await updateTags(candidateTags.map(t => t.id).filter(id => id !== tagId));
  };

  const handleCreateTag = async () => {
    if (!newTagForm.name.trim()) return;
    try {
      const res = await axios.post('/api/tags/', newTagForm);
      setAvailableTags(prev => [...prev, res.data]);
      await handleAddTag(res.data.id);
      setNewTagForm({ name: '', color: '#7a1a2e' });
      setShowTagModal(false);
    } catch {
      setError('Не вдалося створити тег');
    }
  };

  const handleStageUpdate = async (stageId) => {
    const currentStageId = candidate?.stage_id ?? candidate?.stage;
    if (!candidate || currentStageId === stageId) return;
    setSaving(true);
    setError('');
    try {
      const res = await axios.post(`/api/candidates/${candidateId}/update_status/`, { stage_id: stageId });
      const updated = res.data;
      setCandidate(updated);
      if (onStatusChange) onStatusChange(candidateId, stageId);
    } catch (err) {
      console.error('Помилка оновлення етапу:', err);
      setError('Не вдалося оновити етап');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = () => {
    setSaving(true);
    setError('');
    const payload = {
      ...editForm,
      vacancy: editForm.vacancy !== '' ? Number(editForm.vacancy) : null,
    };
    axios.patch(`/api/candidates/${candidateId}/`, payload)
      .then(res => {
        const updated = res.data;
        setCandidate(updated);
        setEditForm({
          first_name: updated.first_name || '',
          last_name: updated.last_name || '',
          email: updated.email || '',
          phone: updated.phone || '',
          vacancy: updated.vacancy != null ? String(updated.vacancy) : '',
          source: updated.source || 'other',
          notes: updated.notes || '',
        });
        setEditMode(false);
        setVacancy(vacancies.find(v => v.id === updated.vacancy) || null);
      })
      .catch(() => setError('Не вдалося зберегти зміни'))
      .finally(() => setSaving(false));
  };

  const handleDelete = () => {
    setSaving(true);
    setError('');
    axios.delete(`/api/candidates/${candidateId}/`)
      .then(() => {
        if (onDelete) onDelete(candidateId);
        onClose();
      })
      .catch(() => {
        setError('Не вдалося видалити кандидата');
        setSaving(false);
      });
  };

  const handleAssign = (userId) => {
    setSaving(true);
    setError('');
    axios.patch(`/api/candidates/${candidateId}/assign/`, { assigned_to: userId ?? null })
      .then(res => setCandidate(res.data))
      .catch(() => setError('Не вдалося призначити HR'))
      .finally(() => setSaving(false));
  };

  const handlePreviewEmail = async (templateId) => {
    setSendingEmail(true);
    setEmailError('');
    try {
      const res = await axios.post(`/api/email-templates/${templateId}/preview/`, { candidate_id: candidateId });
      setPreviewEmail(res.data);
      setSelectedTemplate(templateId);
      setShowEmailModal(true);
    } catch (err) {
      setEmailError(err.response?.data?.error || 'Не вдалося згенерувати лист');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSendEmail = async () => {
    if (!selectedTemplate) return;
    setSendingEmail(true);
    setEmailError('');
    try {
      await axios.post(`/api/email-templates/${selectedTemplate}/send/`, { candidate_id: candidateId });
      setShowEmailModal(false);
      setPreviewEmail(null);
      setSelectedTemplate(null);
      fetchEmailHistory();
      alert('Лист успішно відправлено!');
    } catch (err) {
      setEmailError(err.response?.data?.error || 'Не вдалося відправити лист');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCloseEmailModal = () => {
    setShowEmailModal(false);
    setPreviewEmail(null);
    setSelectedTemplate(null);
    setEmailError('');
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const getEmailStatusIcon = (status) => {
    switch (status) {
      case 'sent': return '✓';
      case 'failed': return '⚠';
      case 'pending': return '⏳';
      default: return '✉';
    }
  };

  const getEmailStatusColor = (status) => {
    switch (status) {
      case 'sent': return '#16a34a';
      case 'failed': return '#dc2626';
      case 'pending': return '#eab308';
      default: return 'var(--muted)';
    }
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

  const sectionTitleStyle = {
    fontSize: '0.72rem',
    fontWeight: 600,
    fontFamily: 'DM Mono',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'var(--muted)',
    marginBottom: '12px',
  };

  const initials = candidate
    ? `${candidate.first_name?.[0] || ''}${candidate.last_name?.[0] || ''}`.toUpperCase()
    : '';

  const history = candidate?.status_history || [];

  const assignedUser = candidate?.assigned_to != null
    ? users.find(u => Number(u.id) === Number(candidate.assigned_to)) || null
    : null;
  const assignedName = candidate?.assigned_to_name
    || (assignedUser
        ? (assignedUser.first_name && assignedUser.last_name
            ? `${assignedUser.first_name} ${assignedUser.last_name}`
            : assignedUser.username)
        : null);
  const assignedInitial = assignedName?.[0]
    || candidate?.assigned_to_username?.[0]
    || assignedUser?.username?.[0]
    || '?';

  const currentStageId = candidate?.stage_id ?? candidate?.stage;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center', zIndex: 1000,
        padding: isMobile ? '0' : '20px',
      }}
      onClick={handleBackdropClick}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: isMobile ? '16px 16px 0 0' : '16px',
          width: '100%',
          maxWidth: isMobile ? '560px' : '860px',
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
          display: 'flex', alignItems: 'center', gap: '14px',
          position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10,
          borderRadius: isMobile ? '16px 16px 0 0' : '16px 16px 0 0',
        }}>
          {loading ? (
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'var(--surface2)', flexShrink: 0 }} />
          ) : (
            <div style={{
              width: '44px', height: '44px', borderRadius: '10px',
              background: 'var(--accent)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#fff', fontWeight: 700,
              fontSize: '0.95rem', flexShrink: 0,
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
                  fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'DM Mono',
                }}
              >
                {editMode ? '✕' : '✏️'}
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Закрити картку кандидата"
              type="button"
              style={{
                padding: isMobile ? '7px 10px' : '6px 10px',
                borderRadius: '7px', border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text)',
                fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'DM Mono',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        {!loading && !editMode && (
          <div style={{
            display: 'flex', borderBottom: '1px solid var(--border)',
            padding: '0 24px', gap: '4px', overflowX: 'auto',
          }}>
            {[
              { key: 'info', label: 'Інформація' },
              { key: 'history', label: `Історія${history.length > 0 ? ` (${history.length})` : ''}` },
              { key: 'emails', label: `Листи${emailHistory.length > 0 ? ` (${emailHistory.length})` : ''}` },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                aria-label={tab.label}
                aria-pressed={activeTab === tab.key}
                type="button"
                style={{
                  padding: '12px 16px', border: 'none',
                  borderBottom: `2px solid ${activeTab === tab.key ? 'var(--accent)' : 'transparent'}`,
                  background: 'transparent',
                  color: activeTab === tab.key ? 'var(--text)' : 'var(--muted)',
                  fontSize: '0.82rem',
                  fontWeight: activeTab === tab.key ? 600 : 400,
                  cursor: 'pointer', fontFamily: 'DM Sans',
                  whiteSpace: 'nowrap', transition: 'all 0.15s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div style={{
          padding: isMobile ? '16px 20px' : '20px 24px',
          flex: 1, display: 'flex',
          gap: isMobile ? '0' : '24px',
          alignItems: 'flex-start',
        }}>
          {/* Main column */}
          <div style={{ flex: 1, minWidth: 0 }}>
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
                    <label htmlFor="edit-first-name" style={labelStyle}>Ім'я</label>
                    <input id="edit-first-name" style={inputStyle} value={editForm.first_name}
                      onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="edit-last-name" style={labelStyle}>Прізвище</label>
                    <input id="edit-last-name" style={inputStyle} value={editForm.last_name}
                      onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label htmlFor="edit-email" style={labelStyle}>Email</label>
                  <input id="edit-email" style={inputStyle} type="email" value={editForm.email}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                </div>

                <div>
                  <label htmlFor="edit-phone" style={labelStyle}>Телефон</label>
                  <input id="edit-phone" style={inputStyle} value={editForm.phone}
                    onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+380 XX XXX XX XX" />
                </div>

                <div>
                  <label htmlFor="edit-vacancy" style={labelStyle}>Вакансія</label>
                  <select id="edit-vacancy" style={inputStyle} value={editForm.vacancy}
                    onChange={e => setEditForm(f => ({ ...f, vacancy: e.target.value }))}>
                    <option value="">— Без вакансії —</option>
                    {vacancies.map(v => (
                      <option key={v.id} value={String(v.id)}>{v.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-source" style={labelStyle}>Джерело</label>
                  <select id="edit-source" style={inputStyle} value={editForm.source}
                    onChange={e => setEditForm(f => ({ ...f, source: e.target.value }))}>
                    {Object.entries(SOURCE_CONFIG).map(([key, { label }]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-notes" style={labelStyle}>Нотатки</label>
                  <textarea id="edit-notes"
                    style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                    value={editForm.notes}
                    onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Коментарі про кандидата..." />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <button onClick={() => setEditMode(false)} aria-label="Скасувати редагування" type="button"
                    style={{ padding: isMobile ? '10px 16px' : '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: '0.82rem' }}>
                    Скасувати
                  </button>
                  <button onClick={handleSaveEdit} disabled={saving} aria-label="Зберегти зміни" type="button"
                    style={{ padding: isMobile ? '10px 18px' : '8px 18px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans', fontSize: '0.82rem', opacity: saving ? 0.7 : 1 }}>
                    {saving ? 'Збереження...' : 'Зберегти зміни'}
                  </button>
                </div>
              </div>
            ) : activeTab === 'info' ? (
              /* Info Tab */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Stage + Source badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.75rem', fontFamily: 'DM Mono', padding: '5px 12px',
                    borderRadius: '6px', fontWeight: 600,
                    background: hex2rgba(candidate.stage_color || '#7a1a2e', 0.13),
                    color: candidate.stage_color || '#7a1a2e',
                  }}>
                    {candidate.stage_name || candidate.status_label || candidate.status || '—'}
                  </span>

                  <span style={{
                    fontSize: '0.75rem', fontFamily: 'DM Mono', padding: '5px 12px',
                    borderRadius: '6px', fontWeight: 600,
                    background: getSourceBg(candidate.source),
                    color: getSourceText(candidate.source),
                  }}>
                    {getSourceLabel(candidate.source)}
                  </span>

                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
                    {formatDate(candidate.created_at)}
                  </span>
                </div>

                {/* Contact Info */}
                <div>
                  <div style={sectionTitleStyle}>Контактна інформація</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <span aria-hidden="true" style={{ fontSize: '1rem' }}>✉️</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>Email</div>
                        <div style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>{candidate.email}</div>
                      </div>
                      <a href={`mailto:${candidate.email}`} aria-label={`Написати листа на ${candidate.email}`}
                        style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'none', fontFamily: 'DM Mono', flexShrink: 0 }}>
                        Написати
                      </a>
                    </div>

                    {candidate.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <span aria-hidden="true" style={{ fontSize: '1rem' }}>📞</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>Телефон</div>
                          <div style={{ fontSize: '0.85rem' }}>{candidate.phone}</div>
                        </div>
                        <a href={`tel:${candidate.phone}`} aria-label={`Подзвонити на ${candidate.phone}`}
                          style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'none', fontFamily: 'DM Mono', flexShrink: 0 }}>
                          Подзвонити
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Vacancy */}
                <div>
                  <div style={sectionTitleStyle}>Вакансія</div>
                  <div style={{ padding: '14px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span aria-hidden="true" style={{ fontSize: '1.2rem' }}>💼</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{vacancy?.title || '—'}</div>
                      {vacancy?.department && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '2px' }}>{vacancy.department}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Source */}
                <div>
                  <div style={sectionTitleStyle}>Джерело</div>
                  <div style={{ padding: '14px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span aria-hidden="true" style={{ fontSize: '1.2rem' }}>
                      {candidate.source === 'linkedin' ? '🔗' : candidate.source === 'dou' ? '💻' :
                        candidate.source === 'recommendation' ? '👥' : candidate.source === 'csv' ? '📄' :
                          candidate.source === 'direct' ? '📨' : '📌'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{getSourceLabel(candidate.source)}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '2px' }}>Канал надходження кандидата</div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {candidate.notes && (
                  <div>
                    <div style={sectionTitleStyle}>Нотатки</div>
                    <div style={{ padding: '14px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {candidate.notes}
                    </div>
                  </div>
                )}

                {/* Assigned HR */}
                <div>
                  <div style={sectionTitleStyle}>Призначений HR</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {candidate.assigned_to != null ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: getHrAvatarColor(candidate.assigned_to), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}>
                          {(candidate.assigned_to_name?.[0] || candidate.assigned_to_username?.[0] || assignedInitial).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, fontSize: '0.85rem' }}>
                          {assignedName || candidate.assigned_to_username || 'HR'}
                        </div>
                        <button onClick={() => handleAssign(null)} disabled={saving} aria-label="Скинути призначення" type="button"
                          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '0.72rem', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'DM Mono', opacity: saving ? 0.6 : 1 }}>
                          ✕ Скинути
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.82rem', color: 'var(--muted)', padding: '8px 0' }}>Не призначено</div>
                    )}

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {users.filter(u => Number(u.id) !== Number(candidate.assigned_to)).map(u => (
                        <button key={u.id} onClick={() => handleAssign(u.id)} disabled={saving}
                          aria-label={`Призначити ${u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}`}
                          type="button"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.75rem', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans', opacity: saving ? 0.6 : 1 }}>
                          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: getHrAvatarColor(u.id), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.6rem', fontWeight: 700, flexShrink: 0 }}>
                            {(u.first_name?.[0] || u.username?.[0] || '?').toUpperCase()}
                          </div>
                          {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <div style={sectionTitleStyle}>Теги</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {candidateTags.map(tag => (
                      <span key={tag.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '20px', background: tag.color + '20', border: `1px solid ${tag.color}`, color: tag.color, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'DM Sans' }}>
                        {tag.name}
                        <button onClick={() => handleRemoveTag(tag.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: tag.color, fontSize: '0.7rem', padding: 0 }}>✕</button>
                      </span>
                    ))}
                    <button onClick={() => setShowTagModal(true)}
                      style={{ padding: '5px 12px', borderRadius: '20px', border: '1px dashed var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'DM Sans' }}>
                      + Додати тег
                    </button>
                  </div>
                </div>

                {/* Email Templates */}
                <div>
                  <div style={sectionTitleStyle}>Шаблони листів</div>
                  {emailError && (
                    <div style={{ color: '#dc2626', fontSize: '0.78rem', marginBottom: '8px', fontFamily: 'DM Mono' }}>⚠ {emailError}</div>
                  )}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {emailTemplates.length === 0 ? (
                      <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                        Шаблони не налаштовані. Створіть їх у розділі "Шаблони листів".
                      </div>
                    ) : emailTemplates.map(t => (
                      <button key={t.id} onClick={() => handlePreviewEmail(t.id)} disabled={sendingEmail}
                        aria-label={`Відправити ${t.template_type_display}`} type="button"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '20px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.78rem', cursor: sendingEmail ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans', opacity: sendingEmail ? 0.6 : 1, transition: 'all 0.15s' }}>
                        <span aria-hidden="true">
                          {t.template_type === 'interview' ? '📅' : t.template_type === 'offer' ? '🎉' : t.template_type === 'rejection' ? '😔' : '✉️'}
                        </span>
                        {t.template_type_display}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Stage Change */}
                <div>
                  <div style={sectionTitleStyle}>Швидка зміна етапу</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {stages.length === 0 ? (
                      <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Завантаження...</div>
                    ) : stages.map(stage => {
                      const isActive = currentStageId === stage.id;
                      return (
                        <button
                          key={stage.id}
                          onClick={() => handleStageUpdate(stage.id)}
                          disabled={isActive || saving}
                          aria-label={`Змінити етап на ${stage.name}`}
                          aria-pressed={isActive}
                          type="button"
                          style={{
                            padding: '8px 14px', borderRadius: '20px',
                            border: `1px solid ${isActive ? stage.color : 'var(--border)'}`,
                            background: isActive ? stage.color : 'var(--surface)',
                            color: isActive ? '#fff' : 'var(--text)',
                            fontSize: '0.78rem', fontWeight: 500,
                            cursor: isActive || saving ? 'not-allowed' : 'pointer',
                            fontFamily: 'DM Sans',
                            opacity: !isActive && saving ? 0.6 : 1,
                            transition: 'all 0.15s',
                            boxShadow: isActive ? `0 2px 8px ${hex2rgba(stage.color, 0.35)}` : 'none',
                          }}
                        >
                          {stage.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : activeTab === 'history' ? (
              /* History Tab */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={sectionTitleStyle}>Історія змін статусів</div>

                {history.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)', fontSize: '0.85rem', border: '1px dashed var(--border)', borderRadius: '10px' }}>
                    Історія порожня
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                    {history.map((item, index) => {
                      const stageColor = item.new_stage_color || '#7a1a2e';
                      const stageName = item.new_stage_name || item.new_status || '—';
                      const oldName = item.old_stage_name || item.old_status || null;
                      return (
                        <div key={item.id != null ? item.id : `history-${index}`}
                          style={{ display: 'flex', gap: '14px', padding: '14px 0', borderBottom: index < history.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: stageColor, border: '2px solid var(--surface)', boxShadow: `0 0 0 2px ${stageColor}` }} />
                            {index < history.length - 1 && (
                              <div style={{ width: '2px', flex: 1, background: 'var(--border)', marginTop: '4px', minHeight: '20px' }} />
                            )}
                          </div>

                          <div style={{ flex: 1, minWidth: 0, paddingBottom: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                              <span style={{
                                fontSize: '0.78rem', fontFamily: 'DM Mono', padding: '2px 8px', borderRadius: '4px', fontWeight: 500,
                                background: hex2rgba(stageColor, 0.13), color: stageColor,
                              }}>
                                {stageName}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
                                {formatDate(item.changed_at)}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                              {oldName ? (
                                <>{oldName}<span style={{ color: 'var(--muted)', margin: '0 6px' }}>→</span>{stageName}</>
                              ) : 'Додано в систему'}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '2px' }}>
                              {item.changed_by_name || 'Система'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Emails Tab */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={sectionTitleStyle}>Історія відправлених листів</div>

                {loadingHistory ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid var(--border)', borderTop: '2px solid var(--accent)', animation: 'spin 0.8s linear infinite' }} />
                  </div>
                ) : emailHistory.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)', fontSize: '0.85rem', border: '1px dashed var(--border)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '12px' }} aria-hidden="true">✉️</div>
                    <div>Ще не було відправлено жодного листа</div>
                    <div style={{ fontSize: '0.78rem', marginTop: '8px' }}>Використайте шаблони листів вище для відправки</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {emailHistory.map(email => (
                      <div key={email.id} style={{ display: 'flex', gap: '12px', padding: '14px', background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                        <div style={{ flexShrink: 0 }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: getEmailStatusColor(email.status), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                            <span aria-hidden="true">{getEmailStatusIcon(email.status)}</span>
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', wordBreak: 'break-word' }}>{email.subject}</div>
                            <span style={{ fontSize: '0.66rem', fontFamily: 'DM Mono', padding: '3px 8px', borderRadius: '4px', background: email.status === 'sent' ? '#dcfce7' : email.status === 'failed' ? '#fee2e2' : '#fef3c7', color: email.status === 'sent' ? '#16a34a' : email.status === 'failed' ? '#dc2626' : '#eab308' }}>
                              {email.status === 'sent' ? 'Відправлено' : email.status === 'failed' ? 'Помилка' : 'Відправляється'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginBottom: '4px' }}>Кому: {email.recipient_email}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
                            {email.template_type_display && <span style={{ marginRight: '12px' }}>Тип: {email.template_type_display}</span>}
                            Відправлено: {formatDate(email.sent_at)}
                          </div>
                          {email.sent_by_name && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '2px' }}>Відправив: {email.sent_by_name}</div>
                          )}
                          {email.error_message && (
                            <div style={{ fontSize: '0.7rem', color: '#dc2626', fontFamily: 'DM Mono', marginTop: '6px', padding: '6px 8px', background: '#fee2e2', borderRadius: '6px' }}>
                              Помилка: {email.error_message}
                            </div>
                          )}
                          <details style={{ marginTop: '8px' }}>
                            <summary style={{ fontSize: '0.68rem', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'DM Mono' }}>Показати текст листа</summary>
                            <div style={{ fontSize: '0.78rem', lineHeight: 1.6, marginTop: '8px', padding: '10px', background: 'var(--surface)', borderRadius: '6px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {email.body}
                            </div>
                          </details>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desktop History Sidebar */}
          {!isMobile && !loading && !editMode && (
            <div style={{ width: '240px', flexShrink: 0, borderLeft: '1px solid var(--border)', paddingLeft: '20px', position: 'sticky', top: '0', maxHeight: 'calc(85vh - 140px)', overflowY: 'auto' }}>
              <div style={sectionTitleStyle}>Історія статусів</div>

              {history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--muted)', fontSize: '0.8rem', border: '1px dashed var(--border)', borderRadius: '10px' }}>
                  Поки що порожня
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {history.map((item, index) => {
                    const stageColor = item.new_stage_color || '#7a1a2e';
                    const stageName = item.new_stage_name || item.new_status || '—';
                    const oldName = item.old_stage_name || item.old_status || null;
                    return (
                      <div key={item.id != null ? item.id : `hist-pc-${index}`}
                        style={{ display: 'flex', gap: '10px', padding: '10px 0', borderBottom: index < history.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: stageColor, border: '2px solid var(--surface)', boxShadow: `0 0 0 2px ${stageColor}`, marginTop: '3px' }} />
                          {index < history.length - 1 && (
                            <div style={{ width: '2px', flex: 1, background: 'var(--border)', marginTop: '4px', minHeight: '16px' }} />
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0, paddingBottom: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '3px' }}>
                            <span style={{ fontSize: '0.72rem', fontFamily: 'DM Mono', padding: '2px 6px', borderRadius: '4px', background: hex2rgba(stageColor, 0.13), color: stageColor, fontWeight: 500 }}>
                              {stageName}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 500, marginBottom: '2px' }}>
                            {oldName ? (
                              <><span style={{ color: 'var(--muted)' }}>{oldName}</span><span style={{ color: 'var(--muted)', margin: '0 4px' }}>→</span><span>{stageName}</span></>
                            ) : (
                              <span style={{ color: 'var(--muted)' }}>Додано в систему</span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>{formatDate(item.changed_at)}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>{item.changed_by_name || 'Система'}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !editMode && activeTab !== 'emails' && (
          <div style={{
            padding: isMobile ? '14px 20px' : '16px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap',
            position: 'sticky', bottom: 0, background: 'var(--surface)',
            borderRadius: isMobile ? '0' : '0 0 16px 16px',
          }}>
            <button onClick={() => setShowDeleteConfirm(true)} aria-label="Видалити кандидата" type="button"
              style={{ padding: isMobile ? '9px 14px' : '7px 14px', borderRadius: '8px', border: '1px solid #fee2e2', background: 'transparent', color: '#dc2626', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 500 }}>
              <span aria-hidden="true">🗑</span> Видалити
            </button>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <a href={`mailto:${candidate?.email}`} aria-label={`Написати листа на ${candidate?.email}`}
                style={{ padding: isMobile ? '9px 14px' : '7px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'DM Sans', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span aria-hidden="true">✉️</span> Email
              </a>
              {candidate?.phone && (
                <a href={`tel:${candidate.phone}`} aria-label={`Подзвонити на ${candidate.phone}`}
                  style={{ padding: isMobile ? '9px 14px' : '7px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'DM Sans', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span aria-hidden="true">📞</span> Дзвінок
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Email Preview Modal */}
      {showEmailModal && previewEmail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px' }}
          onClick={handleCloseEmailModal}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: isMobile ? '20px' : '28px', width: '100%', maxWidth: '520px', maxHeight: '80vh', overflowY: 'auto', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="email-preview-title">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div id="email-preview-title" style={{ fontSize: '1.1rem', fontWeight: 700 }}>Попередній перегляд листа</div>
              <button onClick={handleCloseEmailModal} aria-label="Закрити попередній перегляд" type="button"
                style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            {emailError && (
              <div style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '14px', padding: '10px', background: '#fee2e2', borderRadius: '8px', fontFamily: 'DM Mono' }}>⚠ {emailError}</div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginBottom: '6px' }}>Кому: {previewEmail.candidate_email}</div>
              <div style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '12px' }}>Тема: {previewEmail.subject}</div>
              <div style={{ padding: '14px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto' }}>
                {previewEmail.body}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button onClick={handleCloseEmailModal} aria-label="Скасувати відправку" type="button"
                style={{ padding: isMobile ? '10px 16px' : '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'DM Sans' }}>
                Скасувати
              </button>
              <button onClick={handleSendEmail} disabled={sendingEmail} aria-label="Відправити лист" type="button"
                style={{ padding: isMobile ? '10px 18px' : '8px 18px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: sendingEmail ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans', opacity: sendingEmail ? 0.7 : 1 }}>
                {sendingEmail ? 'Відправка...' : '📤 Відправити лист'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Modal */}
      {showTagModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px' }}
          onClick={() => setShowTagModal(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '400px', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, marginBottom: '16px' }}>Управління тегами</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', maxHeight: '200px', overflowY: 'auto' }}>
              {availableTags.map(tag => {
                const isSelected = candidateTags.some(t => t.id === tag.id);
                return (
                  <button key={tag.id} onClick={() => isSelected ? handleRemoveTag(tag.id) : handleAddTag(tag.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${isSelected ? tag.color : 'var(--border)'}`, background: isSelected ? tag.color + '15' : 'var(--bg)', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: tag.color }} />
                    <span style={{ flex: 1, fontSize: '0.85rem' }}>{tag.name}</span>
                    {isSelected && <span style={{ color: tag.color, fontSize: '0.8rem' }}>✓</span>}
                  </button>
                );
              })}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '10px' }}>Новий тег</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input value={newTagForm.name} onChange={e => setNewTagForm(f => ({ ...f, name: e.target.value }))} placeholder="Назва тегу"
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
                <input type="color" value={newTagForm.color} onChange={e => setNewTagForm(f => ({ ...f, color: e.target.value }))}
                  style={{ width: '40px', height: '36px', border: 'none', cursor: 'pointer', background: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowTagModal(false)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}>Скасувати</button>
                <button onClick={handleCreateTag} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Створити</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px' }}
          onClick={() => setShowDeleteConfirm(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: isMobile ? '20px' : '28px', width: '100%', maxWidth: '360px', border: '1px solid var(--border)', textAlign: 'center' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '10px' }}>Видалити кандидата?</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '24px' }}>
              <strong>{candidate?.first_name} {candidate?.last_name}</strong> буде видалено назавжди. Цю дію неможливо скасувати.
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setShowDeleteConfirm(false)} aria-label="Скасувати видалення" type="button"
                style={{ padding: isMobile ? '10px 16px' : '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'DM Sans' }}>
                Скасувати
              </button>
              <button onClick={handleDelete} disabled={saving} aria-label="Підтвердити видалення" type="button"
                style={{ padding: isMobile ? '10px 18px' : '8px 18px', borderRadius: '8px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans', opacity: saving ? 0.7 : 1 }}>
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