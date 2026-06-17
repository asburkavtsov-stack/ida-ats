import React, { useState, useRef, useEffect, useCallback } from 'react';

// ─── Конфігурація токенів ──────────────────────────────────────────────────────
const TOKEN_CONFIG = {
  source: {
    label: 'Джерело',
    color: '#7c3aed',
    bg: '#ede9fe',
    values: ['linkedin', 'dou', 'work_ua', 'rabota_ua', 'recommendation', 'direct', 'csv', 'other'],
  },
  status: {
    label: 'Статус',
    color: '#0369a1',
    bg: '#e0f2fe',
    values: ['new', 'screening', 'interview', 'offer', 'rejected'],
  },
  hr: {
    label: 'HR',
    color: '#065f46',
    bg: '#d1fae5',
    values: [], // динамічно (username HRів)
  },
  tags: {
    label: 'Теги',
    color: '#b45309',
    bg: '#fef3c7',
    values: [], // динамічно
  },
  vacancy: {
    label: 'Вакансія',
    color: '#be185d',
    bg: '#fce7f3',
    values: [],
  },
  notes: {
    label: 'Нотатки',
    color: '#6b7280',
    bg: '#f3f4f6',
    values: [],
  },
  email: {
    label: 'Email',
    color: '#1d4ed8',
    bg: '#dbeafe',
    values: [],
  },
  phone: {
    label: 'Телефон',
    color: '#1d4ed8',
    bg: '#dbeafe',
    values: [],
  },
};

const STATUS_LABELS = {
  new: 'Новий',
  screening: 'Скринінг',
  interview: "Інтерв'ю",
  offer: 'Оффер',
  rejected: 'Відмова',
};

const SOURCE_LABELS = {
  linkedin: 'LinkedIn',
  dou: 'DOU',
  work_ua: 'Work.ua',
  rabota_ua: 'Rabota.ua',
  recommendation: 'Рекомендація',
  direct: 'Прямий',
  csv: 'CSV',
  other: 'Інше',
};

// ─── Парсер (дзеркало бекенду, для відображення токенів) ──────────────────────
function parseQuery(raw) {
  const tokens = [];
  const tokenRe = /(\w+):"([^"]+)"|(\w+):(\S+)/g;
  let remaining = raw;
  let m;

  while ((m = tokenRe.exec(raw)) !== null) {
    const key = (m[1] || m[3]).toLowerCase();
    const value = (m[2] || m[4]).trim();
    if (TOKEN_CONFIG[key]) {
      tokens.push({ key, value, raw: m[0] });
      remaining = remaining.replace(m[0], '');
    }
  }

  const text = remaining.trim();
  return { tokens, text };
}

// ─── Dropdown suggestions ──────────────────────────────────────────────────────
function Suggestions({ items, onSelect, style }) {
  if (!items.length) return null;
  return (
    <div style={{
      position: 'absolute',
      top: '100%',
      left: 0,
      zIndex: 9999,
      marginTop: 4,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      minWidth: 200,
      maxHeight: 260,
      overflowY: 'auto',
      ...style,
    }}>
      {items.map((item, i) => (
        <button
          key={i}
          onMouseDown={e => { e.preventDefault(); onSelect(item); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '8px 12px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: '0.82rem',
            fontFamily: 'DM Sans',
            color: 'var(--text)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          {item.prefix && (
            <span style={{
              fontWeight: 600,
              color: item.color || 'var(--accent)',
              fontSize: '0.78rem',
            }}>
              {item.prefix}
            </span>
          )}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Один токен-чип ────────────────────────────────────────────────────────────
function TokenChip({ tokenKey, value, onRemove }) {
  const cfg = TOKEN_CONFIG[tokenKey] || {};
  const displayVal =
    tokenKey === 'status' ? (STATUS_LABELS[value] || value) :
    tokenKey === 'source' ? (SOURCE_LABELS[value] || value) :
    value;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      borderRadius: 20,
      background: cfg.bg || '#f3f4f6',
      color: cfg.color || '#374151',
      fontSize: '0.78rem',
      fontWeight: 500,
      whiteSpace: 'nowrap',
      fontFamily: 'DM Sans',
    }}>
      <span style={{ opacity: 0.7, fontSize: '0.72rem' }}>{cfg.label || tokenKey}:</span>
      <span>{displayVal}</span>
      <button
        onClick={onRemove}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0 2px',
          color: cfg.color || '#6b7280',
          fontSize: '0.75rem',
          lineHeight: 1,
          opacity: 0.7,
          display: 'flex',
          alignItems: 'center',
        }}
        aria-label={`Видалити ${tokenKey}:${value}`}
      >
        ✕
      </button>
    </span>
  );
}

// ─── Головний компонент ────────────────────────────────────────────────────────
export default function AdvancedSearchBar({ value = '', onChange, isMobile, placeholder }) {
  const [inputVal, setInputVal] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const wrapRef = useRef(null);

  // Синхронізуємо зовнішній value → внутрішній при першому рендері або reset
  useEffect(() => {
    if (value === '') setInputVal('');
  }, [value]);

  const { tokens, text } = parseQuery(value);

  // ── Генерація підказок ─────────────────────────────────────────────────────
  const buildSuggestions = useCallback((raw) => {
    const lastWord = raw.split(/\s+/).pop() || '';

    // Вже введено "key:" → підказуємо значення
    const keyValMatch = lastWord.match(/^(\w+):(.*)$/);
    if (keyValMatch) {
      const key = keyValMatch[1].toLowerCase();
      const partial = keyValMatch[2].toLowerCase();
      const cfg = TOKEN_CONFIG[key];
      if (cfg && cfg.values.length) {
        return cfg.values
          .filter(v => v.startsWith(partial))
          .map(v => ({
            label: key === 'status' ? (STATUS_LABELS[v] || v) : key === 'source' ? (SOURCE_LABELS[v] || v) : v,
            prefix: `${key}:`,
            color: cfg.color,
            insert: `${key}:${v}`,
          }));
      }
      return [];
    }

    // Підказуємо ключі
    const partial = lastWord.toLowerCase();
    if (!partial) {
      // Показати всі доступні токени як підказку
      return Object.entries(TOKEN_CONFIG)
        .filter(([k]) => !tokens.find(t => t.key === k)) // не показувати вже додані
        .map(([k, cfg]) => ({
          label: `${k}: — ${cfg.label}`,
          prefix: null,
          color: cfg.color,
          insert: `${k}:`,
        }));
    }
    return Object.entries(TOKEN_CONFIG)
      .filter(([k, cfg]) => k.startsWith(partial) && !tokens.find(t => t.key === k))
      .map(([k, cfg]) => ({
        label: `${k}: — ${cfg.label}`,
        prefix: null,
        color: cfg.color,
        insert: `${k}:`,
      }));
  }, [tokens]);

  // ── Обробка вводу ──────────────────────────────────────────────────────────
  const handleInputChange = (e) => {
    const raw = e.target.value;
    setInputVal(raw);

    // Знаходимо нові токени в рядку
    const { tokens: newTokens, text: newText } = parseQuery(value + ' ' + raw);

    if (newTokens.length > tokens.length) {
      // Новий токен розпізнано → додаємо до повного query і чистимо input
      const addedToken = newTokens[newTokens.length - 1];
      const newQuery = (value + ' ' + addedToken.raw).trim();
      onChange(newQuery);
      setInputVal('');
      setSuggestions([]);
    } else {
      // Оновлюємо suggestions
      setSuggestions(buildSuggestions(raw));
    }
  };

  const handleKeyDown = (e) => {
    // Backspace на порожньому input → видаляємо останній токен
    if (e.key === 'Backspace' && inputVal === '' && tokens.length) {
      const lastToken = tokens[tokens.length - 1];
      const newQuery = value.replace(lastToken.raw, '').trim();
      onChange(newQuery);
    }
    // Enter → підтверджуємо вільний текст
    if (e.key === 'Enter' && inputVal.trim()) {
      const combined = (value + ' ' + inputVal.trim()).trim();
      onChange(combined);
      setInputVal('');
      setSuggestions([]);
    }
    // Escape → закриваємо suggestions
    if (e.key === 'Escape') {
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = (item) => {
    if (item.insert.endsWith(':')) {
      // Вибрано ключ → вставляємо "key:" в input для продовження
      const lastWord = inputVal.split(/\s+/).pop() || '';
      const prefix = inputVal.slice(0, inputVal.length - lastWord.length);
      setInputVal(prefix + item.insert);
      setSuggestions(buildSuggestions(item.insert));
    } else {
      // Вибрано повний токен key:value
      const lastWord = inputVal.split(/\s+/).pop() || '';
      const prefix = inputVal.slice(0, inputVal.length - lastWord.length);
      const newToken = item.insert;
      const newQuery = (value + ' ' + newToken).trim();
      onChange(newQuery);
      setInputVal(prefix.trim());
      setSuggestions([]);
    }
    inputRef.current?.focus();
  };

  const removeToken = (tokenRaw) => {
    const newQuery = value.replace(tokenRaw, '').replace(/\s+/g, ' ').trim();
    onChange(newQuery);
  };

  const clearAll = () => {
    onChange('');
    setInputVal('');
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const hasContent = tokens.length > 0 || inputVal || text;

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
    >
      <div
        onClick={() => inputRef.current?.focus()}
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'nowrap',
          gap: 6,
          background: 'var(--bg)',
          border: `1px solid ${focused ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 8,
          padding: '5px 10px',
          width: isMobile ? 160 : 320,
          minHeight: 34,
          cursor: 'text',
          transition: 'border-color 0.15s, width 0.2s',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
        }}
      >
        <span style={{ color: 'var(--muted)', fontSize: '0.9rem', flexShrink: 0 }}>🔍</span>

        {/* Токен-чипи */}
        {tokens.map((t, i) => (
          <TokenChip
            key={i}
            tokenKey={t.key}
            value={t.value}
            onRemove={() => removeToken(t.raw)}
          />
        ))}

        {/* Вільний текст як чип */}
        {text && !inputVal && (
          <span style={{ fontSize: '0.82rem', color: 'var(--text)', whiteSpace: 'nowrap', fontFamily: 'DM Sans' }}>
            {text}
          </span>
        )}

        {/* Input */}
        <input
          ref={inputRef}
          value={inputVal}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setFocused(true);
            if (!inputVal) setSuggestions(buildSuggestions(''));
          }}
          onBlur={() => {
            setFocused(false);
            setTimeout(() => setSuggestions([]), 150);
            // Зберігаємо вільний текст при blur
            if (inputVal.trim() && !inputVal.includes(':')) {
              onChange((value + ' ' + inputVal.trim()).trim());
              setInputVal('');
            }
          }}
          placeholder={hasContent ? '' : (placeholder || (isMobile ? 'Пошук...' : 'source:linkedin status:interview...'))}
          style={{
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: '0.82rem',
            fontFamily: 'DM Sans',
            color: 'var(--text)',
            minWidth: 80,
            flex: 1,
          }}
        />

        {/* Кнопка очищення */}
        {hasContent && (
          <button
            onClick={clearAll}
            aria-label="Очистити пошук"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted)',
              fontSize: '0.8rem',
              flexShrink: 0,
              padding: '0 2px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown підказок */}
      {focused && (
        <Suggestions
          items={suggestions}
          onSelect={handleSelectSuggestion}
        />
      )}
    </div>
  );
}