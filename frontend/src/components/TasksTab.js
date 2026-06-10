// components/TasksTab.js
// Вкладка "Завдання" в CandidateCardModal
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axiosConfig';

// ─── Константи ───────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:     { label: 'Очікує',       color: '#6b7280', bg: '#f3f4f6' },
  sent:        { label: 'Надіслано',    color: '#0369a1', bg: '#e0f2fe' },
  in_progress: { label: 'Виконується', color: '#b45309', bg: '#fef3c7' },
  submitted:   { label: 'Здано',       color: '#7c3aed', bg: '#ede9fe' },
  checking:    { label: 'Перевірка',   color: '#b45309', bg: '#fff3e0' },
  passed:      { label: 'Пройдено ✓',  color: '#16a34a', bg: '#dcfce7' },
  failed:      { label: 'Не пройдено', color: '#dc2626', bg: '#fee2e2' },
  expired:     { label: 'Час вийшов',  color: '#9ca3af', bg: '#f3f4f6' },
};

const TYPE_ICONS = {
  code: '💻', text: '📝', quiz: '📋', file: '📎', link: '🔗',
};

const LANG_COLORS = {
  python: '#3776ab', javascript: '#f7df1e', typescript: '#3178c6',
  java: '#e76f00', csharp: '#9b4f96', cpp: '#004482',
  go: '#00add8', rust: '#ce422b', sql: '#336791', other: '#6b7280',
};

// ─── Хелпери ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span style={{
      fontSize: '0.65rem', fontWeight: 700, fontFamily: 'DM Mono',
      padding: '2px 8px', borderRadius: '4px',
      background: cfg.bg, color: cfg.color,
    }}>
      {cfg.label}
    </span>
  );
}

function ScoreBar({ score, maxScore }) {
  if (score == null) return null;
  const pct = Math.round(score / maxScore * 100);
  const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#b45309' : '#dc2626';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: '0.72rem', fontFamily: 'DM Mono', fontWeight: 700, color, minWidth: '40px' }}>
        {score}/{maxScore}
      </span>
    </div>
  );
}

// ─── Модалка вибору завдання для видачі ──────────────────────────────────────

function AssignTaskModal({ candidateId, vacancyId, onClose, onAssigned }) {
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);
  const [error, setError]     = useState('');

  useEffect(() => {
    axios.get('/api/tasks/', { params: { is_active: 'true' } })
      .then(res => setTasks(res.data))
      .catch(() => setError('Помилка завантаження'))
      .finally(() => setLoading(false));
  }, []);

  const handleAssign = async (taskId) => {
    setAssigning(taskId);
    setError('');
    try {
      const res = await axios.post(`/api/tasks/${taskId}/assign/${candidateId}/`);
      onAssigned(res.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Помилка видачі завдання');
    } finally {
      setAssigning(null);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1300, padding: '16px',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', borderRadius: '16px',
        width: '100%', maxWidth: '540px', maxHeight: '80vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
      }} onClick={e => e.stopPropagation()}>

        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Видати завдання</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--muted)' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {error && <div style={{ color: '#dc2626', fontSize: '0.8rem', fontFamily: 'DM Mono' }}>{error}</div>}
          {loading ? (
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'center', padding: '32px 0' }}>Завантаження...</div>
          ) : tasks.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📋</div>
              Немає активних завдань. Спочатку створіть завдання у розділі "Завдання".
            </div>
          ) : tasks.map(task => (
            <div key={task.id} style={{
              border: '1px solid var(--border)', borderRadius: '10px',
              padding: '14px', display: 'flex', gap: '12px', alignItems: 'flex-start',
              background: 'var(--bg)',
            }}>
              <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{TYPE_ICONS[task.task_type]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '3px' }}>{task.title}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'DM Mono', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span>{task.task_type_display}</span>
                  {task.language && <span style={{ color: LANG_COLORS[task.language] || '#6b7280' }}>• {task.language_display}</span>}
                  <span>• {task.time_limit_minutes} хв</span>
                  <span>• {task.max_score} балів</span>
                </div>
                {task.vacancy_title && (
                  <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '3px', fontFamily: 'DM Mono' }}>
                    📌 {task.vacancy_title}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleAssign(task.id)}
                disabled={assigning === task.id}
                style={{
                  padding: '7px 14px', borderRadius: '8px', border: 'none',
                  background: 'var(--accent)', color: '#fff',
                  fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                  flexShrink: 0, opacity: assigning === task.id ? 0.6 : 1,
                }}
              >
                {assigning === task.id ? '...' : 'Видати'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Панель результату авто-перевірки ─────────────────────────────────────────

function AutoCheckResult({ result }) {
  const [expanded, setExpanded] = useState(false);
  if (!result) return null;
  const { passed, total, score, results = [] } = result;

  return (
    <div style={{ marginTop: '10px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', padding: '10px 14px',
          background: passed === total ? '#dcfce7' : '#fee2e2',
          border: 'none', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontFamily: 'DM Mono', fontSize: '0.78rem',
          color: passed === total ? '#16a34a' : '#dc2626',
        }}
      >
        <span>
          {passed === total ? '✓' : '✗'} Авто-перевірка: {passed}/{total} тестів пройдено — {score} балів
        </span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ background: 'var(--bg)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {results.map((r, i) => (
            <div key={i} style={{
              padding: '8px 10px', borderRadius: '6px',
              background: r.passed ? '#dcfce733' : '#fee2e233',
              border: `1px solid ${r.passed ? '#16a34a33' : '#dc262633'}`,
              fontSize: '0.72rem', fontFamily: 'DM Mono',
            }}>
              <div style={{ fontWeight: 700, color: r.passed ? '#16a34a' : '#dc2626', marginBottom: '4px' }}>
                {r.passed ? '✓' : '✗'} Тест {r.test_case} {r.timed_out ? '(таймаут)' : ''} — {r.execution_ms}ms
              </div>
              {r.input !== '🔒 прихований' && (
                <div>Input: <code>{r.input || '(порожньо)'}</code></div>
              )}
              {!r.passed && r.expected_output !== '🔒 прихований' && (
                <>
                  <div>Очікувалось: <code style={{ color: '#16a34a' }}>{r.expected_output}</code></div>
                  <div>Отримано: <code style={{ color: '#dc2626' }}>{r.actual_output}</code></div>
                </>
              )}
              {r.stderr && <div style={{ color: '#dc2626', marginTop: '4px' }}>Stderr: {r.stderr}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Картка одного завдання (assignment) ──────────────────────────────────────

function AssignmentCard({ assignment, onReviewed, isMobile }) {
  const [expanded, setExpanded]   = useState(false);
  const [hrScore, setHrScore]     = useState(assignment.score ?? '');
  const [hrComment, setHrComment] = useState(assignment.hr_comment || '');
  const [saving, setSaving]       = useState(false);
  const [checking, setChecking]   = useState(false);
  const [msg, setMsg]             = useState('');

  const sub  = assignment.submission;

  const handleReview = async () => {
    setSaving(true);
    setMsg('');
    try {
      const res = await axios.patch(`/api/task-assignments/${assignment.id}/review/`, {
        score: Number(hrScore),
        hr_comment: hrComment,
      });
      setMsg('Збережено ✓');
      onReviewed(res.data);
    } catch (e) {
      setMsg(e.response?.data?.error || 'Помилка збереження');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoCheck = async () => {
    setChecking(true);
    setMsg('');
    try {
      const res = await axios.post(`/api/task-assignments/${assignment.id}/check/`);
      onReviewed(res.data.assignment);
      setMsg('Перевірка завершена');
    } catch (e) {
      setMsg(e.response?.data?.error || 'Помилка перевірки');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: '12px',
      background: 'var(--surface)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          padding: '14px 16px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}
      >
        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{TYPE_ICONS[assignment.task_type] || '📋'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '3px' }}>{assignment.task_title}</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusBadge status={assignment.status} />
            {assignment.task_language && (
              <span style={{
                fontSize: '0.62rem', fontFamily: 'DM Mono', fontWeight: 700,
                padding: '2px 6px', borderRadius: '3px',
                background: (LANG_COLORS[assignment.task_language] || '#6b7280') + '22',
                color: LANG_COLORS[assignment.task_language] || '#6b7280',
              }}>
                {assignment.task_language}
              </span>
            )}
            {assignment.deadline && (
              <span style={{ fontSize: '0.62rem', fontFamily: 'DM Mono', color: 'var(--muted)' }}>
                до {new Date(assignment.deadline).toLocaleDateString('uk-UA')}
              </span>
            )}
          </div>
          {assignment.score != null && (
            <div style={{ marginTop: '6px' }}>
              <ScoreBar score={assignment.score} maxScore={assignment.max_score} />
            </div>
          )}
        </div>
        <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>

          {/* Відповідь кандидата */}
          {sub && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 600, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: '6px' }}>
                Відповідь кандидата
              </div>

              {sub.code_answer && (
                <pre style={{
                  background: '#1e1e1e', color: '#d4d4d4',
                  padding: '12px', borderRadius: '8px',
                  fontSize: '0.75rem', fontFamily: 'DM Mono',
                  overflowX: 'auto', lineHeight: '1.5', maxHeight: '280px', overflowY: 'auto',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {sub.code_answer}
                </pre>
              )}

              {sub.text_answer && (
                <div style={{
                  padding: '10px 12px', background: 'var(--bg)',
                  borderRadius: '8px', border: '1px solid var(--border)',
                  fontSize: '0.82rem', lineHeight: '1.55', whiteSpace: 'pre-wrap',
                }}>
                  {sub.text_answer}
                </div>
              )}

              {sub.link_url && (
                <a href={sub.link_url} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--accent)', fontSize: '0.82rem', fontFamily: 'DM Mono' }}>
                  🔗 {sub.link_url}
                </a>
              )}

              {sub.selected_options?.length > 0 && (
                <div style={{ fontSize: '0.78rem', fontFamily: 'DM Mono', color: 'var(--text)' }}>
                  Обрані варіанти: {sub.selected_options.join(', ')}
                </div>
              )}

              {sub.submitted_at && (
                <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '6px' }}>
                  Здано: {new Date(sub.submitted_at).toLocaleString('uk-UA')}
                </div>
              )}
            </div>
          )}

          {/* Авто-перевірка */}
          {assignment.auto_result && (
            <AutoCheckResult result={assignment.auto_result} />
          )}

          {/* Кнопка авто-перевірки для code */}
          {assignment.task_type === 'code' && sub && !assignment.auto_result && (
            <button
              onClick={handleAutoCheck}
              disabled={checking}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none',
                background: '#1e1e1e', color: '#d4d4d4',
                fontSize: '0.78rem', fontFamily: 'DM Mono', cursor: 'pointer',
                marginBottom: '12px', opacity: checking ? 0.6 : 1,
              }}
            >
              {checking ? '⏳ Перевірка...' : '▶ Запустити авто-перевірку'}
            </button>
          )}

          {/* HR оцінка */}
          {sub && (
            <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 600, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: '10px' }}>
                Оцінка HR
              </div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'DM Mono', display: 'block', marginBottom: '4px' }}>
                    Бали (макс. {assignment.max_score})
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={assignment.max_score}
                    value={hrScore}
                    onChange={e => setHrScore(e.target.value)}
                    style={{
                      width: '80px', padding: '6px 8px',
                      border: '1px solid var(--border)', borderRadius: '6px',
                      background: 'var(--surface)', fontSize: '0.85rem',
                      fontFamily: 'DM Mono', color: 'var(--text)', outline: 'none',
                    }}
                  />
                </div>
              </div>
              <textarea
                placeholder="Коментар HR (необов'язково)..."
                value={hrComment}
                onChange={e => setHrComment(e.target.value)}
                rows={2}
                style={{
                  width: '100%', padding: '8px 10px',
                  border: '1px solid var(--border)', borderRadius: '6px',
                  background: 'var(--surface)', fontSize: '0.8rem',
                  fontFamily: 'DM Sans', color: 'var(--text)',
                  resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                  marginBottom: '8px',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={handleReview}
                  disabled={saving || hrScore === ''}
                  style={{
                    padding: '7px 16px', borderRadius: '8px', border: 'none',
                    background: 'var(--accent)', color: '#fff',
                    fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                    opacity: (saving || hrScore === '') ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Збереження...' : 'Зберегти оцінку'}
                </button>
                {msg && (
                  <span style={{
                    fontSize: '0.72rem', fontFamily: 'DM Mono',
                    color: msg.includes('✓') ? '#16a34a' : '#dc2626',
                  }}>
                    {msg}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* HR-коментар (якщо вже є) */}
          {assignment.hr_comment && !sub && (
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'DM Mono', fontStyle: 'italic' }}>
              Коментар: {assignment.hr_comment}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Головний компонент вкладки ───────────────────────────────────────────────

function TasksTab({ candidate, isMobile }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showAssign, setShowAssign]   = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    axios.get(`/api/candidates/${candidate.id}/tasks/`)
      .then(res => setAssignments(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [candidate.id]);

  useEffect(() => { load(); }, [load]);

  const handleAssigned = (newAssignment) => {
    setAssignments(prev => [newAssignment, ...prev]);
    setShowAssign(false);
  };

  const handleReviewed = (updated) => {
    setAssignments(prev => prev.map(a => a.id === updated.id ? updated : a));
  };

  const total    = assignments.length;
  const passed   = assignments.filter(a => a.status === 'passed').length;
  const avgScore = assignments.filter(a => a.score != null).length
    ? Math.round(assignments.filter(a => a.score != null).reduce((s, a) => s + a.score_percent, 0) / assignments.filter(a => a.score != null).length)
    : null;

  return (
    <div style={{ padding: isMobile ? '12px' : '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Зведення */}
      {total > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
        }}>
          {[
            { label: 'Всього', value: total, color: 'var(--text)' },
            { label: 'Пройдено', value: passed, color: '#16a34a' },
            { label: 'Середній %', value: avgScore != null ? `${avgScore}%` : '—', color: avgScore >= 60 ? '#16a34a' : '#dc2626' },
          ].map(stat => (
            <div key={stat.label} style={{
              padding: '10px', borderRadius: '8px',
              background: 'var(--bg)', border: '1px solid var(--border)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'DM Mono', color: stat.color }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '0.62rem', color: 'var(--muted)', fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Кнопка видати */}
      <button
        onClick={() => setShowAssign(true)}
        style={{
          padding: '9px 16px', borderRadius: '8px',
          border: '1px dashed var(--accent)',
          background: 'transparent', color: 'var(--accent)',
          fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        }}
      >
        + Видати завдання
      </button>

      {/* Список завдань */}
      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: '0.82rem', fontFamily: 'DM Mono', textAlign: 'center', padding: '24px 0' }}>
          Завантаження...
        </div>
      ) : assignments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📋</div>
          <div style={{ fontSize: '0.85rem' }}>Завдань ще немає</div>
          <div style={{ fontSize: '0.72rem', fontFamily: 'DM Mono', marginTop: '4px' }}>
            Натисніть "Видати завдання" щоб додати
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {assignments.map(a => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              onReviewed={handleReviewed}
              isMobile={isMobile}
            />
          ))}
        </div>
      )}

      {/* Модалка вибору завдання */}
      {showAssign && (
        <AssignTaskModal
          candidateId={candidate.id}
          vacancyId={candidate.vacancy}
          onClose={() => setShowAssign(false)}
          onAssigned={handleAssigned}
        />
      )}
    </div>
  );
}

export default TasksTab;