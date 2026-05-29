// AddVacancyModal.js — оновлена версія з підтримкою шаблонів
import React, { useState, useEffect } from 'react';
import axios from 'axiosConfig';
import VacancyTemplateLibrary, { highlightPlaceholders, TEMPLATE_CATEGORIES } from './VacancyTemplateLibrary';

// ─── Хелпер: заповнює {{змінні}} у тексті ────────────────────────────────────
// Повертає рядок зі зміненими значеннями після того, як юзер заповнить плейсхолдери

function extractPlaceholders(text) {
  if (!text) return [];
  const matches = [...text.matchAll(/{{([^}]+)}}/g)];
  const unique = [];
  const seen = new Set();
  for (const m of matches) {
    if (!seen.has(m[1])) { seen.add(m[1]); unique.push(m[1]); }
  }
  return unique;
}

function applyPlaceholders(text, values) {
  if (!text) return text;
  return Object.entries(values).reduce(
    (acc, [key, val]) => acc.replaceAll(`{{${key}}}`, val || `{{${key}}}`),
    text,
  );
}

// ─── Крок 2: Заповнення змінних ──────────────────────────────────────────────

function PlaceholderStep({ form, onConfirm, onSkip }) {
  const allText = `${form.title} ${form.department} ${form.description} ${form.requirements} ${form.city}`;
  const placeholders = extractPlaceholders(allText);
  const [values, setValues] = useState({});

  if (placeholders.length === 0) {
    // немає змінних — одразу пропускаємо
    onSkip();
    return null;
  }

  const handleApply = () => {
    const newForm = {
      ...form,
      title:        applyPlaceholders(form.title, values),
      department:   applyPlaceholders(form.department, values),
      description:  applyPlaceholders(form.description, values),
      requirements: applyPlaceholders(form.requirements, values),
      city:         applyPlaceholders(form.city, values),
    };
    onConfirm(newForm);
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

  return (
    <div>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>
          Заповніть змінні шаблону
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
          {placeholders.length} змінн{placeholders.length === 1 ? 'а' : 'их'} у шаблоні
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {placeholders.map(key => (
          <div key={key}>
            <label style={label}>{key}</label>
            <input
              style={input}
              placeholder={`Значення для {{${key}}}`}
              value={values[key] || ''}
              onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button
          onClick={onSkip}
          style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '0.82rem' }}
        >
          Пропустити
        </button>
        <button
          onClick={handleApply}
          style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
        >
          Застосувати →
        </button>
      </div>
    </div>
  );
}

// ─── Основний модаль ──────────────────────────────────────────────────────────

function AddVacancyModal({ onClose, onAdded, vacancyLimit, isLimitReached }) {
  const EMPTY_FORM = {
    title: '', department: '', description: '',
    requirements: '', city: '', employment_type: 'volunteer', is_active: true,
  };

  const [step, setStep] = useState('form');        // 'form' | 'placeholders'
  const [form, setForm] = useState(EMPTY_FORM);
  const [fromTemplate, setFromTemplate] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // ─── Збереження як шаблон ─────────────────────────────────────────────────
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('other');
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleChange = e => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [e.target.name]: value }));
  };

  // ── Вибір шаблону з бібліотеки ────────────────────────────────────────────
  const handleSelectTemplate = (template) => {
    setForm({
      title:           template.title,
      department:      template.department || '',
      description:     template.description || '',
      requirements:    template.requirements || '',
      city:            template.city || '',
      employment_type: template.employment_type || 'volunteer',
      is_active:       true,
    });
    setFromTemplate(true);
    setShowLibrary(false);

    // Перевіряємо чи є змінні
    const allText = `${template.title} ${template.department} ${template.description} ${template.requirements} ${template.city}`;
    if (extractPlaceholders(allText).length > 0) {
      setStep('placeholders');
    }
  };

  // ── Submit форми ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await axios.post('/api/vacancies/', form);
      onAdded();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Помилка створення вакансії');
    } finally {
      setSaving(false);
    }
  };

  // ── Зберегти поточну форму як шаблон ─────────────────────────────────────
  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    try {
      await axios.post('/api/vacancy-templates/', {
        name:            templateName,
        category:        templateCategory,
        title:           form.title,
        department:      form.department,
        description:     form.description,
        requirements:    form.requirements,
        city:            form.city,
        employment_type: form.employment_type,
      });
      setShowSaveTemplate(false);
      setTemplateName('');
    } catch (err) {
      console.error(err);
      alert('Помилка збереження шаблону');
    } finally {
      setSavingTemplate(false);
    }
  };

  // ─── Стилі ───────────────────────────────────────────────────────────────

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: isMobile ? 'flex-end' : 'center',
    justifyContent: 'center', zIndex: 1000,
  };
  const modal = {
    background: 'var(--surface)', borderRadius: isMobile ? '16px 16px 0 0' : '16px',
    width: '100%', maxWidth: '480px',
    maxHeight: isMobile ? '92vh' : '90vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: 'var(--shadow-lg)',
  };
  const inputStyle = {
    width: '100%', padding: isMobile ? '11px 14px' : '9px 12px', border: '1px solid var(--border)',
    borderRadius: '8px', fontSize: isMobile ? '0.9rem' : '0.85rem', fontFamily: 'DM Sans',
    background: 'var(--bg)', outline: 'none',
  };
  const labelStyle = {
    display: 'block', fontSize: '0.72rem', fontWeight: 600,
    fontFamily: 'DM Mono', textTransform: 'uppercase',
    letterSpacing: '0.5px', marginBottom: '6px',
  };

  // ── Крок: заповнення змінних ──────────────────────────────────────────────
  if (step === 'placeholders') {
    return (
      <>
        <div style={overlay} onClick={onClose}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <PlaceholderStep
              form={form}
              onConfirm={(newForm) => { setForm(newForm); setStep('form'); }}
              onSkip={() => setStep('form')}
            />
          </div>
        </div>
      </>
    );
  }

  // ── Основна форма ─────────────────────────────────────────────────────────
  return (
    <>
      <div style={overlay} onClick={onClose}>
        <div style={modal} onClick={e => e.stopPropagation()}>

          {/* Шапка */}
          <div style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexShrink: 0,
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                Нова вакансія
                {fromTemplate && (
                  <span style={{
                    marginLeft: '8px', fontSize: '0.68rem', fontWeight: 600,
                    background: '#e8f0fe', color: '#1a56db',
                    padding: '2px 8px', borderRadius: '4px',
                    fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.5px',
                  }}>
                    з шаблону
                  </span>
                )}
              </div>
              {isLimitReached && (
                <div style={{ fontSize: '0.72rem', color: '#dc2626', fontFamily: 'DM Mono', marginTop: '2px' }}>
                  Ліміт вакансій досягнуто ({vacancyLimit?.current}/{vacancyLimit?.max})
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--muted)' }}
            >
              ✕
            </button>
          </div>

          {/* Кнопка "Обрати шаблон" */}
          <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <button
              onClick={() => setShowLibrary(true)}
              style={{
                width: '100%',
                padding: isMobile ? '11px' : '9px',
                borderRadius: '8px',
                border: '1.5px dashed var(--border)',
                background: 'var(--bg)',
                color: 'var(--muted)',
                cursor: 'pointer',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontFamily: 'DM Sans',
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; }}
            >
              📋 Обрати з бібліотеки шаблонів
            </button>
          </div>

          {/* Форма */}
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', flex: 1 }}>

            <div>
              <label style={labelStyle}>Назва вакансії *</label>
              <input style={inputStyle} name="title" value={form.title} placeholder="Python Developer" onChange={handleChange} />
            </div>

            <div>
              <label style={labelStyle}>Відділ</label>
              <input style={inputStyle} name="department" value={form.department} placeholder="Engineering · Remote" onChange={handleChange} />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Місто</label>
                <input style={inputStyle} name="city" value={form.city} placeholder="Київ / Remote" onChange={handleChange} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Тип зайнятості</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} name="employment_type" value={form.employment_type} onChange={handleChange}>
                  <option value="full_time">Повна зайнятість</option>
                  <option value="part_time">Часткова зайнятість</option>
                  <option value="volunteer">Волонтерство</option>
                  <option value="contract">Контракт</option>
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>
                Опис вакансії
                {form.description && extractPlaceholders(form.description).length > 0 && (
                  <span style={{ marginLeft: '6px', color: '#92400e', fontWeight: 400 }}>
                    ({extractPlaceholders(form.description).length} змінн{extractPlaceholders(form.description).length === 1 ? 'а' : 'их'})
                  </span>
                )}
              </label>
              <textarea
                style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
                name="description"
                value={form.description}
                placeholder={'Розкажіть про роль, команду, задачі...\n\nМожна використовувати {{company_name}}, {{location}} тощо'}
                onChange={handleChange}
              />
              {form.description && extractPlaceholders(form.description).length > 0 && (
                <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#92400e', fontFamily: 'DM Mono' }}>
                  Незамінені змінні: {extractPlaceholders(form.description).map(p => `{{${p}}}`).join(', ')}
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>
                Вимоги
                {form.requirements && extractPlaceholders(form.requirements).length > 0 && (
                  <span style={{ marginLeft: '6px', color: '#92400e', fontWeight: 400 }}>
                    ({extractPlaceholders(form.requirements).length} змінн{extractPlaceholders(form.requirements).length === 1 ? 'а' : 'их'})
                  </span>
                )}
              </label>
              <textarea
                style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
                name="requirements"
                value={form.requirements}
                placeholder={'Навички, досвід, освіта...\n\nМожна використовувати {{years_experience}}, {{stack}} тощо'}
                onChange={handleChange}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="checkbox" name="is_active" checked={form.is_active}
                onChange={handleChange} id="is_active_add"
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="is_active_add" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                Активна вакансія
              </label>
            </div>

            {/* ── Зберегти як шаблон ── */}
            {!showSaveTemplate ? (
              <button
                onClick={() => { setShowSaveTemplate(true); setTemplateName(form.title || ''); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--muted)', fontSize: '0.78rem', textAlign: 'left',
                  padding: 0, display: 'flex', alignItems: 'center', gap: '4px',
                  fontFamily: 'DM Sans',
                }}
              >
                💾 Зберегти форму як шаблон
              </button>
            ) : (
              <div style={{
                border: '1px solid var(--border)', borderRadius: '10px',
                padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px',
                background: 'var(--bg)',
              }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Зберегти як шаблон
                </div>
                <input
                  style={inputStyle}
                  placeholder="Назва шаблону"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                />
                <select
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  value={templateCategory}
                  onChange={e => setTemplateCategory(e.target.value)}
                >
                  {TEMPLATE_CATEGORIES.filter(c => c.key !== 'all').map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setShowSaveTemplate(false)}
                    style={{ padding: '7px 12px', borderRadius: '7px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '0.78rem' }}
                  >
                    Скасувати
                  </button>
                  <button
                    onClick={handleSaveAsTemplate}
                    disabled={!templateName.trim() || savingTemplate}
                    style={{
                      padding: '7px 12px', borderRadius: '7px', border: 'none',
                      background: '#16a34a', color: '#fff',
                      cursor: templateName.trim() && !savingTemplate ? 'pointer' : 'not-allowed',
                      fontSize: '0.78rem', fontWeight: 600,
                      opacity: !templateName.trim() || savingTemplate ? 0.6 : 1,
                    }}
                  >
                    {savingTemplate ? 'Збереження...' : '💾 Зберегти шаблон'}
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px', borderTop: '1px solid var(--border)',
            display: 'flex', justifyContent: 'flex-end', gap: '10px',
            flexShrink: 0, flexWrap: 'wrap',
          }}>
            <button
              onClick={onClose}
              style={{ padding: isMobile ? '10px 16px' : '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '0.82rem' }}
            >
              Скасувати
            </button>
            <button
              onClick={handleSubmit}
              disabled={!form.title.trim() || saving || isLimitReached}
              style={{
                padding: isMobile ? '10px 16px' : '8px 16px',
                borderRadius: '8px', border: 'none',
                background: 'var(--accent)', color: '#fff',
                cursor: !form.title.trim() || saving || isLimitReached ? 'not-allowed' : 'pointer',
                fontSize: '0.82rem', fontWeight: 600,
                opacity: !form.title.trim() || saving || isLimitReached ? 0.6 : 1,
              }}
            >
              {saving ? 'Збереження...' : 'Створити вакансію'}
            </button>
          </div>

        </div>
      </div>

      {/* Бібліотека шаблонів — поверх основного модалю */}
      {showLibrary && (
        <VacancyTemplateLibrary
          onSelect={handleSelectTemplate}
          onClose={() => setShowLibrary(false)}
        />
      )}
    </>
  );
}

export default AddVacancyModal;