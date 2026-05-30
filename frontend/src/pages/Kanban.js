// Kanban.js — динамічні колонки з редактором стейджів
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axiosConfig';

// ─── Палітра кольорів для стейджів ───────────────────────────────────────────
const STAGE_COLORS = [
  '#7a1a2e','#b03050','#8a3a5a','#c2185b','#e8a0b0',
  '#c94f2a','#16a34a','#2563eb','#7c3aed','#db2777',
  '#0891b2','#ca8a04','#4f46e5','#059669','#dc2626',
];

// ─── Хелпери ──────────────────────────────────────────────────────────────────
const hex2rgba = (hex, alpha = 0.12) => {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
};

// ─── Редактор одного стейджу ──────────────────────────────────────────────────
function StageEditor({ stage, onSave, onDelete, onClose }) {
  const [name,  setName]  = useState(stage?.name  || '');
  const [color, setColor] = useState(stage?.color || '#7a1a2e');
  const [isTerminal, setIsTerminal] = useState(stage?.is_terminal || false);
  const isNew = !stage?.id;

  return (
    <div style={{
      position:'absolute', top:'100%', left:0, zIndex:200,
      background:'var(--surface)', border:'1px solid var(--border)',
      borderRadius:'12px', padding:'16px', width:'240px',
      boxShadow:'var(--shadow-lg)', marginTop:'4px',
    }}>
      <div style={{fontWeight:700, fontSize:'0.85rem', marginBottom:'12px'}}>
        {isNew ? 'Новий етап' : 'Редагувати етап'}
      </div>

      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Назва етапу"
        style={{
          width:'100%', padding:'8px 10px',
          border:'1px solid var(--border)', borderRadius:'7px',
          fontSize:'0.85rem', fontFamily:'DM Sans',
          background:'var(--bg)', marginBottom:'10px',
        }}
        autoFocus
      />

      {/* Палітра */}
      <div style={{display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'10px'}}>
        {STAGE_COLORS.map(c => (
          <button key={c} onClick={() => setColor(c)} style={{
            width:'22px', height:'22px', borderRadius:'50%',
            background:c, border: color===c ? '2px solid #fff' : '2px solid transparent',
            outline: color===c ? `2px solid ${c}` : 'none',
            cursor:'pointer', padding:0,
          }}/>
        ))}
      </div>

      <label style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'0.8rem', marginBottom:'12px', cursor:'pointer'}}>
        <input type="checkbox" checked={isTerminal} onChange={e => setIsTerminal(e.target.checked)}/>
        Фінальний етап
      </label>

      <div style={{display:'flex', gap:'8px'}}>
        <button onClick={onClose} style={{
          flex:1, padding:'7px', borderRadius:'7px',
          border:'1px solid var(--border)', background:'transparent',
          cursor:'pointer', fontSize:'0.78rem',
        }}>Скасувати</button>

        {!isNew && (
          <button onClick={() => onDelete(stage.id)} style={{
            padding:'7px 10px', borderRadius:'7px', border:'none',
            background:'#fee2e2', color:'#dc2626',
            cursor:'pointer', fontSize:'0.78rem',
          }}>🗑</button>
        )}

        <button
          onClick={() => name.trim() && onSave({...stage, name:name.trim(), color, is_terminal:isTerminal})}
          disabled={!name.trim()}
          style={{
            flex:1, padding:'7px', borderRadius:'7px', border:'none',
            background: name.trim() ? 'var(--accent)' : 'var(--border)',
            color: name.trim() ? '#fff' : 'var(--muted)',
            cursor: name.trim() ? 'pointer' : 'not-allowed',
            fontSize:'0.78rem', fontWeight:600,
          }}
        >Зберегти</button>
      </div>
    </div>
  );
}

// ─── Картка кандидата ─────────────────────────────────────────────────────────
function CandidateCard({ candidate, onOpen, isDragging }) {
  return (
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData('candidateId', String(candidate.id))}
      onClick={() => onOpen(candidate)}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '12px',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, transform 0.1s',
        opacity: isDragging ? 0.5 : 1,
        userSelect: 'none',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-lg)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      <div style={{fontWeight:600, fontSize:'0.85rem', marginBottom:'4px'}}>
        {candidate.first_name} {candidate.last_name}
      </div>
      {candidate.vacancy_title && (
        <div style={{fontSize:'0.72rem', color:'var(--muted)', fontFamily:'DM Mono', marginBottom:'6px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
          {candidate.vacancy_title}
        </div>
      )}
      <div style={{display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center'}}>
        {candidate.assigned_to_name && (
          <span style={{fontSize:'0.68rem', color:'var(--muted)', fontFamily:'DM Mono'}}>
            👤 {candidate.assigned_to_name}
          </span>
        )}
        {candidate.tags?.slice(0,2).map(t => (
          <span key={t.id} style={{
            fontSize:'0.65rem', padding:'1px 6px', borderRadius:'10px',
            background: hex2rgba(t.color||'#7a1a2e', 0.15),
            color: t.color||'#7a1a2e', fontWeight:600,
          }}>{t.name}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Колонка канбану ──────────────────────────────────────────────────────────
function KanbanColumn({
  stage, candidates, onDropCandidate, onOpenCandidate,
  onEditStage, onAddStage, isFirst, isLast,
  onMoveLeft, onMoveRight, isMobile,
}) {
  const [dragOver, setDragOver] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  const count = candidates.length;

  return (
    <div style={{
      minWidth: isMobile ? '85vw' : '240px',
      maxWidth: isMobile ? '85vw' : '280px',
      flex: '0 0 auto',
      display:'flex', flexDirection:'column',
      background: dragOver ? hex2rgba(stage.color, 0.07) : 'transparent',
      border: dragOver ? `1.5px dashed ${stage.color}` : '1.5px solid transparent',
      borderRadius:'12px', transition:'background 0.15s, border 0.15s',
      padding:'4px',
      position:'relative',
    }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault(); setDragOver(false);
        const id = parseInt(e.dataTransfer.getData('candidateId'));
        if (id) onDropCandidate(id, stage.id);
      }}
    >
      {/* Заголовок */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'8px 10px', marginBottom:'8px',
        borderRadius:'8px',
        background: hex2rgba(stage.color, 0.1),
      }}>
        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
          <span style={{
            width:'10px', height:'10px', borderRadius:'50%',
            background: stage.color, flexShrink:0,
          }}/>
          <span style={{fontWeight:700, fontSize:'0.82rem'}}>{stage.name}</span>
          <span style={{
            fontSize:'0.68rem', fontFamily:'DM Mono',
            background: hex2rgba(stage.color, 0.2),
            color: stage.color, padding:'1px 7px', borderRadius:'10px',
          }}>{count}</span>
        </div>

        <div style={{display:'flex', gap:'2px', position:'relative'}}>
          {!isFirst && (
            <button onClick={onMoveLeft} title="Перемістити ліворуч" style={{
              background:'none', border:'none', cursor:'pointer',
              color:'var(--muted)', fontSize:'0.75rem', padding:'2px 4px',
            }}>←</button>
          )}
          {!isLast && (
            <button onClick={onMoveRight} title="Перемістити праворуч" style={{
              background:'none', border:'none', cursor:'pointer',
              color:'var(--muted)', fontSize:'0.75rem', padding:'2px 4px',
            }}>→</button>
          )}
          <button
            onClick={() => setShowEditor(v => !v)}
            title="Редагувати етап"
            style={{
              background:'none', border:'none', cursor:'pointer',
              color:'var(--muted)', fontSize:'0.9rem', padding:'2px 5px',
              borderRadius:'5px',
            }}
          >⋯</button>

          {showEditor && (
            <StageEditor
              stage={stage}
              onSave={s => { onEditStage(s); setShowEditor(false); }}
              onDelete={id => { onEditStage({...stage, _delete:true}); setShowEditor(false); }}
              onClose={() => setShowEditor(false)}
            />
          )}
        </div>
      </div>

      {/* Картки */}
      <div style={{
        flex:1, overflowY:'auto', display:'flex', flexDirection:'column',
        gap:'8px', padding:'0 2px', minHeight:'80px',
      }}>
        {candidates.map(c => (
          <CandidateCard
            key={c.id}
            candidate={c}
            onOpen={onOpenCandidate}
          />
        ))}
        {count === 0 && (
          <div style={{
            textAlign:'center', padding:'24px 0',
            color:'var(--muted)', fontSize:'0.75rem', fontFamily:'DM Mono',
          }}>
            Немає кандидатів
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Головний компонент ───────────────────────────────────────────────────────
function Kanban({ vacancyId, candidates: propCandidates, onOpenCandidate, onCandidateMoved }) {
  const [stages,      setStages]     = useState([]);
  const [candidates,  setCandidates] = useState(propCandidates || []);
  const [loading,     setLoading]    = useState(true);
  const [saving,      setSaving]     = useState(false);
  const [showAddStage, setShowAddStage] = useState(false);
  const [isMobile,    setIsMobile]   = useState(false);
  const [isOrgTemplate, setIsOrgTemplate] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (propCandidates) setCandidates(propCandidates);
  }, [propCandidates]);

  // ── Завантаження стейджів ──────────────────────────────────────────────────
  const loadStages = useCallback(async () => {
    setLoading(true);
    try {
      const params = vacancyId ? { vacancy: vacancyId } : { org_template: true };
      const res = await axios.get('/api/vacancy-stages/', { params });
      const data = res.data.results ?? res.data;
      setStages(data);
      // Якщо жоден стейдж не має vacancy → це шаблон орг (не override)
      setIsOrgTemplate(data.every(s => !s.vacancy));
    } catch (err) {
      console.error('Помилка завантаження стейджів:', err);
    } finally {
      setLoading(false);
    }
  }, [vacancyId]);

  useEffect(() => { loadStages(); }, [loadStages]);

  // ── Drop кандидата в колонку ───────────────────────────────────────────────
  const handleDrop = async (candidateId, stageId) => {
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate || candidate.stage === stageId) return;

    // Оптимістичний update
    setCandidates(prev => prev.map(c =>
      c.id === candidateId ? { ...c, stage: stageId, stage_id: stageId } : c
    ));

    try {
      await axios.patch(`/api/candidates/${candidateId}/update_status/`, { stage_id: stageId });
      onCandidateMoved?.();
    } catch (err) {
      console.error(err);
      setCandidates(propCandidates || []);
    }
  };

  // ── Редагувати/видалити стейдж ─────────────────────────────────────────────
  const handleEditStage = async (stageData) => {
    setSaving(true);
    try {
      if (stageData._delete) {
        // Видалити стейдж
        await axios.delete(`/api/vacancy-stages/${stageData.id}/`);
        setStages(prev => prev.filter(s => s.id !== stageData.id));
      } else if (stageData.id) {
        // Оновити існуючий
        const res = await axios.patch(`/api/vacancy-stages/${stageData.id}/`, {
          name: stageData.name, color: stageData.color, is_terminal: stageData.is_terminal,
        });
        setStages(prev => prev.map(s => s.id === stageData.id ? res.data : s));
      } else {
        // Новий стейдж
        const payload = {
          name: stageData.name,
          color: stageData.color,
          is_terminal: stageData.is_terminal,
          order: stages.length,
          ...(vacancyId ? { vacancy: vacancyId } : {}),
        };
        const res = await axios.post('/api/vacancy-stages/', payload);
        setStages(prev => [...prev, res.data]);
      }
    } catch (err) {
      console.error('Помилка збереження стейджу:', err);
      alert('Не вдалося зберегти зміни');
    } finally {
      setSaving(false);
    }
  };

  // ── Зміна порядку колонок ──────────────────────────────────────────────────
  const handleReorder = async (fromIdx, toIdx) => {
    const reordered = [...stages];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setStages(reordered);

    try {
      await axios.post('/api/vacancy-stages/reorder/', {
        ordered_ids: reordered.map(s => s.id),
      });
    } catch (err) {
      console.error('Помилка reorder:', err);
      loadStages();
    }
  };

  // ── Скопіювати шаблон орг для вакансії ────────────────────────────────────
  const handleCopyOrgTemplate = async () => {
    if (!vacancyId) return;
    try {
      const res = await axios.post(`/api/vacancies/${vacancyId}/copy_org_stages/`);
      setStages(res.data);
      setIsOrgTemplate(false);
    } catch (err) {
      console.error(err);
    }
  };

  // ── Скинути до шаблону орг ─────────────────────────────────────────────────
  const handleResetToOrg = async () => {
    if (!vacancyId) return;
    if (!window.confirm('Скинути до шаблону організації? Кастомні стейджі цієї вакансії буде видалено.')) return;
    try {
      const res = await axios.post('/api/vacancy-stages/reset_to_org/', { vacancy_id: vacancyId });
      setStages(res.data);
      setIsOrgTemplate(true);
    } catch (err) {
      console.error(err);
    }
  };

  // ── Кандидати по стейджах ──────────────────────────────────────────────────
  const getCandidatesForStage = (stageId) =>
    candidates.filter(c => (c.stage === stageId || c.stage_id === stageId));

  if (loading) return (
    <div style={{textAlign:'center', padding:'40px', color:'var(--muted)', fontSize:'0.85rem'}}>
      Завантаження канбану...
    </div>
  );

  return (
    <div style={{display:'flex', flexDirection:'column', gap:'12px', height:'100%'}}>

      {/* ── Тулбар ── */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        gap:'8px', flexWrap:'wrap', flexShrink:0,
      }}>
        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
          <span style={{fontSize:'0.78rem', color:'var(--muted)', fontFamily:'DM Mono'}}>
            {stages.length} етап{stages.length===1?'':stages.length<5?'и':'ів'}
            {isOrgTemplate && vacancyId && (
              <span style={{marginLeft:'6px', color:'#ca8a04'}}> · шаблон орг</span>
            )}
          </span>
          {saving && (
            <span style={{fontSize:'0.72rem', color:'var(--muted)', fontFamily:'DM Mono'}}>
              Збереження...
            </span>
          )}
        </div>

        <div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>
          {/* Кастомізувати (копіює шаблон орг для вакансії) */}
          {vacancyId && isOrgTemplate && (
            <button onClick={handleCopyOrgTemplate} style={{
              padding:'6px 12px', borderRadius:'7px',
              border:'1px solid var(--border)', background:'transparent',
              cursor:'pointer', fontSize:'0.78rem',
              display:'flex', alignItems:'center', gap:'5px',
            }}>
              ✏️ Кастомізувати
            </button>
          )}

          {/* Скинути до шаблону орг */}
          {vacancyId && !isOrgTemplate && (
            <button onClick={handleResetToOrg} style={{
              padding:'6px 12px', borderRadius:'7px',
              border:'1px solid var(--border)', background:'transparent',
              cursor:'pointer', fontSize:'0.78rem', color:'var(--muted)',
            }}>
              ↺ До шаблону
            </button>
          )}

          {/* Додати стейдж */}
          <div style={{position:'relative'}}>
            <button onClick={() => setShowAddStage(v => !v)} style={{
              padding:'6px 12px', borderRadius:'7px', border:'none',
              background:'var(--accent)', color:'#fff',
              cursor:'pointer', fontSize:'0.78rem', fontWeight:600,
              display:'flex', alignItems:'center', gap:'5px',
            }}>
              + Етап
            </button>
            {showAddStage && (
              <StageEditor
                stage={null}
                onSave={s => { handleEditStage(s); setShowAddStage(false); }}
                onDelete={() => {}}
                onClose={() => setShowAddStage(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Колонки ── */}
      <div style={{
        display:'flex', gap:'12px', overflowX:'auto',
        flex:1, paddingBottom:'8px',
        scrollSnapType: isMobile ? 'x mandatory' : 'none',
      }}>
        {stages.map((stage, idx) => (
          <div key={stage.id} style={{scrollSnapAlign: isMobile ? 'start' : 'none'}}>
            <KanbanColumn
              stage={stage}
              candidates={getCandidatesForStage(stage.id)}
              onDropCandidate={handleDrop}
              onOpenCandidate={onOpenCandidate}
              onEditStage={handleEditStage}
              onAddStage={() => setShowAddStage(true)}
              isFirst={idx === 0}
              isLast={idx === stages.length - 1}
              onMoveLeft={() => handleReorder(idx, idx - 1)}
              onMoveRight={() => handleReorder(idx, idx + 1)}
              isMobile={isMobile}
            />
          </div>
        ))}

        {stages.length === 0 && (
          <div style={{
            flex:1, display:'flex', alignItems:'center', justifyContent:'center',
            color:'var(--muted)', fontSize:'0.85rem', fontFamily:'DM Mono',
          }}>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:'2rem', marginBottom:'8px'}}>📋</div>
              Немає етапів — натисніть «+ Етап» щоб додати
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Kanban;