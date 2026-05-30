// statusColors.js
// KANBAN_COLUMNS і STATUS_CONFIG тепер dynamic — беруться з API /api/vacancy-stages/
// Статичні значення залишені як fallback для місць де ще не підключено dynamic stages

// ─── Статичний fallback (для сумісності з аналітикою і фільтрами) ─────────────
export const STATUS_CONFIG = {
  new:       { label: 'Новий',      bg: '#f9eaed', text: '#7a1a2e', color: '#7a1a2e' },
  screening: { label: 'Скринінг',   bg: '#fff3e0', text: '#c94f2a', color: '#b03050' },
  interview: { label: 'Співбесіда', bg: '#f5eaf0', text: '#8a3a5a', color: '#8a3a5a' },
  offer:     { label: 'Оффер',      bg: '#fce4ec', text: '#c2185b', color: '#e8a0b0' },
  rejected:  { label: 'Відмова',    bg: '#f5f5f5', text: '#757575', color: '#aaaaaa' },
};

// Фільтри для аналітики — прив'язані до system_key, не до назв стейджів
export const STATUS_FILTERS = [
  { key: 'all',       label: 'Всі'        },
  { key: 'new',       label: 'Нові'       },
  { key: 'screening', label: 'Скринінг'   },
  { key: 'interview', label: 'Співбесіда' },
  { key: 'offer',     label: 'Оффер'      },
  { key: 'rejected',  label: 'Відмова'    },
];

// Статичний fallback — використовується якщо stages ще не завантажились
export const KANBAN_COLUMNS = [
  { key: 'new',       label: 'Нові',       color: '#7a1a2e' },
  { key: 'screening', label: 'Скринінг',   color: '#b03050' },
  { key: 'interview', label: 'Співбесіда', color: '#8a3a5a' },
  { key: 'offer',     label: 'Оффер',      color: '#e8a0b0' },
  { key: 'rejected',  label: 'Відмова',    color: '#aaaaaa' },
];

// ─── Dynamic helpers — використовують stage об'єкти з API ────────────────────

/**
 * Конвертує масив VacancyStage з API у формат сумісний зі старим STATUS_CONFIG
 * stages: [{ id, name, color, system_key, order, ... }]
 */
export const stagesToStatusConfig = (stages) => {
  const config = { ...STATUS_CONFIG };  // починаємо з fallback
  stages.forEach(stage => {
    const key = stage.system_key || `stage_${stage.id}`;
    config[key] = {
      label: stage.name,
      color: stage.color,
      bg:    hex2rgba(stage.color, 0.12),
      text:  stage.color,
    };
  });
  return config;
};

/**
 * Конвертує масив VacancyStage → KANBAN_COLUMNS формат
 */
export const stagesToKanbanColumns = (stages) =>
  stages.map(s => ({
    key:   String(s.id),
    label: s.name,
    color: s.color,
    id:    s.id,
    system_key:  s.system_key,
    is_terminal: s.is_terminal,
    order: s.order,
  }));

// ─── Статичні хелпери (залишені для сумісності) ───────────────────────────────
export const getStatusLabel = (status, stages) => {
  if (stages) {
    const stage = stages.find(s => s.system_key === status || String(s.id) === String(status));
    if (stage) return stage.name;
  }
  return STATUS_CONFIG[status]?.label || status;
};

export const getStatusBg = (status, stages) => {
  if (stages) {
    const stage = stages.find(s => s.system_key === status || String(s.id) === String(status));
    if (stage) return hex2rgba(stage.color, 0.12);
  }
  return STATUS_CONFIG[status]?.bg || '#f5f5f5';
};

export const getStatusText = (status, stages) => {
  if (stages) {
    const stage = stages.find(s => s.system_key === status || String(s.id) === String(status));
    if (stage) return stage.color;
  }
  return STATUS_CONFIG[status]?.text || '#757575';
};

export const getStatusColor = (status) => STATUS_CONFIG[status]?.color || '#757575';

// ─── Source ───────────────────────────────────────────────────────────────────
export const SOURCE_CONFIG = {
  linkedin:       { label: 'LinkedIn',      color: '#0a66c2', bg: '#e8f0fe', text: '#0a66c2' },
  dou:            { label: 'DOU',           color: '#f26822', bg: '#fff3e0', text: '#f26822' },
  recommendation: { label: 'Рекомендація',  color: '#16a34a', bg: '#dcfce7', text: '#16a34a' },
  csv:            { label: 'CSV',           color: '#7c3aed', bg: '#ede9fe', text: '#7c3aed' },
  direct:         { label: 'Прямий відгук', color: '#db2777', bg: '#fce7f3', text: '#db2777' },
  other:          { label: 'Інше',          color: '#757575', bg: '#f5f5f5', text: '#757575' },
};

export const SOURCE_FILTERS = [
  { key: 'all',            label: 'Всі джерела' },
  { key: 'linkedin',       label: 'LinkedIn' },
  { key: 'dou',            label: 'DOU' },
  { key: 'recommendation', label: 'Рекомендація' },
  { key: 'csv',            label: 'CSV' },
  { key: 'direct',         label: 'Прямий відгук' },
  { key: 'other',          label: 'Інше' },
];

export const getSourceLabel  = (source) => SOURCE_CONFIG[source]?.label  || source || '—';
export const getSourceBg     = (source) => SOURCE_CONFIG[source]?.bg     || '#f5f5f5';
export const getSourceText   = (source) => SOURCE_CONFIG[source]?.text   || '#757575';
export const getSourceColor  = (source) => SOURCE_CONFIG[source]?.color  || '#757575';

// ─── Avatar / Tag colors ──────────────────────────────────────────────────────
export const HR_AVATAR_COLORS = [
  '#7a1a2e','#b03050','#8a3a5a','#e8a0b0',
  '#c94f2a','#16a34a','#2563eb','#7c3aed',
  '#db2777','#0891b2','#ca8a04','#4f46e5',
];
export const getHrAvatarColor = (userId) => {
  if (!userId) return '#71717a';
  return HR_AVATAR_COLORS[userId % HR_AVATAR_COLORS.length];
};

export const TAG_COLORS = [
  '#7a1a2e','#b03050','#8a3a5a','#e8a0b0',
  '#c94f2a','#16a34a','#2563eb','#7c3aed',
  '#db2777','#0891b2','#ca8a04','#4f46e5',
  '#059669','#dc2626','#7c2d12','#4338ca',
];
export const getTagColor = (index) => TAG_COLORS[index % TAG_COLORS.length];

// ─── Internal helper ──────────────────────────────────────────────────────────
function hex2rgba(hex, alpha = 0.12) {
  if (!hex || hex.length < 7) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}