import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const TEMPLATE_TYPES = {
  interview: { label: 'Запрошення на інтерв\'ю', defaultSubject: 'Запрошення на інтерв\'ю — {{vacancy}}', defaultBody: 'Шановний(а) {{name}},\n\nДякуємо за вашу заявку на вакансію {{vacancy}}. Ми хотіли б запросити вас на інтерв\'ю.\n\nЗ повагою,\n{{hr_name}}' },
  rejection: { label: 'Відмова', defaultSubject: 'Щодо вашої заявки на {{vacancy}}', defaultBody: 'Шановний(а) {{name}},\n\nДякуємо за ваш інтерес до вакансії {{vacancy}}. На жаль, ми вирішили рухатися з іншими кандидатами.\n\nБажаємо успіхів у пошуку!\n{{hr_name}}' },
  offer: { label: 'Оффер', defaultSubject: 'Оффер — {{vacancy}}', defaultBody: 'Шановний(а) {{name}},\n\nВітаємо! Ми раді запропонувати вам позицію {{vacancy}}.\n\nДеталі офферу...\n\nЗ повагою,\n{{hr_name}}' },
};

const PLACEHOLDERS = [
  { key: '{{name}}', desc: 'Повне ім\'я кандидата' },
  { key: '{{first_name}}', desc: 'Ім\'я' },
  { key: '{{last_name}}', desc: 'Прізвище' },
  { key: '{{vacancy}}', desc: 'Назва вакансії' },
  { key: '{{email}}', desc: 'Email кандидата' },
  { key: '{{phone}}', desc: 'Телефон' },
  { key: '{{status}}', desc: 'Статус кандидата' },
  { key: '{{hr_name}}', desc: 'Ім\'я HR' },
  { key: '{{organization}}', desc: 'Назва організації' },
  { key: '{{date}}', desc: 'Дата створення заявки' },
];

const inputStyle = (isMobile) => ({
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
});

const textareaStyle = (isMobile) => ({
  ...inputStyle(isMobile),
  minHeight: '200px',
  resize: 'vertical',
  lineHeight: 1.6,
});

function EmailTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('interview');
  const [isMobile, setIsMobile] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

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

  const fetchTemplates = useCallback(() => {
    setLoading(true);
    axios.get('/api/email-templates/')
      .then(res => {
        const data = res.data;
        setTemplates(data);
        
        // Заповнюємо форми існуючими шаблонами або дефолтними
        const newForms = { ...forms };
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
        setForms(newForms);
      })
      .catch(() => setErrorMsg('Помилка завантаження шаблонів'))
      .finally(() => setLoading(false));
  }, [forms]); // Додаємо forms в залежності, якщо він використовується всередині

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]); // Тепер fetchTemplates стабільна завдяки useCallback

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
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Помилка збереження';
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
        Завантаження шаблонів...
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? '16px' : '28px', maxWidth: '800px' }}>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>Шаблони листів</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '4px', fontFamily: 'DM Mono' }}>
          Персоналізовані шаблони для кандидатів
        </div>
      </div>

      {successMsg && (
        <div style={{ color: '#16a34a', fontSize: '0.85rem', marginBottom: '16px', padding: '10px 14px', background: '#dcfce7', borderRadius: '8px', fontFamily: 'DM Mono' }}>
          ✓ {successMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '16px', padding: '10px 14px', background: '#fee2e2', borderRadius: '8px', fontFamily: 'DM Mono' }}>
          ⚠ {errorMsg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {Object.entries(TEMPLATE_TYPES).map(([key, { label }]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            aria-label={`Шаблон: ${label}`}
            aria-pressed={activeTab === key}
            type="button"
            style={{
              padding: '12px 16px',
              border: 'none',
              borderBottom: `2px solid ${activeTab === key ? 'var(--accent)' : 'transparent'}`,
              background: 'transparent',
              color: activeTab === key ? 'var(--text)' : 'var(--muted)',
              fontSize: '0.85rem',
              fontWeight: activeTab === key ? 600 : 400,
              cursor: 'pointer',
              fontFamily: 'DM Sans',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Placeholders helper */}
      <div style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '14px 18px',
        marginBottom: '20px',
      }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: '10px' }}>
          Доступні плейсхолдери
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {PLACEHOLDERS.map(p => (
            <div
              key={p.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 10px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontFamily: 'DM Mono',
              }}
            >
              <code style={{ color: 'var(--accent)', fontWeight: 600 }}>{p.key}</code>
              <span style={{ color: 'var(--muted)' }}>{p.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        padding: isMobile ? '18px' : '24px',
      }}>
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: '8px' }}>
            Тема листа
          </div>
          <input
            value={forms[activeTab].subject}
            onChange={e => setForms(f => ({ ...f, [activeTab]: { ...f[activeTab], subject: e.target.value } }))}
            style={inputStyle(isMobile)}
            placeholder="Тема листа..."
          />
        </div>

        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: '8px' }}>
            Текст листа
          </div>
          <textarea
            value={forms[activeTab].body}
            onChange={e => setForms(f => ({ ...f, [activeTab]: { ...f[activeTab], body: e.target.value } }))}
            style={textareaStyle(isMobile)}
            placeholder="Текст листа з плейсхолдерами {{name}}, {{vacancy}}..."
          />
        </div>

        {/* Preview */}
        <div style={{
          background: 'var(--bg)',
          border: '1px dashed var(--border)',
          borderRadius: '10px',
          padding: '16px',
          marginBottom: '18px',
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: '10px' }}>
            Попередній перегляд (приклад)
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '8px', fontFamily: 'DM Mono' }}>
            Тема: {forms[activeTab].subject
              .replace(/{{name}}/g, 'Олена Семенова')
              .replace(/{{first_name}}/g, 'Олена')
              .replace(/{{last_name}}/g, 'Семенова')
              .replace(/{{vacancy}}/g, 'Python Developer')
              .replace(/{{hr_name}}/g, 'HR Manager')}
          </div>
          <div style={{ fontSize: '0.85rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
            {forms[activeTab].body
              .replace(/{{name}}/g, 'Олена Семенова')
              .replace(/{{first_name}}/g, 'Олена')
              .replace(/{{last_name}}/g, 'Семенова')
              .replace(/{{vacancy}}/g, 'Python Developer')
              .replace(/{{email}}/g, 'olena@example.com')
              .replace(/{{phone}}/g, '+380 99 123 45 67')
              .replace(/{{status}}/g, 'Новий')
              .replace(/{{hr_name}}/g, 'HR Manager')
              .replace(/{{organization}}/g, 'WinWin Travel')
              .replace(/{{date}}/g, '04.05.2026')}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleReset(activeTab)}
            aria-label={`Скинути шаблон ${TEMPLATE_TYPES[activeTab].label}`}
            type="button"
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
            Скинути за замовчуванням
          </button>
          <button
            onClick={() => handleSave(activeTab)}
            disabled={saving}
            aria-label={`Зберегти шаблон ${TEMPLATE_TYPES[activeTab].label}`}
            type="button"
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
            {saving ? 'Збереження...' : '💾 Зберегти шаблон'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EmailTemplates;