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