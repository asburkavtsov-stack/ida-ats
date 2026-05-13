export const STATUS_CONFIG = {
  new:       { label: 'Новий',      bg: '#f9eaed', text: '#7a1a2e', color: '#7a1a2e' },
  screening: { label: 'Скринінг',   bg: '#fff3e0', text: '#c94f2a', color: '#b03050' },
  interview: { label: 'Співбесіда', bg: '#f5eaf0', text: '#8a3a5a', color: '#8a3a5a' },
  offer:     { label: 'Оффер',      bg: '#fce4ec', text: '#c2185b', color: '#e8a0b0' },
  rejected:  { label: 'Відмова',    bg: '#f5f5f5', text: '#757575', color: '#aaaaaa' },
};

export const STATUS_FILTERS = [
  { key: 'all',       label: 'Всі'        },
  { key: 'new',       label: 'Нові'       },
  { key: 'screening', label: 'Скринінг'   },
  { key: 'interview', label: 'Співбесіда' },
  { key: 'offer',     label: 'Оффер'      },
  { key: 'rejected',  label: 'Відмова'    },
];

export const KANBAN_COLUMNS = [
  { key: 'new',       label: 'Нові',       color: '#7a1a2e' },
  { key: 'screening', label: 'Скринінг',   color: '#b03050' },
  { key: 'interview', label: 'Співбесіда', color: '#8a3a5a' },
  { key: 'offer',     label: 'Оффер',      color: '#e8a0b0' },
  { key: 'rejected',  label: 'Відмова',    color: '#aaaaaa' },
];

export const getStatusLabel = (status) => STATUS_CONFIG[status]?.label || status;
export const getStatusBg = (status) => STATUS_CONFIG[status]?.bg || '#f5f5f5';
export const getStatusText = (status) => STATUS_CONFIG[status]?.text || '#757575';
export const getStatusColor = (status) => STATUS_CONFIG[status]?.color || '#757575';

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

export const getSourceLabel = (source) => SOURCE_CONFIG[source]?.label || source || '—';
export const getSourceBg = (source) => SOURCE_CONFIG[source]?.bg || '#f5f5f5';
export const getSourceText = (source) => SOURCE_CONFIG[source]?.text || '#757575';
export const getSourceColor = (source) => SOURCE_CONFIG[source]?.color || '#757575';

export const HR_AVATAR_COLORS = [
  '#7a1a2e', '#b03050', '#8a3a5a', '#e8a0b0',
  '#c94f2a', '#16a34a', '#2563eb', '#7c3aed',
  '#db2777', '#0891b2', '#ca8a04', '#4f46e5',
];

export const getHrAvatarColor = (userId) => {
  if (!userId) return '#71717a';
  return HR_AVATAR_COLORS[userId % HR_AVATAR_COLORS.length];
};

export const TAG_COLORS = [
  '#7a1a2e', '#b03050', '#8a3a5a', '#e8a0b0',
  '#c94f2a', '#16a34a', '#2563eb', '#7c3aed',
  '#db2777', '#0891b2', '#ca8a04', '#4f46e5',
  '#059669', '#dc2626', '#7c2d12', '#4338ca',
];

export const getTagColor = (index) => TAG_COLORS[index % TAG_COLORS.length];