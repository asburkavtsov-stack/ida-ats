// BulkActionBar.js — панель масових дій
// Використовується в Candidates та Kanban
import React, { useState, useEffect } from 'react';
import axios from 'axiosConfig';
import toast from 'react-hot-toast';

function BulkActionBar({ selectedIds, onClear, onDone }) {
  const [stages,   setStages]   = useState([]);
  const [hrList,   setHrList]   = useState([]);
  const [tags,     setTags]     = useState([]);
  const [panel,    setPanel]    = useState(null); // 'status' | 'hr' | 'tags'
  const [saving,   setSaving]   = useState(false);

  // Вибрані значення
  const [pickedStage, setPickedStage] = useState(null);
  const [pickedHr,    setPickedHr]    = useState(null);
  const [pickedTags,  setPickedTags]  = useState([]);

  useEffect(() => {
    axios.get('/api/vacancy-stages/', { params: { org_template: true } })
      .then(res => setStages(res.data.results ?? res.data))
      .catch(() => {});
    axios.get('/api/users/')
      .then(res => setHrList(res.data.results ?? res.data))
      .catch(() => {});
    axios.get('/api/tags/')
      .then(res => setTags(res.data.results ?? res.data))
      .catch(() => {});
  }, []);

  const count = selectedIds.length;
  if (count === 0) return null;

  const closePanel = () => {
    setPanel(null);
    setPickedStage(null);
    setPickedHr(null);
    setPickedTags([]);
  };

  // ── Масові запити ────────────────────────────────────────────────────────
  const applyStatus = async () => {
    if (!pickedStage) return;
    setSaving(true);
    try {
      await Promise.all(
        selectedIds.map(id =>
          axios.patch(`/api/candidates/${id}/update_status/`, { stage_id: pickedStage.id })
        )
      );
      const stageName = pickedStage.name;
      toast.success(`${count} кандидат${plural(count)} → ${stageName}`);
      onDone();
      closePanel();
    } catch {
      toast.error('Не вдалося змінити статус');
    } finally {
      setSaving(false);
    }
  };

  const applyHr = async () => {
    setSaving(true);
    try {
      await Promise.all(
        selectedIds.map(id =>
          axios.patch(`/api/candidates/${id}/assign/`, {
            assigned_to: pickedHr === '__unassign' ? null : pickedHr,
          })
        )
      );
      const label = pickedHr === '__unassign'
        ? 'HR знято'
        : `HR призначено: ${hrList.find(h => h.id === pickedHr)?.first_name || ''}`;
      toast.success(`${count} кандидат${plural(count)} — ${label}`);
      onDone();
      closePanel();
    } catch {
      toast.error('Не вдалося призначити HR');
    } finally {
      setSaving(false);
    }
  };

  const applyTags = async () => {
    if (pickedTags.length === 0) return;
    setSaving(true);
    try {
      // Для кожного кандидата додаємо теги (merge, не заміна)
      await Promise.all(
        selectedIds.map(async id => {
          const res = await axios.get(`/api/candidates/${id}/`);
          const existing = (res.data.tags || []).map(t => t.id);
          const merged = [...new Set([...existing, ...pickedTags])];
          return axios.patch(`/api/candidates/${id}/`, { tag_ids: merged });
        })
      );
      toast.success(`Теги додано до ${count} кандидат${plural(count)}`);
      onDone();
      closePanel();
    } catch {
      toast.error('Не вдалося додати теги');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
      pointerEvents: 'none',
    }}>

      {/* Dropdown panel */}
      {panel && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '14px 16px', width: '300px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)', pointerEvents: 'all',
        }}>

          {/* ── Зміна статусу ── */}
          {panel === 'status' && (
            <>
              <div style={{ fontSize: '0.72rem', fontFamily: 'DM Mono', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
                Змінити етап
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '220px', overflowY: 'auto', marginBottom: '12px' }}>
                {stages.map(s => {
                  const active = pickedStage?.id === s.id;
                  return (
                    <button key={s.id} onClick={() => setPickedStage(s)} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 12px', borderRadius: '8px', border: `1px solid ${active ? s.color : 'var(--border)'}`,
                      background: active ? s.color + '18' : 'var(--bg)',
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans', fontSize: '0.82rem',
                    }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      {s.name}
                      {active && <span style={{ marginLeft: 'auto', color: s.color, fontSize: '0.75rem' }}>✓</span>}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={closePanel} style={btnSecondary}>Скасувати</button>
                <button onClick={applyStatus} disabled={!pickedStage || saving} style={pickedStage && !saving ? btnPrimary : btnDisabled}>
                  {saving ? 'Збереження...' : 'Застосувати'}
                </button>
              </div>
            </>
          )}

          {/* ── Призначення HR ── */}
          {panel === 'hr' && (
            <>
              <div style={{ fontSize: '0.72rem', fontFamily: 'DM Mono', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
                Призначити HR
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '220px', overflowY: 'auto', marginBottom: '12px' }}>
                <button onClick={() => setPickedHr('__unassign')} style={{
                  padding: '8px 12px', borderRadius: '8px', fontSize: '0.82rem',
                  border: `1px solid ${pickedHr === '__unassign' ? 'var(--accent)' : 'var(--border)'}`,
                  background: pickedHr === '__unassign' ? 'rgba(159,18,57,0.08)' : 'var(--bg)',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans', color: 'var(--muted)',
                }}>
                  — Зняти призначення
                </button>
                {hrList.map(h => {
                  const name = h.first_name && h.last_name ? `${h.first_name} ${h.last_name}` : h.username;
                  const active = pickedHr === h.id;
                  return (
                    <button key={h.id} onClick={() => setPickedHr(h.id)} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 12px', borderRadius: '8px',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: active ? 'rgba(159,18,57,0.08)' : 'var(--bg)',
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans', fontSize: '0.82rem',
                    }}>
                      <div style={{
                        width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                        background: 'var(--accent)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#fff',
                      }}>
                        {name[0]?.toUpperCase()}
                      </div>
                      {name}
                      {active && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: '0.75rem' }}>✓</span>}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={closePanel} style={btnSecondary}>Скасувати</button>
                <button onClick={applyHr} disabled={pickedHr === null || saving} style={pickedHr !== null && !saving ? btnPrimary : btnDisabled}>
                  {saving ? 'Збереження...' : 'Застосувати'}
                </button>
              </div>
            </>
          )}

          {/* ── Додавання тегів ── */}
          {panel === 'tags' && (
            <>
              <div style={{ fontSize: '0.72rem', fontFamily: 'DM Mono', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
                Додати теги
              </div>
              {tags.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontFamily: 'DM Mono', marginBottom: '12px' }}>Теги не знайдено</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                  {tags.map(t => {
                    const active = pickedTags.includes(t.id);
                    return (
                      <button key={t.id} onClick={() => setPickedTags(prev =>
                        active ? prev.filter(id => id !== t.id) : [...prev, t.id]
                      )} style={{
                        padding: '5px 12px', borderRadius: '20px', fontSize: '0.78rem',
                        border: `1px solid ${active ? t.color : 'var(--border)'}`,
                        background: active ? t.color + '20' : 'var(--bg)',
                        color: active ? t.color : 'var(--muted)',
                        cursor: 'pointer', fontFamily: 'DM Sans',
                      }}>
                        {active ? '✓ ' : ''}{t.name}
                      </button>
                    );
                  })}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={closePanel} style={btnSecondary}>Скасувати</button>
                <button onClick={applyTags} disabled={pickedTags.length === 0 || saving} style={pickedTags.length > 0 && !saving ? btnPrimary : btnDisabled}>
                  {saving ? 'Збереження...' : 'Застосувати'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Головна панель ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        background: 'var(--sidebar-bg)', borderRadius: '12px',
        padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        pointerEvents: 'all',
      }}>
        {/* Лічильник */}
        <span style={{
          fontFamily: 'DM Mono', fontSize: '0.78rem', color: 'var(--sidebar-active)',
          padding: '3px 10px', borderRadius: '20px',
          background: 'rgba(253,232,236,0.15)', marginRight: '4px',
        }}>
          {count} обрано
        </span>

        {/* Кнопки дій */}
        <button onClick={() => setPanel(p => p === 'status' ? null : 'status')} style={actionBtn(panel === 'status')}>
          🔄 Етап
        </button>
        <button onClick={() => setPanel(p => p === 'hr' ? null : 'hr')} style={actionBtn(panel === 'hr')}>
          👤 HR
        </button>
        <button onClick={() => setPanel(p => p === 'tags' ? null : 'tags')} style={actionBtn(panel === 'tags')}>
          🏷 Теги
        </button>

        {/* Роздільник */}
        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />

        {/* Скинути вибір */}
        <button onClick={() => { onClear(); closePanel(); }} style={{
          padding: '6px 10px', borderRadius: '7px', border: 'none',
          background: 'transparent', color: 'rgba(200,176,182,0.5)',
          cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'DM Mono',
          transition: 'color 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(200,176,182,0.5)'}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const plural = (n) => n === 1 ? 'а' : n < 5 ? 'и' : 'ів';

const btnPrimary = {
  flex: 1, padding: '8px', borderRadius: '7px', border: 'none',
  background: 'var(--accent)', color: '#fff',
  cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, fontFamily: 'DM Sans',
};
const btnSecondary = {
  flex: 1, padding: '8px', borderRadius: '7px',
  border: '1px solid var(--border)', background: 'transparent',
  cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'DM Sans',
};
const btnDisabled = {
  flex: 1, padding: '8px', borderRadius: '7px', border: 'none',
  background: 'var(--border)', color: 'var(--muted)',
  cursor: 'not-allowed', fontSize: '0.78rem', fontFamily: 'DM Sans',
};
const actionBtn = (active) => ({
  padding: '6px 12px', borderRadius: '7px', border: 'none',
  background: active ? 'rgba(253,232,236,0.18)' : 'transparent',
  color: active ? 'var(--sidebar-active)' : 'rgba(200,176,182,0.7)',
  cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'DM Sans',
  fontWeight: active ? 600 : 400, transition: 'all 0.15s',
});

export default BulkActionBar;