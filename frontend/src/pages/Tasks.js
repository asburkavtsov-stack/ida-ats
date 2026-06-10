// pages/Tasks.js
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axiosConfig';

// ─── Константи ────────────────────────────────────────────────────────────────

const TASK_TYPES = [
  { key: 'code',  label: 'Код',        icon: '💻' },
  { key: 'text',  label: 'Текст',      icon: '📝' },
  { key: 'quiz',  label: 'Тест',       icon: '📋' },
  { key: 'file',  label: 'Файл',       icon: '📎' },
  { key: 'link',  label: 'Посилання',  icon: '🔗' },
];

const LANGUAGES = [
  { key: 'python',     label: 'Python' },
  { key: 'javascript', label: 'JavaScript' },
  { key: 'typescript', label: 'TypeScript' },
  { key: 'java',       label: 'Java' },
  { key: 'csharp',     label: 'C#' },
  { key: 'cpp',        label: 'C++' },
  { key: 'go',         label: 'Go' },
  { key: 'rust',       label: 'Rust' },
  { key: 'sql',        label: 'SQL' },
  { key: 'other',      label: 'Інше' },
];

const LANG_COLORS = {
  python: '#3776ab', javascript: '#f7df1e', typescript: '#3178c6',
  java: '#e76f00', csharp: '#9b4f96', cpp: '#004482',
  go: '#00add8', rust: '#ce422b', sql: '#336791', other: '#6b7280',
};

const EMPTY_FORM = {
  title: '',
  description: '',
  task_type: 'code',
  language: 'python',
  starter_code: '',
  solution_code: '',
  test_cases: [{ input: '', expected_output: '', is_hidden: false }],
  quiz_options: [{ text: '', is_correct: false }],
  time_limit_minutes: 60,
  time_limit_sec: 10,
  max_score: 100,
  is_active: true,
  vacancy: '',
};

// ─── Стилі ────────────────────────────────────────────────────────────────────

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--bg)',
  fontSize: '0.85rem',
  fontFamily: 'DM Sans',
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.72rem',
  fontWeight: 600,
  fontFamily: 'DM Mono',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: 'var(--muted)',
  marginBottom: '5px',
};

// ─── Картка завдання ──────────────────────────────────────────────────────────

function TaskCard({ task, onEdit, onDelete, isMobile }) {
  const typeInfo = TASK_TYPES.find(t => t.key === task.task_type) || TASK_TYPES[1];

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: '12px',
      background: 'var(--surface)',
      padding: '16px',
      display: 'flex',
      gap: '12px',
      alignItems: 'flex-start',
      transition: 'box-shadow 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-lg)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{typeInfo.icon}</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: '4px' }}>{task.title}</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, fontFamily: 'DM Mono',
            padding: '2px 7px', borderRadius: '4px',
            background: 'var(--bg)', border: '1px solid var(--border)',
            color: 'var(--muted)',
          }}>
            {typeInfo.label}
          </span>
          {task.language && (
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, fontFamily: 'DM Mono',
              padding: '2px 7px', borderRadius: '4px',
              background: (LANG_COLORS[task.language] || '#6b7280') + '22',
              color: LANG_COLORS[task.language] || '#6b7280',
            }}>
              {task.language_display || task.language}
            </span>
          )}
          <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
            ⏱ {task.time_limit_minutes} хв · {task.max_score} балів
          </span>
          {task.vacancy_title && (
            <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
              📌 {task.vacancy_title}
            </span>
          )}
        </div>
        <div style={{
          fontSize: '0.78rem', color: 'var(--muted)', lineHeight: '1.4',
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {task.description}
        </div>
        {task.task_type === 'code' && task.test_cases?.length > 0 && (
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '6px' }}>
            {task.test_cases.length} тест-кейс{task.test_cases.length === 1 ? '' : 'ів'}
            {task.test_cases.filter(t => t.is_hidden).length > 0 &&
              ` · ${task.test_cases.filter(t => t.is_hidden).length} прихованих`
            }
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button
          onClick={() => onEdit(task)}
          style={{
            padding: '6px 12px', borderRadius: '7px',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text)', fontSize: '0.75rem', cursor: 'pointer',
          }}
        >
          ✏️
        </button>
        <button
          onClick={() => onDelete(task)}
          style={{
            padding: '6px 12px', borderRadius: '7px',
            border: '1px solid #fee2e2', background: 'transparent',
            color: '#dc2626', fontSize: '0.75rem', cursor: 'pointer',
          }}
        >
          🗑
        </button>
      </div>
    </div>
  );
}

// ─── Форма створення/редагування ──────────────────────────────────────────────

function TaskForm({ initial, vacancies, onSave, onCancel, isMobile }) {
  const [form, setForm]     = useState(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  // Test cases
  const addTestCase = () => set('test_cases', [...form.test_cases, { input: '', expected_output: '', is_hidden: false }]);
  const removeTestCase = (i) => set('test_cases', form.test_cases.filter((_, idx) => idx !== i));
  const updateTestCase = (i, field, value) => set('test_cases', form.test_cases.map((tc, idx) => idx === i ? { ...tc, [field]: value } : tc));

  // Quiz options
  const addOption = () => set('quiz_options', [...form.quiz_options, { text: '', is_correct: false }]);
  const removeOption = (i) => set('quiz_options', form.quiz_options.filter((_, idx) => idx !== i));
  const updateOption = (i, field, value) => set('quiz_options', form.quiz_options.map((o, idx) => idx === i ? { ...o, [field]: value } : o));

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('Назва обов\'язкова'); return; }
    if (!form.description.trim()) { setError('Умова завдання обов\'язкова'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, vacancy: form.vacancy || null };
      let res;
      if (initial?.id) {
        res = await axios.patch(`/api/tasks/${initial.id}/`, payload);
      } else {
        res = await axios.post('/api/tasks/', payload);
      }
      onSave(res.data, !!initial?.id);
    } catch (e) {
      const err = e.response?.data;
      setError(typeof err === 'object' ? JSON.stringify(err) : 'Помилка збереження');
    } finally {
      setSaving(false);
    }
  };

  const sectionTitle = (text) => (
    <div style={{ fontSize: '0.68rem', fontWeight: 700, fontFamily: 'DM Mono', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: '10px', marginTop: '4px' }}>
      {text}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Назва */}
      <div>
        <label style={labelStyle}>Назва завдання *</label>
        <input style={inputStyle} value={form.title} onChange={e => set('title', e.target.value)} placeholder="напр. FizzBuzz, SQL запит, Написати резюме..." />
      </div>

      {/* Тип + Мова */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={labelStyle}>Тип завдання</label>
          <select style={inputStyle} value={form.task_type} onChange={e => set('task_type', e.target.value)}>
            {TASK_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
          </select>
        </div>
        {form.task_type === 'code' && (
          <div>
            <label style={labelStyle}>Мова програмування</label>
            <select style={inputStyle} value={form.language} onChange={e => set('language', e.target.value)}>
              {LANGUAGES.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Вакансія */}
      <div>
        <label style={labelStyle}>Прив'язати до вакансії (необов'язково)</label>
        <select style={inputStyle} value={form.vacancy || ''} onChange={e => set('vacancy', e.target.value)}>
          <option value="">— Загальне завдання —</option>
          {vacancies.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
        </select>
      </div>

      {/* Умова */}
      <div>
        <label style={labelStyle}>Умова завдання *</label>
        <textarea
          style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Опишіть що потрібно зробити..."
        />
      </div>

      {/* Code специфічні поля */}
      {form.task_type === 'code' && (
        <>
          <div>
            <label style={labelStyle}>Стартовий шаблон коду</label>
            <textarea
              style={{ ...inputStyle, minHeight: '80px', fontFamily: 'DM Mono', fontSize: '0.8rem', resize: 'vertical' }}
              value={form.starter_code}
              onChange={e => set('starter_code', e.target.value)}
              placeholder="def solution(n):\n    pass"
            />
          </div>
          <div>
            <label style={labelStyle}>Еталонний розв'язок (не показується кандидату)</label>
            <textarea
              style={{ ...inputStyle, minHeight: '80px', fontFamily: 'DM Mono', fontSize: '0.8rem', resize: 'vertical' }}
              value={form.solution_code}
              onChange={e => set('solution_code', e.target.value)}
              placeholder="def solution(n):\n    if n % 15 == 0: return 'FizzBuzz'..."
            />
          </div>

          {/* Test cases */}
          <div>
            {sectionTitle('Тест-кейси')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {form.test_cases.map((tc, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr auto auto', gap: '8px', alignItems: 'center' }}>
                  <input
                    style={inputStyle}
                    placeholder="Input (stdin)"
                    value={tc.input}
                    onChange={e => updateTestCase(i, 'input', e.target.value)}
                  />
                  <input
                    style={inputStyle}
                    placeholder="Expected output"
                    value={tc.expected_output}
                    onChange={e => updateTestCase(i, 'expected_output', e.target.value)}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', fontFamily: 'DM Mono', color: 'var(--muted)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                    <input type="checkbox" checked={tc.is_hidden} onChange={e => updateTestCase(i, 'is_hidden', e.target.checked)} />
                    прихований
                  </label>
                  <button
                    onClick={() => removeTestCase(i)}
                    disabled={form.test_cases.length === 1}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #fee2e2', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addTestCase}
              style={{ marginTop: '8px', padding: '6px 14px', borderRadius: '7px', border: '1px dashed var(--accent)', background: 'transparent', color: 'var(--accent)', fontSize: '0.78rem', cursor: 'pointer' }}
            >
              + Додати тест-кейс
            </button>
          </div>

          {/* Ліміти */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Ліміт виконання (сек)</label>
              <input type="number" min="1" max="60" style={inputStyle} value={form.time_limit_sec} onChange={e => set('time_limit_sec', parseInt(e.target.value) || 10)} />
            </div>
            <div>
              <label style={labelStyle}>Пам'ять (МБ)</label>
              <input type="number" min="32" max="512" style={inputStyle} value={form.memory_limit_mb || 128} onChange={e => set('memory_limit_mb', parseInt(e.target.value) || 128)} />
            </div>
          </div>
        </>
      )}

      {/* Quiz специфічні поля */}
      {form.task_type === 'quiz' && (
        <div>
          {sectionTitle('Варіанти відповідей')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {form.quiz_options.map((opt, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={opt.is_correct}
                  onChange={e => updateOption(i, 'is_correct', e.target.checked)}
                  title="Правильна відповідь"
                  style={{ width: '16px', height: '16px', accentColor: '#16a34a', flexShrink: 0 }}
                />
                <input
                  style={{ ...inputStyle }}
                  placeholder={`Варіант ${i + 1}`}
                  value={opt.text}
                  onChange={e => updateOption(i, 'text', e.target.value)}
                />
                <button
                  onClick={() => removeOption(i)}
                  disabled={form.quiz_options.length === 1}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #fee2e2', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: '0.75rem', flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '4px' }}>
            ✓ відмічені варіанти — правильні відповіді
          </div>
          <button
            onClick={addOption}
            style={{ marginTop: '8px', padding: '6px 14px', borderRadius: '7px', border: '1px dashed var(--accent)', background: 'transparent', color: 'var(--accent)', fontSize: '0.78rem', cursor: 'pointer' }}
          >
            + Додати варіант
          </button>
        </div>
      )}

      {/* Час і бали */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={labelStyle}>Час на виконання (хвилин)</label>
          <input type="number" min="5" max="480" style={inputStyle} value={form.time_limit_minutes} onChange={e => set('time_limit_minutes', parseInt(e.target.value) || 60)} />
        </div>
        <div>
          <label style={labelStyle}>Максимальний бал</label>
          <input type="number" min="1" max="1000" style={inputStyle} value={form.max_score} onChange={e => set('max_score', parseInt(e.target.value) || 100)} />
        </div>
      </div>

      {/* Активне */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} style={{ width: '15px', height: '15px', accentColor: 'var(--accent)' }} />
        <span style={{ fontSize: '0.82rem', fontFamily: 'DM Sans' }}>Активне завдання</span>
      </label>

      {error && (
        <div style={{ color: '#dc2626', fontSize: '0.78rem', fontFamily: 'DM Mono', padding: '8px 12px', background: '#fee2e2', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {/* Кнопки */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{ padding: '9px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '0.82rem' }}
        >
          Скасувати
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          style={{ padding: '9px 22px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem', opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Збереження...' : (initial?.id ? 'Зберегти зміни' : 'Створити завдання')}
        </button>
      </div>
    </div>
  );
}

// ─── Головна сторінка ─────────────────────────────────────────────────────────

function Tasks() {
  const [tasks, setTasks]         = useState([]);
  const [vacancies, setVacancies] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editTask, setEditTask]   = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch]       = useState('');
  const [isMobile, setIsMobile]   = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      axios.get('/api/tasks/'),
      axios.get('/api/vacancies/'),
    ]).then(([tasksRes, vacanciesRes]) => {
      setTasks(tasksRes.data);
      const vData = vacanciesRes.data.results ?? vacanciesRes.data;
      setVacancies(vData.filter(v => v.is_active));
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = (savedTask, isEdit) => {
    if (isEdit) {
      setTasks(prev => prev.map(t => t.id === savedTask.id ? savedTask : t));
    } else {
      setTasks(prev => [savedTask, ...prev]);
    }
    setShowForm(false);
    setEditTask(null);
  };

  const handleEdit = (task) => {
    setEditTask(task);
    setShowForm(true);
  };

  const handleDelete = async (task) => {
    if (!window.confirm(`Видалити завдання "${task.title}"?`)) return;
    try {
      await axios.delete(`/api/tasks/${task.id}/`);
      setTasks(prev => prev.filter(t => t.id !== task.id));
    } catch {
      alert('Помилка видалення');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditTask(null);
  };

  // Фільтрація
  const filtered = tasks.filter(t => {
    if (filterType !== 'all' && t.task_type !== filterType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    }
    return true;
  });

  const stats = {
    total: tasks.length,
    code:  tasks.filter(t => t.task_type === 'code').length,
    active: tasks.filter(t => t.is_active).length,
  };

  return (
    <div style={{ padding: isMobile ? '16px' : '28px', maxWidth: '900px' }}>

      {/* Заголовок */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: isMobile ? '1.2rem' : '1.4rem', margin: 0 }}>
            📋 Тестові завдання
          </h1>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '4px' }}>
            {stats.total} завдань · {stats.code} з авто-перевіркою · {stats.active} активних
          </div>
        </div>
        {!showForm && (
          <button
            onClick={() => { setEditTask(null); setShowForm(true); }}
            style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
          >
            + Нове завдання
          </button>
        )}
      </div>

      {/* Форма */}
      {showForm && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '14px', padding: isMobile ? '16px' : '24px',
          marginBottom: '24px',
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '16px' }}>
            {editTask ? `Редагувати: ${editTask.title}` : 'Нове завдання'}
          </div>
          <TaskForm
            initial={editTask}
            vacancies={vacancies}
            onSave={handleSave}
            onCancel={handleCancel}
            isMobile={isMobile}
          />
        </div>
      )}

      {/* Фільтри */}
      {!showForm && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            style={{ ...inputStyle, maxWidth: '240px' }}
            placeholder="🔍 Пошук..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[{ key: 'all', label: 'Всі' }, ...TASK_TYPES].map(t => (
              <button
                key={t.key}
                onClick={() => setFilterType(t.key)}
                style={{
                  padding: '5px 12px', borderRadius: '20px', cursor: 'pointer',
                  border: filterType === t.key ? 'none' : '1px solid var(--border)',
                  background: filterType === t.key ? 'var(--accent)' : 'transparent',
                  color: filterType === t.key ? '#fff' : 'var(--text)',
                  fontSize: '0.78rem', fontWeight: filterType === t.key ? 600 : 400,
                }}
              >
                {t.icon ? `${t.icon} ` : ''}{t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Список */}
      {!showForm && (
        loading ? (
          <div style={{ color: 'var(--muted)', fontSize: '0.85rem', fontFamily: 'DM Mono', padding: '40px 0', textAlign: 'center' }}>
            Завантаження...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📋</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 600, marginBottom: '6px' }}>
              {tasks.length === 0 ? 'Завдань ще немає' : 'Нічого не знайдено'}
            </div>
            <div style={{ fontSize: '0.75rem', fontFamily: 'DM Mono' }}>
              {tasks.length === 0
                ? 'Натисніть "+ Нове завдання" щоб створити перше'
                : 'Спробуйте змінити фільтр або пошуковий запит'
              }
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={handleEdit}
                onDelete={handleDelete}
                isMobile={isMobile}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}

export default Tasks;