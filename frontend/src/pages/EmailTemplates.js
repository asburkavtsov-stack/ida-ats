import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const TEMPLATE_TYPES = {
  interview: { label: "Запрошення на інтерв'ю", defaultSubject: "Запрошення на інтерв'ю — {{vacancy}}", defaultBody: 'Шановний(а) {{name}},\n\nДякуємо за вашу заявку на вакансію {{vacancy}}. Ми хотіли б запросити вас на інтерв\'ю.\n\nЗ повагою,\n{{hr_name}}' },
  rejection: { label: 'Відмова', defaultSubject: 'Щодо вашої заявки на {{vacancy}}', defaultBody: 'Шановний(а) {{name}},\n\nДякуємо за ваш інтерес до вакансії {{vacancy}}. На жаль, ми вирішили рухатися з іншими кандидатами.\n\nБажаємо успіхів у пошуку!\n{{hr_name}}' },
  offer: { label: 'Оффер', defaultSubject: 'Оффер — {{vacancy}}', defaultBody: 'Шановний(а) {{name}},\n\nВітаємо! Ми раді запропонувати вам позицію {{vacancy}}.\n\nДеталі офферу...\n\nЗ повагою,\n{{hr_name}}' },
};

const PLACEHOLDERS = [
  { key: '{{name}}', desc: "Повне ім'я кандидата" },
  { key: '{{first_name}}', desc: "Ім'я" },
  { key: '{{last_name}}', desc: 'Прізвище' },
  { key: '{{vacancy}}', desc: 'Назва вакансії' },
  { key: '{{email}}', desc: 'Email кандидата' },
  { key: '{{phone}}', desc: 'Телефон' },
  { key: '{{status}}', desc: 'Статус кандидата' },
  { key: '{{hr_name}}', desc: "Ім'я HR" },
  { key: '{{organization}}', desc: 'Назва організації' },
  { key: '{{date}}', desc: 'Дата створення заявки' },
];

const replacePlaceholders = (text, replacements) => {
  if (!text) return '';
  let result = text;
  Object.entries(replacements).forEach(([key, value]) => {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedKey, 'g');
    result = result.replace(regex, value || key);
  });
  return result;
};

const previewData = {
  '{{name}}': 'Олена Семенова',
  '{{first_name}}': 'Олена',
  '{{last_name}}': 'Семенова',
  '{{vacancy}}': 'Python Developer',
  '{{email}}': 'olena@example.com',
  '{{phone}}': '+380 99 123 45 67',
  '{{status}}': 'Новий',
  '{{hr_name}}': 'HR Manager',
  '{{organization}}': 'WinWin Travel',
  '{{date}}': new Date().toLocaleDateString('uk-UA')
};

function EmailTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('interview');
  const [isMobile, setIsMobile] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedPlaceholder, setCopiedPlaceholder] = useState(null);

  const [forms, setForms] = useState({
    interview: { subject: '', body: '' },
    rejection: { subject: '', body: '' },
    offer: { subject: '', body: '' },
  });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const buildDefaultForms = useCallback((data) => {
    const newForms = {
      interview: { subject: '', body: '' },
      rejection: { subject: '', body: '' },
      offer: { subject: '', body: '' },
    };
    Object.keys(TEMPLATE_TYPES).forEach(type => {
      const existing = data.find(t => t.template_type === type);
      if (existing) {
        newForms[type] = { subject: existing.subject, body: existing.body };
      } else {
        newForms[type] = {
          subject: TEMPLATE_TYPES[type].defaultSubject,
          body: TEMPLATE_TYPES[type].defaultBody,
        };
      }
    });
    return newForms;
  }, []);

  const fetchTemplates = useCallback(() => {
    setLoading(true);
    setErrorMsg('');
    axios.get('/api/email-templates/')
      .then(res => {
        const data = res.data;
        setTemplates(data);
        setForms(buildDefaultForms(data));
      })
      .catch(err => {
        console.error('Помилка завантаження шаблонів:', err);
        // При 500 помилці використовуємо дефолтні значення
        setTemplates([]);
        setForms(buildDefaultForms([]));
        const msg = err.response?.status === 500
          ? 'Помилка сервера. Використовуються шаблони за замовчуванням.'
          : err.response?.data?.detail || 'Помилка завантаження шаблонів';
        setErrorMsg(msg);
      })
      .finally(() => setLoading(false));
  }, [buildDefaultForms]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCopyPlaceholder = (key) => {
    navigator.clipboard.writeText(key).catch(() => {});
    setCopiedPlaceholder(key);
    setTimeout(() => setCopiedPlaceholder(null), 1500);
  };

  const handleSave = async (type) => {
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    const existing = templates.find(t => t.template_type === type);
    const payload = {
      template_type: type,
      subject: forms[type].subject,
      body: forms[type].body,
      is_active: true,
    };

    try {
      if (existing) {
        await axios.patch(`/api/email-templates/${existing.id}/`, payload);
      } else {
        await axios.post('/api/email-templates/', payload);
      }
      setSuccessMsg(`Шаблон "${TEMPLATE_TYPES[type].label}" збережено!`);
      fetchTemplates();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Помилка збереження:', err);
      const msg = err.response?.status === 500
        ? 'Помилка сервера. Спробуйте пізніше.'
        : err.response?.data?.error || err.response?.data?.detail || 'Помилка збереження';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = (type) => {
    setForms(f => ({
      ...f,
      [type]: {
        subject: TEMPLATE_TYPES[type].defaultSubject,
        body: TEMPLATE_TYPES[type].defaultBody,
      },
    }));
  };

  if (loading) {
    return (
      <div style={{ padding: isMobile ? '16px' : '28px', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '16px', height: '16px', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Завантаження шаблонів...
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? '16px' : '28px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>
          Шаблони листів
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '6px', fontFamily: 'DM Mono' }}>
          Персоналізовані шаблони для кандидатів · {Object.keys(TEMPLATE_TYPES).length} типів
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div style={{
          color: '#16a34a', fontSize: '0.85rem', marginBottom: '20px',
          padding: '12px 16px', background: '#dcfce7', borderRadius: '10px',
          fontFamily: 'DM Mono', border: '1px solid #bbf7d0',
          display: 'flex', alignItems: 'center', gap: '8px',
          animation: 'slideIn 0.3s ease',
        }}>
          <span style={{ fontSize: '1rem' }}>✓</span> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{
          color: '#dc2626', fontSize: '0.85rem', marginBottom: '20px',
          padding: '12px 16px', background: '#fee2e2', borderRadius: '10px',
          fontFamily: 'DM Mono', border: '1px solid #fecaca',
          display: 'flex', alignItems: 'center', gap: '8px',
          animation: 'slideIn 0.3s ease',
        }}>
          <span style={{ fontSize: '1rem' }}>⚠</span> {errorMsg}
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '2px', marginBottom: '28px',
        borderBottom: '1px solid var(--border)', flexWrap: 'wrap',
        background: 'var(--surface)', borderRadius: '12px 12px 0 0',
        padding: '4px 4px 0', border: '1px solid var(--border)', borderBottom: 'none',
      }}>
        {Object.entries(TEMPLATE_TYPES).map(([key, { label }]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            aria-label={`Шаблон: ${label}`}
            aria-pressed={activeTab === key}
            type="button"
            style={{
              padding: isMobile ? '12px 16px' : '10px 20px',
              border: 'none',
              borderRadius: '10px 10px 0 0',
              background: activeTab === key ? 'var(--bg)' : 'transparent',
              color: activeTab === key ? 'var(--accent)' : 'var(--muted)',
              fontSize: '0.85rem',
              fontWeight: activeTab === key ? 600 : 500,
              cursor: 'pointer',
              fontFamily: 'DM Sans',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
              position: 'relative',
              bottom: '-1px',
              borderBottom: activeTab === key ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '0 12px 12px 12px', padding: isMobile ? '20px' : '28px',
        marginTop: '-28px',
      }}>
        {/* Placeholders */}
        <div style={{
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '16px 20px', marginBottom: '24px',
        }}>
          <div style={{
            fontSize: '0.7rem', fontWeight: 700, fontFamily: 'DM Mono',
            textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--muted)',
            marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ fontSize: '0.9rem' }}>🔖</span> Доступні плейсхолдери
            <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 400, textTransform: 'none', letterSpacing: '0' }}>
              (натисніть, щоб скопіювати)
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {PLACEHOLDERS.map(p => (
              <button
                key={p.key}
                onClick={() => handleCopyPlaceholder(p.key)}
                title={`${p.desc} — натисніть, щоб скопіювати`}
                type="button"
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 12px',
                  background: copiedPlaceholder === p.key ? '#dcfce7' : 'var(--surface)',
                  border: `1px solid ${copiedPlaceholder === p.key ? '#16a34a' : 'var(--border)'}`,
                  borderRadius: '8px', fontSize: '0.78rem', fontFamily: 'DM Mono',
                  cursor: 'pointer', transition: 'all 0.15s',
                  color: copiedPlaceholder === p.key ? '#16a34a' : 'var(--text)',
                }}
              >
                <code style={{
                  color: copiedPlaceholder === p.key ? '#16a34a' : 'var(--accent)',
                  fontWeight: 700, fontSize: '0.8rem',
                }}>
                  {copiedPlaceholder === p.key ? '✓ ' : ''}{p.key}
                </code>
                <span style={{
                  color: 'var(--muted)', fontSize: '0.72rem', fontWeight: 400,
                  borderLeft: '1px solid var(--border)', paddingLeft: '8px',
                }}>
                  {p.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px' }}>
          {/* Editor */}
          <div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block', fontSize: '0.72rem', fontWeight: 700,
                fontFamily: 'DM Mono', textTransform: 'uppercase',
                letterSpacing: '0.8px', marginBottom: '8px', color: 'var(--muted)',
              }}>
                Тема листа
              </label>
              <input
                value={forms[activeTab].subject}
                onChange={e => setForms(f => ({ ...f, [activeTab]: { ...f[activeTab], subject: e.target.value } }))}
                style={{
                  width: '100%',
                  padding: isMobile ? '12px 16px' : '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: isMobile ? '0.9rem' : '0.85rem',
                  fontFamily: 'DM Sans',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(var(--accent-rgb), 0.1)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                placeholder="Тема листа..."
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block', fontSize: '0.72rem', fontWeight: 700,
                fontFamily: 'DM Mono', textTransform: 'uppercase',
                letterSpacing: '0.8px', marginBottom: '8px', color: 'var(--muted)',
              }}>
                Текст листа
              </label>
              <textarea
                value={forms[activeTab].body}
                onChange={e => setForms(f => ({ ...f, [activeTab]: { ...f[activeTab], body: e.target.value } }))}
                style={{
                  width: '100%',
                  padding: isMobile ? '12px 16px' : '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: isMobile ? '0.9rem' : '0.85rem',
                  fontFamily: 'DM Sans',
                  outline: 'none',
                  boxSizing: 'border-box',
                  minHeight: '240px',
                  resize: 'vertical',
                  lineHeight: 1.7,
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(var(--accent-rgb), 0.1)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                placeholder="Текст листа з плейсхолдерами {{name}}, {{vacancy}}..."
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleReset(activeTab)}
                aria-label={`Скинути шаблон ${TEMPLATE_TYPES[activeTab].label}`}
                type="button"
                style={{
                  padding: isMobile ? '11px 18px' : '9px 18px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontFamily: 'DM Sans',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                ↺ Скинути
              </button>
              <button
                onClick={() => handleSave(activeTab)}
                disabled={saving}
                aria-label={`Зберегти шаблон ${TEMPLATE_TYPES[activeTab].label}`}
                type="button"
                style={{
                  padding: isMobile ? '11px 20px' : '9px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontFamily: 'DM Sans',
                  fontSize: '0.82rem',
                  opacity: saving ? 0.6 : 1,
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {saving ? '⏳ Збереження...' : '💾 Зберегти шаблон'}
              </button>
            </div>
          </div>

          {/* Preview */}
          <div style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
            position: 'sticky',
            top: '20px',
            alignSelf: 'start',
          }}>
            <div style={{
              fontSize: '0.7rem', fontWeight: 700, fontFamily: 'DM Mono',
              textTransform: 'uppercase', letterSpacing: '0.8px',
              color: 'var(--muted)', marginBottom: '16px',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span style={{ fontSize: '0.9rem' }}>👁</span> Попередній перегляд
            </div>

            <div style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '20px',
              color: '#1f2937',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}>
              <div style={{
                fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px',
                fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                Тема
              </div>
              <div style={{
                fontSize: '0.9rem', fontWeight: 600, color: '#111827',
                marginBottom: '16px', paddingBottom: '12px',
                borderBottom: '1px solid #f3f4f6',
              }}>
                {replacePlaceholders(forms[activeTab].subject, previewData) || '(без теми)'}
              </div>

              <div style={{
                fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px',
                fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                Лист
              </div>
              <div style={{
                fontSize: '0.85rem', lineHeight: 1.8, whiteSpace: 'pre-wrap',
                color: '#374151',
              }}>
                {replacePlaceholders(forms[activeTab].body, previewData) || '(без тексту)'}
              </div>
            </div>

            <div style={{
              marginTop: '12px', fontSize: '0.7rem', color: 'var(--muted)',
              fontFamily: 'DM Mono', textAlign: 'center',
            }}>
              Приклад даних: Олена Семенова, Python Developer
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default EmailTemplates;