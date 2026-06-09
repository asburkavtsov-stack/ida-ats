import React, { useState, useEffect } from 'react';
import api from 'axiosConfig';
import CSVImportModal from './CSVImportModal';
import GDPRConsentCheckbox from './GDPRConsentCheckbox';

function AddCandidateModal({ onClose, onAdded }) {
  const [vacancies,     setVacancies]     = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTags,  setSelectedTags]  = useState([]);
  const [stages,        setStages]        = useState([]);
  const [error,         setError]         = useState('');
  const [isMobile,      setIsMobile]      = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [duplicateWarning,    setDuplicateWarning]    = useState(null);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '',
    phone: '', vacancy: '', stage_id: '', notes: '',
  });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    api.get('/api/vacancies/')
      .then(res => {
        const data = res.data;
        setVacancies(Array.isArray(data) ? data : (data.results ?? []));
      })
      .catch(err => console.error('Помилка завантаження вакансій:', err));
  }, []);

  useEffect(() => {
    api.get('/api/tags/')
      .then(res => setAvailableTags(res.data.results ?? res.data))
      .catch(err => console.error('Помилка завантаження тегів:', err));
  }, []);

  // При зміні вакансії — завантажуємо її стейджі
  useEffect(() => {
    const params = form.vacancy
      ? { vacancy: form.vacancy }
      : { org_template: true };

    api.get('/api/vacancy-stages/', { params })
      .then(res => {
        const data = res.data.results ?? res.data;
        setStages(data);
        // Автоматично обираємо перший стейдж
        if (data.length > 0) {
          setForm(f => ({ ...f, stage_id: String(data[0].id) }));
        }
      })
      .catch(() => {});
  }, [form.vacancy]);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (e.target.name === 'email' || e.target.name === 'phone') {
      setDuplicateWarning(null);
    }
  };

  const checkDuplicate = async () => {
    const email = form.email.trim();
    const phone = form.phone.trim();
    if (!email && !phone) return null;

    setIsCheckingDuplicate(true);
    try {
      const response = await api.post('/api/candidates/check-duplicate/', { email, phone });
      if (response.data.has_duplicate) return response.data;
      return null;
    } catch (err) {
      console.error('Помилка перевірки дубліката:', err);
      return null;
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  const handleBlur = async (e) => {
    const field = e.target.name;
    if (field === 'email' || field === 'phone') {
      const email = form.email.trim();
      const phone = form.phone.trim();
      if (email || phone) {
        const duplicateData = await checkDuplicate();
        setDuplicateWarning(duplicateData || null);
      }
    }
  };

  const handleSubmit = async (skipDupCheck = false) => {
    if (!form.first_name.trim()) { setError("Ім'я обов'язкове"); return; }
    if (!form.last_name.trim())  { setError("Прізвище обов'язкове"); return; }
    if (!form.email.trim())      { setError("Email обов'язковий"); return; }
    if (!form.vacancy)           { setError("Оберіть вакансію"); return; }
    if (!gdprConsent)            { setError("Необхідна згода на обробку персональних даних (GDPR)"); return; }

    if (!skipDupCheck) {
      const duplicateData = await checkDuplicate();
      if (duplicateData) {
        setDuplicateWarning(duplicateData);
        const matchedBy = duplicateData.duplicate_candidate
          ? 'даними'
          : duplicateData.duplicate_by === 'email' ? 'email' : 'телефоном';
        setError(`Знайдено дублікат! Кандидат з таким ${matchedBy} вже існує.`);
        return;
      }
    }

    const payload = {
      first_name: form.first_name,
      last_name:  form.last_name,
      email:      form.email,
      phone:      form.phone,
      vacancy:    form.vacancy,
      notes:      form.notes,
      tag_ids:    selectedTags,
      gdpr_consent: gdprConsent,
      ...(form.stage_id ? { stage: Number(form.stage_id) } : {}),
    };

    api.post('/api/candidates/', payload)
      .then(() => { onAdded(); onClose(); })
      .catch(err => {
        if (err.response?.data?.duplicate) {
          setDuplicateWarning({
            has_duplicate: true,
            duplicate_candidate: err.response.data.duplicate_candidate,
          });
          setError(err.response.data.message || 'Кандидат з такими даними вже існує');
        } else {
          console.error(err);
          setError('Помилка при створенні кандидата');
        }
      });
  };

  const ignoreDuplicateAndSubmit = () => {
    setDuplicateWarning(null);
    setError('');
    handleSubmit(true);
  };

  const handleCSVAdded = () => {
    onAdded();
    setShowCSVImport(false);
  };

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: isMobile ? 'flex-end' : 'center',
    justifyContent: 'center', zIndex: 1000,
  };
  const modal = {
    background: 'var(--surface)', borderRadius: isMobile ? '16px 16px 0 0' : '16px',
    width: '100%', maxWidth: '480px',
    maxHeight: isMobile ? '90vh' : '90vh',
    overflowY: 'auto',
    boxShadow: 'var(--shadow-lg)',
  };
  const input = {
    width: '100%', padding: isMobile ? '11px 14px' : '9px 12px',
    border: '1px solid var(--border)', borderRadius: '8px',
    fontSize: isMobile ? '0.9rem' : '0.85rem', fontFamily: 'DM Sans',
    background: 'var(--bg)', outline: 'none',
  };
  const label = {
    display: 'block', fontSize: '0.72rem', fontWeight: 600,
    fontFamily: 'DM Mono', textTransform: 'uppercase',
    letterSpacing: '0.5px', marginBottom: '6px',
  };
  const warningBox = {
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid #f59e0b',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '12px',
  };
  const duplicateItem = {
    padding: '8px',
    background: 'var(--bg)',
    borderRadius: '6px',
    marginTop: '8px',
    fontSize: '0.8rem',
  };

  return (
    <>
      <div style={overlay} onClick={onClose}>
        <div style={modal} onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Новий кандидат</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowCSVImport(true)}
                aria-label="Імпорт з CSV"
                type="button"
                style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'DM Mono', color: 'var(--muted)' }}
              >
                📂 CSV імпорт
              </button>
              <button
                onClick={onClose}
                aria-label="Закрити модальне вікно"
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
          </div>

          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Duplicate warning */}
            {duplicateWarning && (
              <div style={warningBox}>
                <div style={{ fontWeight: 600, color: '#f59e0b', marginBottom: '8px' }}>
                  ⚠️ Знайдено можливий дублікат!
                </div>
                {duplicateWarning.duplicate_candidate && (
                  <div style={duplicateItem}>
                    <div><strong>{duplicateWarning.duplicate_candidate.first_name} {duplicateWarning.duplicate_candidate.last_name}</strong></div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                      {duplicateWarning.duplicate_candidate.email && <span>📧 {duplicateWarning.duplicate_candidate.email}</span>}
                      {duplicateWarning.duplicate_candidate.phone && <span> 📞 {duplicateWarning.duplicate_candidate.phone}</span>}
                    </div>
                    <div style={{ fontSize: '0.7rem', marginTop: '4px' }}>
                      Статус: {duplicateWarning.duplicate_candidate.stage_name || duplicateWarning.duplicate_candidate.status} | Вакансія: {duplicateWarning.duplicate_candidate.vacancy_title || '—'}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button
                    onClick={ignoreDuplicateAndSubmit}
                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #f59e0b', background: 'transparent', color: '#f59e0b', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    Все одно додати
                  </button>
                  <button
                    onClick={() => setDuplicateWarning(null)}
                    style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: 'var(--border)', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    Скасувати
                  </button>
                </div>
              </div>
            )}

            {/* Ім'я + Прізвище */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={label}>Ім'я</label>
                <input style={input} name="first_name" placeholder="Олена" onChange={handleChange} />
              </div>
              <div>
                <label style={label}>Прізвище</label>
                <input style={input} name="last_name" placeholder="Семенова" onChange={handleChange} />
              </div>
            </div>

            <div>
              <label style={label}>Email</label>
              <input
                style={{ ...input, borderColor: duplicateWarning ? '#f59e0b' : 'var(--border)' }}
                name="email"
                placeholder="email@gmail.com"
                onChange={handleChange}
                onBlur={handleBlur}
              />
            </div>

            <div>
              <label style={label}>Телефон</label>
              <input
                style={{ ...input, borderColor: duplicateWarning ? '#f59e0b' : 'var(--border)' }}
                name="phone"
                placeholder="+380 XX XXX XX XX"
                onChange={handleChange}
                onBlur={handleBlur}
              />
            </div>

            <div>
              <label style={label}>Вакансія</label>
              <select style={input} name="vacancy" value={form.vacancy} onChange={handleChange}>
                <option value="">— Обери вакансію —</option>
                {vacancies.map(v => (
                  <option key={v.id} value={v.id}>{v.title}</option>
                ))}
              </select>
            </div>

            {/* Стейдж — динамічний */}
            {stages.length > 0 && (
              <div>
                <label style={label}>Початковий етап</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {stages.map(stage => {
                    const isActive = form.stage_id === String(stage.id);
                    const r = parseInt(stage.color.slice(1,3), 16);
                    const g = parseInt(stage.color.slice(3,5), 16);
                    const b = parseInt(stage.color.slice(5,7), 16);
                    return (
                      <button
                        key={stage.id}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, stage_id: String(stage.id) }))}
                        style={{
                          padding: '6px 12px', borderRadius: '20px', fontSize: '0.78rem',
                          border: `1px solid ${isActive ? stage.color : 'var(--border)'}`,
                          background: isActive ? `rgba(${r},${g},${b},0.15)` : 'var(--bg)',
                          color: isActive ? stage.color : 'var(--muted)',
                          cursor: 'pointer', fontFamily: 'DM Sans',
                          fontWeight: isActive ? 600 : 400,
                          transition: 'all 0.15s',
                        }}
                      >
                        {isActive && <span style={{ marginRight: '4px' }}>●</span>}{stage.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Теги */}
            <div>
              <label style={label}>Теги</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {availableTags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => setSelectedTags(prev =>
                      prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                    )}
                    type="button"
                    style={{
                      padding: '5px 12px', borderRadius: '20px', fontSize: '0.78rem',
                      border: `1px solid ${selectedTags.includes(tag.id) ? tag.color : 'var(--border)'}`,
                      background: selectedTags.includes(tag.id) ? tag.color + '20' : 'var(--bg)',
                      color: selectedTags.includes(tag.id) ? tag.color : 'var(--muted)',
                      cursor: 'pointer', fontFamily: 'DM Sans',
                    }}
                  >
                    {selectedTags.includes(tag.id) ? '✓ ' : ''}{tag.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={label}>Нотатки</label>
              <textarea
                style={{ ...input, minHeight: '70px', resize: 'vertical' }}
                name="notes"
                placeholder="Коментар..."
                onChange={handleChange}
              />
            </div>

            {/* GDPR Consent */}
            <GDPRConsentCheckbox
              checked={gdprConsent}
              onChange={setGdprConsent}
              required={true}
              isMobile={isMobile}
            />

          </div>

          {/* Footer */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {error && (
              <div style={{ color: '#dc2626', fontSize: '0.78rem', fontFamily: 'DM Mono' }}>
                ⚠ {error}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={onClose}
                style={{ padding: isMobile ? '10px 16px' : '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '0.82rem' }}
              >
                Скасувати
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={isCheckingDuplicate}
                style={{ padding: isMobile ? '10px 16px' : '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: isCheckingDuplicate ? 'not-allowed' : 'pointer', fontSize: '0.82rem', fontWeight: 600, opacity: isCheckingDuplicate ? 0.6 : 1 }}
              >
                {isCheckingDuplicate ? 'Перевірка...' : 'Зберегти'}
              </button>
            </div>
          </div>

        </div>
      </div>

      {showCSVImport && (
        <CSVImportModal
          onClose={() => setShowCSVImport(false)}
          onAdded={handleCSVAdded}
        />
      )}
    </>
  );
}

export default AddCandidateModal;