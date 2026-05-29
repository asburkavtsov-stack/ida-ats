// VacancyTemplateLibrary.js
// Бібліотека шаблонів вакансій — відкривається як модаль поверх AddVacancyModal
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axiosConfig';

// ─── Константи ───────────────────────────────────────────────────────────────

export const TEMPLATE_CATEGORIES = [
  { key: 'all',        label: 'Всі' },
  { key: 'it',         label: 'IT' },
  { key: 'sales',      label: 'Sales' },
  { key: 'marketing',  label: 'Marketing' },
  { key: 'hr',         label: 'HR' },
  { key: 'finance',    label: 'Finance' },
  { key: 'operations', label: 'Operations' },
  { key: 'design',     label: 'Design' },
  { key: 'other',      label: 'Інше' },
];

export const CATEGORY_COLORS = {
  it:         { bg: '#e8f0fe', text: '#1a56db' },
  sales:      { bg: '#dcfce7', text: '#16a34a' },
  marketing:  { bg: '#fff3e0', text: '#c94f2a' },
  hr:         { bg: '#fce4ec', text: '#c2185b' },
  finance:    { bg: '#f5eaf0', text: '#8a3a5a' },
  operations: { bg: '#f5f5f5', text: '#616161' },
  design:     { bg: '#ede9fe', text: '#7c3aed' },
  other:      { bg: '#f9eaed', text: '#7a1a2e' },
};

// ─── Хелпер: підсвічує {{змінні}} у тексті ───────────────────────────────────

export function highlightPlaceholders(text) {
  if (!text) return null;
  const parts = text.split(/({{[^}]+}})/g);
  return parts.map((part, i) => {
    if (/^{{[^}]+}}$/.test(part)) {
      return (
        <mark key={i} style={{
          background: '#fff3cd',
          color: '#92400e',
          borderRadius: '3px',
          padding: '0 3px',
          fontFamily: 'DM Mono',
          fontSize: '0.8em',
          fontWeight: 600,
        }}>
          {part}
        </mark>
      );
    }
    return part;
  });
}

// ─── Компонент-бейдж категорії ────────────────────────────────────────────────

function CategoryBadge({ category, label }) {
  const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
  return (
    <span style={{
      fontSize: '0.68rem',
      fontWeight: 700,
      fontFamily: 'DM Mono',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      padding: '2px 8px',
      borderRadius: '4px',
      background: colors.bg,
      color: colors.text,
    }}>
      {label}
    </span>
  );
}

// ─── Картка шаблону ───────────────────────────────────────────────────────────

function TemplateCard({ template, onSelect, onDelete, isMobile }) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Видалити шаблон "${template.name}"?`)) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/vacancy-templates/${template.id}/`);
      onDelete(template.id);
    } catch {
      alert('Помилка видалення шаблону');
      setDeleting(false);
    }
  };

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: '12px',
      background: 'var(--surface)',
      overflow: 'hidden',
      transition: 'box-shadow 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-lg)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Header */}
      <div style={{ padding: '14px 16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <CategoryBadge category={template.category} label={template.category_display} />
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.92rem', wordBreak: 'break-word' }}>
            {template.name}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '2px' }}>
            {template.title}
            {template.department ? ` · ${template.department}` : ''}
          </div>
        </div>
      </div>

      {/* Preview toggle */}
      {(template.description || template.requirements) && (
        <div style={{ paddingLeft: '16px', paddingRight: '16px', paddingBottom: '8px' }}>
          <button
            onClick={() => setExpanded(v => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono',
              padding: 0, display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            {expanded ? '▲ Згорнути' : '▼ Переглянути'}
          </button>

          {expanded && (
            <div style={{
              marginTop: '10px',
              fontSize: '0.8rem',
              lineHeight: '1.55',
              color: 'var(--text)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}>
              {template.description && (
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: '4px' }}>
                    Опис
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{highlightPlaceholders(template.description)}</div>
                </div>
              )}
              {template.requirements && (
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: '4px' }}>
                    Вимоги
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{highlightPlaceholders(template.requirements)}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer actions */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '8px',
        background: 'var(--bg)',
      }}>
        <button
          onClick={handleDelete}
          disabled={deleting}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#dc2626', fontSize: '0.78rem', padding: '4px 6px',
            borderRadius: '6px', opacity: deleting ? 0.5 : 1,
          }}
          title="Видалити шаблон"
        >
          🗑 Видалити
        </button>
        <button
          onClick={() => onSelect(template)}
          style={{
            padding: isMobile ? '9px 14px' : '7px 14px',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '0.82rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          Використати →
        </button>
      </div>
    </div>
  );
}

// ─── Основний компонент бібліотеки ────────────────────────────────────────────

function VacancyTemplateLibrary({ onSelect, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (activeCategory !== 'all') params.category = activeCategory;
      const res = await axios.get('/api/vacancy-templates/', { params });
      setTemplates(res.data.results ?? res.data);
    } catch (err) {
      console.error('Помилка завантаження шаблонів:', err);
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const filtered = templates.filter(t => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.title.toLowerCase().includes(q) ||
      (t.department || '').toLowerCase().includes(q)
    );
  });

  const handleDelete = (id) => setTemplates(prev => prev.filter(t => t.id !== id));

  // ─── Стилі ───────────────────────────────────────────────────────────────

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: isMobile ? 'flex-end' : 'center',
    justifyContent: 'center', zIndex: 1100,
  };

  const drawer = {
    background: 'var(--surface)',
    borderRadius: isMobile ? '16px 16px 0 0' : '16px',
    width: '100%',
    maxWidth: isMobile ? '100%' : '700px',
    maxHeight: isMobile ? '92vh' : '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--shadow-lg)',
  };

  const inputStyle = {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '0.85rem',
    fontFamily: 'DM Sans',
    background: 'var(--bg)',
    outline: 'none',
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={drawer} onClick={e => e.stopPropagation()}>

        {/* ── Шапка ── */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Бібліотека шаблонів</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '2px' }}>
              {templates.length} шаблон{templates.length === 1 ? '' : templates.length < 5 ? 'и' : 'ів'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--muted)' }}
          >
            ✕
          </button>
        </div>

        {/* ── Фільтри + пошук ── */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <input
            style={{ ...inputStyle, marginBottom: '12px' }}
            placeholder="🔍  Пошук за назвою, відділом..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {TEMPLATE_CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: activeCategory === cat.key ? 'none' : '1px solid var(--border)',
                  background: activeCategory === cat.key ? 'var(--accent)' : 'transparent',
                  color: activeCategory === cat.key ? '#fff' : 'var(--text)',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: activeCategory === cat.key ? 600 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Список ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
              Завантаження шаблонів...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '48px 0',
              color: 'var(--muted)', fontSize: '0.85rem',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📋</div>
              {search ? 'Нічого не знайдено' : 'Шаблонів ще немає'}
              <div style={{ fontSize: '0.75rem', marginTop: '6px', fontFamily: 'DM Mono' }}>
                {search
                  ? 'Спробуйте змінити пошуковий запит'
                  : 'Збережіть вакансію як шаблон, щоб вона з\'явилась тут'
                }
              </div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '12px',
            }}>
              {filtered.map(t => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onSelect={onSelect}
                  onDelete={handleDelete}
                  isMobile={isMobile}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default VacancyTemplateLibrary;