// components/JobBoardSelector.js
// Модальне вікно: вибір job board для публікації вакансії
import React, { useState } from 'react';
import axios from 'axiosConfig';

// ─── Конфігурація платформ ────────────────────────────────────────────────────

const JOB_BOARDS = [
  {
    key: 'rabota_ua',
    name: 'Rabota.ua',
    icon: '🇺🇦',
    color: '#0066cc',
    bgColor: '#e8f4fd',
    description: 'Публікація через Employer API або XML-фід',
    publishedField: 'published_rabota_ua',
    publishedAtField: 'published_at_rabota_ua',
    urlField: null,
    requiresUrl: false,
  },
  {
    key: 'work_ua',
    name: 'Work.ua',
    icon: '💼',
    color: '#e65c00',
    bgColor: '#fff3e0',
    description: 'Публікація через XML-фід (автоімпорт щогодини)',
    publishedField: 'published_work_ua',
    publishedAtField: 'published_at_work_ua',
    urlField: null,
    requiresUrl: false,
  },
  {
    key: 'dou',
    name: 'DOU',
    icon: '👨‍💻',
    color: '#1a56db',
    bgColor: '#e8f0fe',
    description: 'Ручна публікація — потрібно вставити URL після публікації',
    publishedField: 'published_dou',
    publishedAtField: 'published_at_dou',
    urlField: 'dou_vacancy_url',
    requiresUrl: true,
  },
  {
    key: 'linkedin',
    name: 'LinkedIn',
    icon: '🔗',
    color: '#0a66c2',
    bgColor: '#e7f3ff',
    description: 'Deep link для публікації + збереження URL вакансії',
    publishedField: 'published_linkedin',
    publishedAtField: 'published_at_linkedin',
    urlField: 'linkedin_vacancy_url',
    requiresUrl: true,
  },
];

// ─── Хелпери ──────────────────────────────────────────────────────────────────

function formatDate(isoStr) {
  if (!isoStr) return null;
  return new Date(isoStr).toLocaleDateString('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

// ─── Картка однієї платформи ──────────────────────────────────────────────────

function BoardCard({ board, vacancy, onPublish, onUnpublish, isMobile }) {
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success'|'info'|'error', text }

  const isPublished = vacancy[board.publishedField];
  const publishedAt = vacancy[board.publishedAtField];
  const existingUrl = board.urlField ? vacancy[board.urlField] : null;

  const handlePublishClick = async () => {
    // Якщо потрібен URL і його ще немає — показуємо поле
    if (board.requiresUrl && !urlInput.trim()) {
      setShowUrlInput(true);
      // Для DOU/LinkedIn спочатку отримуємо інструкції або deep link
      if (!showUrlInput) {
        setLoading(true);
        try {
          const res = await axios.post(`/api/vacancies/${vacancy.id}/publish/`, {
            platform: board.key,
            url: '',
          });
          const data = res.data;
          if (data.linkedin_share_url) {
            setMessage({ type: 'info', text: null, shareUrl: data.linkedin_share_url });
          } else if (data.instructions) {
            setMessage({ type: 'info', steps: data.instructions.steps });
          }
        } catch {
          // ігноруємо — просто показуємо поле для URL
        } finally {
          setLoading(false);
        }
      }
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const payload = { platform: board.key };
      if (board.requiresUrl && urlInput.trim()) {
        payload.url = urlInput.trim();
      }
      const res = await axios.post(`/api/vacancies/${vacancy.id}/publish/`, payload);
      const data = res.data;

      if (data.success) {
        setMessage({ type: 'success', text: `Опубліковано ${board.name}!` });
        setShowUrlInput(false);
        setUrlInput('');
        onPublish(board.key, data);
      } else if (data.feed_url) {
        setMessage({ type: 'info', text: `XML-фід: ${data.feed_url}`, feedUrl: data.feed_url });
        onPublish(board.key, data);
      } else if (data.linkedin_share_url) {
        setMessage({ type: 'info', text: null, shareUrl: data.linkedin_share_url });
        setShowUrlInput(true);
      } else if (data.instructions) {
        setMessage({ type: 'info', steps: data.instructions.steps });
        setShowUrlInput(true);
      } else if (data.error) {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err) {
      const errText = err.response?.data?.error || 'Помилка публікації';
      setMessage({ type: 'error', text: errText });
    } finally {
      setLoading(false);
    }
  };

  const handleUnpublish = async () => {
    if (!window.confirm(`Зняти публікацію з ${board.name}?`)) return;
    setLoading(true);
    try {
      await axios.post(`/api/vacancies/${vacancy.id}/unpublish/`, { platform: board.key });
      setMessage(null);
      onUnpublish(board.key);
    } catch (err) {
      const errText = err.response?.data?.error || 'Зняття через API не підтримується для цієї платформи';
      setMessage({ type: 'error', text: errText });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      border: `1.5px solid ${isPublished ? board.color + '55' : 'var(--border)'}`,
      borderRadius: '12px',
      background: isPublished ? board.bgColor : 'var(--surface)',
      padding: '16px',
      transition: 'all 0.15s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <span style={{ fontSize: '1.4rem' }}>{board.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text)' }}>
            {board.name}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '1px' }}>
            {board.description}
          </div>
        </div>
        {/* Статус-бейдж */}
        {isPublished && (
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, fontFamily: 'DM Mono',
            padding: '2px 8px', borderRadius: '4px',
            background: board.color + '22', color: board.color,
          }}>
            ✓ Активно
          </span>
        )}
      </div>

      {/* Інфо про публікацію */}
      {isPublished && publishedAt && (
        <div style={{ fontSize: '0.7rem', color: board.color, fontFamily: 'DM Mono', marginBottom: '8px' }}>
          Опубліковано {formatDate(publishedAt)}
          {existingUrl && (
            <>
              {' · '}
              <a href={existingUrl} target="_blank" rel="noopener noreferrer"
                style={{ color: board.color }}>
                Переглянути ↗
              </a>
            </>
          )}
        </div>
      )}

      {/* Повідомлення */}
      {message && (
        <div style={{
          marginBottom: '10px',
          padding: '8px 10px',
          borderRadius: '8px',
          fontSize: '0.75rem',
          fontFamily: 'DM Mono',
          background: message.type === 'success' ? '#dcfce7' :
                      message.type === 'error' ? '#fee2e2' : '#f0f9ff',
          color: message.type === 'success' ? '#16a34a' :
                 message.type === 'error' ? '#dc2626' : '#0369a1',
          wordBreak: 'break-all',
        }}>
          {message.text && <div>{message.text}</div>}
          {message.feedUrl && (
            <div style={{ marginTop: '4px' }}>
              <a href={message.feedUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1' }}>
                Відкрити XML-фід ↗
              </a>
            </div>
          )}
          {message.shareUrl && (
            <div>
              <a href={message.shareUrl} target="_blank" rel="noopener noreferrer"
                style={{ color: '#0369a1', fontWeight: 700 }}>
                Відкрити LinkedIn для публікації ↗
              </a>
              <div style={{ marginTop: '4px', color: '#0369a1' }}>
                Після публікації вставте URL вакансії нижче
              </div>
            </div>
          )}
          {message.steps && (
            <ol style={{ margin: '4px 0 0 16px', padding: 0 }}>
              {message.steps.map((s, i) => <li key={i} style={{ marginBottom: '2px' }}>{s}</li>)}
            </ol>
          )}
        </div>
      )}

      {/* Поле введення URL */}
      {showUrlInput && (
        <div style={{ marginBottom: '10px' }}>
          <input
            type="url"
            placeholder={`URL вакансії на ${board.name}...`}
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontFamily: 'DM Mono',
              background: 'var(--bg)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {/* Кнопки дій */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {!isPublished ? (
          <button
            onClick={handlePublishClick}
            disabled={loading}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: 'none',
              background: board.color,
              color: '#fff',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              display: 'flex', alignItems: 'center', gap: '5px',
            }}
          >
            {loading ? '...' : `Опублікувати на ${board.name}`}
          </button>
        ) : (
          <>
            <button
              onClick={handlePublishClick}
              disabled={loading}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: `1px solid ${board.color}`,
                background: 'transparent',
                color: board.color,
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? '...' : 'Оновити'}
            </button>
            <button
              onClick={handleUnpublish}
              disabled={loading}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: '1px solid #fee2e2',
                background: 'transparent',
                color: '#dc2626',
                fontSize: '0.78rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              Зняти
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Основний компонент модалки ───────────────────────────────────────────────

function JobBoardSelector({ vacancy, onClose, onUpdated }) {
  const [localVacancy, setLocalVacancy] = useState(vacancy);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  React.useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const publishedCount = JOB_BOARDS.filter(b => localVacancy[b.publishedField]).length;

  const handlePublish = (platformKey, data) => {
    // Оновлюємо локальний стан вакансії
    const board = JOB_BOARDS.find(b => b.key === platformKey);
    if (!board) return;
    const updates = {
      [board.publishedField]: true,
      [board.publishedAtField]: new Date().toISOString(),
    };
    if (board.urlField && data.url) {
      updates[board.urlField] = data.url;
    }
    setLocalVacancy(prev => ({ ...prev, ...updates }));
    if (onUpdated) onUpdated();
  };

  const handleUnpublish = (platformKey) => {
    const board = JOB_BOARDS.find(b => b.key === platformKey);
    if (!board) return;
    const updates = {
      [board.publishedField]: false,
      [board.publishedAtField]: null,
    };
    if (board.urlField) updates[board.urlField] = '';
    setLocalVacancy(prev => ({ ...prev, ...updates }));
    if (onUpdated) onUpdated();
  };

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: isMobile ? 'flex-end' : 'center',
    justifyContent: 'center',
    zIndex: 1200,
    padding: isMobile ? '0' : '16px',
  };
  const modal = {
    background: 'var(--surface)',
    borderRadius: isMobile ? '16px 16px 0 0' : '16px',
    width: '100%',
    maxWidth: isMobile ? '100%' : '560px',
    maxHeight: isMobile ? '92vh' : '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>

        {/* Шапка */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Публікація на Job Boards</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '3px' }}>
              {localVacancy.title}
              {publishedCount > 0 && (
                <span style={{
                  marginLeft: '10px',
                  padding: '1px 7px',
                  borderRadius: '4px',
                  background: '#dcfce7',
                  color: '#16a34a',
                  fontWeight: 600,
                }}>
                  {publishedCount} активних
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--muted)', lineHeight: 1 }}
            aria-label="Закрити"
          >✕</button>
        </div>

        {/* Список платформ */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {JOB_BOARDS.map(board => (
            <BoardCard
              key={board.key}
              board={board}
              vacancy={localVacancy}
              onPublish={handlePublish}
              onUnpublish={handleUnpublish}
              isMobile={isMobile}
            />
          ))}
        </div>

        {/* Підвал */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'transparent',
              cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'DM Sans',
            }}
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}

export default JobBoardSelector;