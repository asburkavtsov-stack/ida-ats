import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axiosConfig';
import toast from 'react-hot-toast';

const STATUS_TABS = [
  { key: '',         label: 'Всі' },
  { key: 'pending',  label: '🟡 Нові' },
  { key: 'approved', label: '✅ Схвалені' },
  { key: 'rejected', label: '❌ Відхилені' },
];

const TOOL_LABELS = {
  google_sheets: 'Google Sheets / Excel',
  notion: 'Notion / Airtable',
  trello: 'Trello / Jira',
  ats: 'Інша ATS',
  nothing: 'Нічого системного',
};

const TEAM_LABELS = {
  '1-2': '1–2 людини',
  '3-5': '3–5 людей',
  '6-10': '6–10 людей',
  '11+': '11+ людей',
};

const BetaAdmin = ({ isMobile }) => {
  const [activeTab, setActiveTab]   = useState('');
  const [apps, setApps]             = useState([]);
  const [config, setConfig]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(null); // detalі заявки
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing]   = useState(false);
  const [configEdit, setConfigEdit] = useState(false);
  const [configForm, setConfigForm] = useState({});
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [appsRes, cfgRes] = await Promise.all([
        axios.get(`/api/beta/applications/${activeTab ? `?status=${activeTab}` : ''}`),
        axios.get('/api/beta/config/'),
      ]);
      setApps(appsRes.data);
      setConfig(cfgRes.data);
      setConfigForm({
        beta_open: cfgRes.data.beta_open,
        max_slots: cfgRes.data.max_slots,
        notify_email: cfgRes.data.notify_email,
      });
    } catch (err) {
      toast.error('Помилка завантаження');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleReview = async (action) => {
    if (!selected) return;
    setReviewing(true);
    try {
      await axios.post(`/api/beta/applications/${selected.id}/review/`, {
        action,
        note: reviewNote,
      });
      toast.success(action === 'approve' ? 'Схвалено! Лист відправлено.' : 'Відхилено. Лист відправлено.');
      setSelected(null);
      setReviewNote('');
      fetchAll();
    } catch (err) {
      toast.error('Помилка при оновленні статусу');
    } finally {
      setReviewing(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await axios.post('/api/beta/config/', configForm);
      toast.success('Налаштування збережено');
      setConfigEdit(false);
      fetchAll();
    } catch {
      toast.error('Помилка збереження');
    } finally {
      setSavingConfig(false);
    }
  };

  const toggleBeta = async () => {
    try {
      await axios.post('/api/beta/config/', { beta_open: !config.beta_open });
      toast.success(config.beta_open ? 'Реєстрацію закрито' : 'Реєстрацію відкрито');
      fetchAll();
    } catch {
      toast.error('Помилка');
    }
  };

  // ─── Styles ──────────────────────────────────────────────────────────────────
  const s = {
    wrap: { padding: isMobile ? '16px' : '28px 32px' },
    header: { marginBottom: '24px' },
    title: { fontWeight: 800, fontSize: '1.3rem', marginBottom: '4px' },
    sub: { fontSize: '0.8rem', color: 'var(--muted)', fontFamily: 'DM Mono' },
    statsRow: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
      gap: '12px', marginBottom: '24px',
    },
    statCard: {
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '12px', padding: '16px',
    },
    statVal: { fontWeight: 800, fontSize: '1.8rem', fontFamily: 'DM Mono' },
    statLbl: { fontSize: '0.72rem', color: 'var(--muted)', marginTop: '2px' },
    configBar: {
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '12px', padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: '16px',
      flexWrap: 'wrap', marginBottom: '24px',
    },
    toggle: (on) => ({
      display: 'inline-flex', alignItems: 'center', gap: '8px',
      padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
      fontWeight: 600, fontSize: '0.85rem', border: 'none',
      background: on ? '#16a34a' : '#dc2626', color: '#fff',
      transition: 'background 0.2s',
    }),
    tabBar: {
      display: 'flex', gap: '4px', marginBottom: '16px',
      borderBottom: '1px solid var(--border)', paddingBottom: '0',
    },
    tab: (active) => ({
      padding: '8px 16px', cursor: 'pointer',
      fontFamily: 'DM Mono', fontSize: '0.78rem', fontWeight: 600,
      borderBottom: active ? '2px solid #7a1a2e' : '2px solid transparent',
      color: active ? '#7a1a2e' : 'var(--muted)', background: 'transparent',
      border: 'none', borderBottom: active ? '2px solid #7a1a2e' : '2px solid transparent',
    }),
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
    th: {
      textAlign: 'left', padding: '10px 12px',
      fontFamily: 'DM Mono', fontSize: '0.72rem', color: 'var(--muted)',
      borderBottom: '1px solid var(--border)', fontWeight: 600,
    },
    td: {
      padding: '12px', borderBottom: '1px solid var(--border)',
      verticalAlign: 'top',
    },
    statusPill: (status) => {
      const map = {
        pending:  { bg: '#fef9c3', color: '#92400e' },
        approved: { bg: '#dcfce7', color: '#15803d' },
        rejected: { bg: '#fee2e2', color: '#991b1b' },
      };
      const t = map[status] || { bg: '#f3f4f6', color: '#374151' };
      return {
        display: 'inline-block', padding: '3px 10px',
        borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600,
        background: t.bg, color: t.color,
      };
    },
    btn: (variant) => {
      const base = {
        padding: '7px 16px', borderRadius: '8px', cursor: 'pointer',
        fontSize: '0.82rem', fontWeight: 600, border: 'none', fontFamily: 'DM Sans',
      };
      if (variant === 'approve') return { ...base, background: '#16a34a', color: '#fff' };
      if (variant === 'reject')  return { ...base, background: '#dc2626', color: '#fff' };
      if (variant === 'ghost')   return { ...base, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)' };
      return { ...base, background: '#7a1a2e', color: '#fff' };
    },
    modal: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    modalBox: {
      background: 'var(--surface)', borderRadius: '16px', padding: '28px',
      width: '100%', maxWidth: '560px', maxHeight: '85vh', overflowY: 'auto',
      border: '1px solid var(--border)', margin: '16px',
    },
    input: {
      width: '100%', padding: '9px 12px', borderRadius: '8px',
      border: '1px solid var(--border)', background: 'var(--bg)',
      color: 'var(--text)', fontFamily: 'DM Sans', fontSize: '0.88rem',
      outline: 'none', boxSizing: 'border-box',
    },
    row: (label, value) => (
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginBottom: '2px' }}>{label}</div>
        <div style={{ fontSize: '0.9rem' }}>{value || '—'}</div>
      </div>
    ),
  };

  const statusLabel = { pending: '🟡 Нова', approved: '✅ Схвалено', rejected: '❌ Відхилено' };

  return (
    <div style={s.wrap}>
      {/* ── Header ── */}
      <div style={s.header}>
        <div style={s.title}>🔒 Бета-тестування</div>
        <div style={s.sub}>Управління заявками та налаштуваннями закритої бети</div>
      </div>

      {/* ── Stats ── */}
      {config && (
        <div style={s.statsRow}>
          <div style={s.statCard}>
            <div style={{ ...s.statVal, color: '#f59e0b' }}>{config.pending_count}</div>
            <div style={s.statLbl}>Нових заявок</div>
          </div>
          <div style={s.statCard}>
            <div style={{ ...s.statVal, color: '#16a34a' }}>{config.approved_count}</div>
            <div style={s.statLbl}>Схвалено</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statVal}>{config.total_count}</div>
            <div style={s.statLbl}>Всього заявок</div>
          </div>
          <div style={s.statCard}>
            <div style={{ ...s.statVal, color: '#7a1a2e' }}>
              {Math.max(0, config.max_slots - config.approved_count)}
            </div>
            <div style={s.statLbl}>Місць лишилось</div>
          </div>
        </div>
      )}

      {/* ── Config Bar ── */}
      {config && (
        <div style={s.configBar}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '2px' }}>Стан реєстрації</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
              Ліміт: {config.max_slots} · Email: {config.notify_email || 'не вказано'}
            </div>
          </div>
          <button style={s.toggle(config.beta_open)} onClick={toggleBeta}>
            {config.beta_open ? '🟢 Реєстрацію відкрито' : '🔴 Реєстрацію закрито'}
          </button>
          <button style={s.btn('ghost')} onClick={() => setConfigEdit(true)}>
            ⚙️ Налаштування
          </button>
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={s.tabBar}>
        {STATUS_TABS.map(t => (
          <button key={t.key} style={s.tab(activeTab === t.key)} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div style={{ color: 'var(--muted)', fontFamily: 'DM Mono', fontSize: '0.82rem', padding: '20px 0' }}>
          Завантаження...
        </div>
      ) : apps.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontFamily: 'DM Mono', fontSize: '0.82rem', padding: '40px 0', textAlign: 'center' }}>
          Заявок немає
        </div>
      ) : isMobile ? (
        // Mobile cards
        <div style={{ display: 'grid', gap: '12px' }}>
          {apps.map(app => (
            <div
              key={app.id}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', cursor: 'pointer' }}
              onClick={() => { setSelected(app); setReviewNote(app.reviewer_note || ''); }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ fontWeight: 700 }}>{app.company_name}</div>
                <span style={s.statusPill(app.status)}>{statusLabel[app.status]}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{app.contact_name} · {app.email}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginTop: '4px' }}>
                {new Date(app.created_at).toLocaleDateString('uk-UA')}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Агенція</th>
                <th style={s.th}>Контакт</th>
                <th style={s.th}>Email</th>
                <th style={s.th}>Команда</th>
                <th style={s.th}>Зараз</th>
                <th style={s.th}>Статус</th>
                <th style={s.th}>Лист</th>
                <th style={s.th}>Дата</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {apps.map(app => (
                <tr key={app.id} style={{ cursor: 'pointer' }} onClick={() => { setSelected(app); setReviewNote(app.reviewer_note || ''); }}>
                  <td style={{ ...s.td, fontWeight: 600 }}>{app.company_name}</td>
                  <td style={s.td}>{app.contact_name}</td>
                  <td style={{ ...s.td, fontFamily: 'DM Mono', fontSize: '0.78rem' }}>{app.email}</td>
                  <td style={s.td}>{TEAM_LABELS[app.team_size] || '—'}</td>
                  <td style={s.td}>{TOOL_LABELS[app.current_tool] || '—'}</td>
                  <td style={s.td}><span style={s.statusPill(app.status)}>{statusLabel[app.status]}</span></td>
                  <td style={s.td}>{app.email_sent ? '✅' : '—'}</td>
                  <td style={{ ...s.td, fontFamily: 'DM Mono', fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {new Date(app.created_at).toLocaleDateString('uk-UA')}
                  </td>
                  <td style={s.td}>
                    <button style={s.btn('ghost')} onClick={e => { e.stopPropagation(); setSelected(app); setReviewNote(app.reviewer_note || ''); }}>
                      Переглянути
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Review Modal ── */}
      {selected && (
        <div style={s.modal} onClick={() => setSelected(null)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '20px' }}>
              Заявка від {selected.company_name}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px', marginBottom: '16px' }}>
              {s.row('Агенція', selected.company_name)}
              {s.row('Контактна особа', selected.contact_name)}
              {s.row('Email', selected.email)}
              {s.row('Телефон', selected.phone)}
              {s.row('Розмір команди', TEAM_LABELS[selected.team_size])}
              {s.row('Зараз використовують', TOOL_LABELS[selected.current_tool])}
            </div>

            {selected.comment && (
              <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginBottom: '4px' }}>Коментар</div>
                <div style={{ fontSize: '0.88rem', lineHeight: 1.6 }}>{selected.comment}</div>
              </div>
            )}

            <div style={{ marginBottom: '8px', fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
              Статус: <strong>{statusLabel[selected.status]}</strong>
              {selected.email_sent ? ' · Лист відправлено ✅' : ''}
            </div>

            {selected.status === 'pending' && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono', display: 'block', marginBottom: '6px' }}>
                    Нотатка (буде в листі при відхиленні)
                  </label>
                  <textarea
                    style={{ ...s.input, minHeight: '72px', resize: 'vertical' }}
                    placeholder="Необов'язково..."
                    value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button style={s.btn('ghost')} onClick={() => setSelected(null)}>Закрити</button>
                  <button
                    style={{ ...s.btn('reject'), opacity: reviewing ? 0.7 : 1 }}
                    disabled={reviewing}
                    onClick={() => handleReview('reject')}
                  >
                    {reviewing ? '...' : '❌ Відхилити'}
                  </button>
                  <button
                    style={{ ...s.btn('approve'), opacity: reviewing ? 0.7 : 1 }}
                    disabled={reviewing}
                    onClick={() => handleReview('approve')}
                  >
                    {reviewing ? '...' : '✅ Схвалити'}
                  </button>
                </div>
              </>
            )}

            {selected.status !== 'pending' && (
              <div style={{ marginTop: '16px', textAlign: 'right' }}>
                {selected.reviewer_note && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '12px', textAlign: 'left' }}>
                    Нотатка: {selected.reviewer_note}
                  </div>
                )}
                <button style={s.btn('ghost')} onClick={() => setSelected(null)}>Закрити</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Config Modal ── */}
      {configEdit && (
        <div style={s.modal} onClick={() => setConfigEdit(false)}>
          <div style={{ ...s.modalBox, maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '20px' }}>⚙️ Налаштування бети</div>

            <div style={{ display: 'grid', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono', display: 'block', marginBottom: '6px' }}>
                  Реєстрацію відкрито
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[true, false].map(val => (
                    <button
                      key={String(val)}
                      onClick={() => setConfigForm(f => ({ ...f, beta_open: val }))}
                      style={{
                        ...s.btn(configForm.beta_open === val ? (val ? 'approve' : 'reject') : 'ghost'),
                        flex: 1,
                      }}
                    >
                      {val ? '🟢 Відкрито' : '🔴 Закрито'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono', display: 'block', marginBottom: '6px' }}>
                  Максимум учасників
                </label>
                <input
                  type="number" min="1" style={s.input}
                  value={configForm.max_slots}
                  onChange={e => setConfigForm(f => ({ ...f, max_slots: e.target.value }))}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono', display: 'block', marginBottom: '6px' }}>
                  Email для сповіщень про нові заявки
                </label>
                <input
                  type="email" style={s.input} placeholder="admin@ida-ats.com"
                  value={configForm.notify_email}
                  onChange={e => setConfigForm(f => ({ ...f, notify_email: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button style={s.btn('ghost')} onClick={() => setConfigEdit(false)}>Скасувати</button>
              <button
                style={{ ...s.btn('primary'), opacity: savingConfig ? 0.7 : 1 }}
                disabled={savingConfig}
                onClick={handleSaveConfig}
              >
                {savingConfig ? 'Збереження...' : 'Зберегти'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BetaAdmin;