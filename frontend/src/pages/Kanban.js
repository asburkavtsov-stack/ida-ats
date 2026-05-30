// Kanban.js — оновлена версія з фільтрами
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axiosConfig';
import CandidateCardModal from '../components/CandidateCardModal'; // ← додаємо імпорт

// ─── Палітра кольорів для стейджів ───────────────────────────────────────────
const STAGE_COLORS = [
  '#7a1a2e','#b03050','#8a3a5a','#c2185b','#e8a0b0',
  '#c94f2a','#16a34a','#2563eb','#7c3aed','#db2777',
  '#0891b2','#ca8a04','#4f46e5','#059669','#dc2626',
];

// ─── Хелпери ──────────────────────────────────────────────────────────────────
const hex2rgba = (hex, alpha = 0.12) => {
  if (!hex || hex.length < 7) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const getHrAvatarColor = (userId) => {
  const colors = ['#7a1a2e','#b03050','#8a3a5a','#e8a0b0','#c94f2a','#16a34a','#2563eb','#7c3aed'];
  if (!userId) return '#71717a';
  return colors[userId % colors.length];
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
        Фінальний етап (після нього рух неможливий)
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
          <div style={{display:'flex', alignItems:'center', gap:'4px'}}>
            <div style={{
              width:'18px', height:'18px', borderRadius:'50%',
              background: getHrAvatarColor(candidate.assigned_to),
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'0.55rem', fontWeight:700, color:'#fff',
            }}>
              {(candidate.assigned_to_name?.[0] || '?').toUpperCase()}
            </div>
            <span style={{fontSize:'0.68rem', color:'var(--muted)', fontFamily:'DM Mono'}}>
              {candidate.assigned_to_name?.split(' ')[0]}
            </span>
          </div>
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

// ─── КОМПОНЕНТ ФІЛЬТРІВ (НОВИЙ) ───────────────────────────────────────────────
function KanbanFilters({ filters, onFilterChange, vacancies, hrUsers, isMobile }) {
  const { vacancyId, assignedTo, searchQuery } = filters;

  return (
    <div style={{
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
      marginBottom: '16px',
      padding: '12px 16px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      alignItems: 'flex-end',
    }}>
      {/* Фільтр по вакансії */}
      <div style={{ minWidth: isMobile ? '100%' : '180px' }}>
        <div style={{ fontSize: '0.65rem', fontFamily: 'DM Mono', color: 'var(--muted)', marginBottom: '4px' }}>
          Вакансія
        </div>
        <select
          value={vacancyId || ''}
          onChange={e => onFilterChange('vacancyId', e.target.value || null)}
          style={{
            width: '100%',
            padding: '7px 10px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            fontSize: '0.78rem',
            fontFamily: 'DM Sans',
          }}
        >
          <option value="">Всі вакансії</option>
          {vacancies.map(v => (
            <option key={v.id} value={v.id}>{v.title}</option>
          ))}
        </select>
      </div>

      {/* Фільтр по HR */}
      <div style={{ minWidth: isMobile ? '100%' : '160px' }}>
        <div style={{ fontSize: '0.65rem', fontFamily: 'DM Mono', color: 'var(--muted)', marginBottom: '4px' }}>
          HR менеджер
        </div>
        <select
          value={assignedTo || ''}
          onChange={e => onFilterChange('assignedTo', e.target.value || null)}
          style={{
            width: '100%',
            padding: '7px 10px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            fontSize: '0.78rem',
            fontFamily: 'DM Sans',
          }}
        >
          <option value="">Всі HR</option>
          {hrUsers.map(u => (
            <option key={u.id} value={u.id}>
              {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}
            </option>
          ))}
        </select>
      </div>

      {/* Пошук по імені/email */}
      <div style={{ flex: 1, minWidth: isMobile ? '100%' : '200px' }}>
        <div style={{ fontSize: '0.65rem', fontFamily: 'DM Mono', color: 'var(--muted)', marginBottom: '4px' }}>
          Пошук
        </div>
        <input
          value={searchQuery || ''}
          onChange={e => onFilterChange('searchQuery', e.target.value)}
          placeholder="Ім'я, email..."
          style={{
            width: '100%',
            padding: '7px 10px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            fontSize: '0.78rem',
            fontFamily: 'DM Sans',
          }}
        />
      </div>

      {/* Кнопка скидання */}
      {(vacancyId || assignedTo || searchQuery) && (
        <button
          onClick={() => {
            onFilterChange('vacancyId', null);
            onFilterChange('assignedTo', null);
            onFilterChange('searchQuery', '');
          }}
          style={{
            padding: '7px 14px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '0.72rem',
            fontFamily: 'DM Mono',
          }}
        >
          ✕ Скинути фільтри
        </button>
      )}
    </div>
  );
}

// ─── КОЛОНКА КАНБАНУ (оновлена з isTerminal) ──────────────────────────────────
function KanbanColumn({
  stage, candidates, onDropCandidate, onOpenCandidate,
  onEditStage, onAddStage, isFirst, isLast,
  onMoveLeft, onMoveRight, isMobile,
}) {
  const [dragOver, setDragOver] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const count = candidates.length;
  const canDrop = !stage.is_terminal;  // terminal stages не можна дропати

  return (
    <div style={{
      minWidth: isMobile ? '85vw' : '240px',
      maxWidth: isMobile ? '85vw' : '280px',
      flex: '0 0 auto',
      display:'flex', flexDirection:'column',
      background: dragOver && canDrop ? hex2rgba(stage.color, 0.07) : 'transparent',
      border: dragOver && canDrop ? `2px dashed ${stage.color}` : '2px solid transparent',
      borderRadius:'12px', transition:'background 0.15s, border 0.15s',
      padding:'4px',
      position:'relative',
      opacity: stage.is_terminal ? 0.9 : 1,
    }}
      onDragOver={e => { 
        e.preventDefault(); 
        if (canDrop) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault(); 
        setDragOver(false);
        if (!canDrop) return;
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
          {stage.is_terminal && (
            <span style={{
              fontSize:'0.6rem', fontFamily:'DM Mono',
              background:'#fee2e2', color:'#dc2626',
              padding:'1px 5px', borderRadius:'4px',
            }}>Фінал</span>
          )}
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
        gap:'8px', padding:'0 2px', minHeight:'80px', maxHeight:'calc(100vh - 280px)',
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

// ─── ГОЛОВНИЙ КОМПОНЕНТ ───────────────────────────────────────────────────────
function Kanban({ vacancyId, candidates: propCandidates, onCandidateMoved }) {
  const [stages,      setStages]     = useState([]);
  const [candidates,  setCandidates] = useState(propCandidates || []);
  const [vacancies,   setVacancies]  = useState([]);
  const [hrUsers,     setHrUsers]    = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [saving,      setSaving]     = useState(false);
  const [showAddStage, setShowAddStage] = useState(false);
  const [isMobile,    setIsMobile]   = useState(false);
  const [isOrgTemplate, setIsOrgTemplate] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  
  // Фільтри (НОВІ)
  const [filters, setFilters] = useState({
    vacancyId: vacancyId || null,
    assignedTo: null,
    searchQuery: '',
  });

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
      const params = filters.vacancyId ? { vacancy: filters.vacancyId } : { org_template: true };
      const res = await axios.get('/api/vacancy-stages/', { params });
      const data = res.data.results ?? res.data;
      setStages(data);
      setIsOrgTemplate(data.every(s => !s.vacancy));
    } catch (err) {
      console.error('Помилка завантаження стейджів:', err);
    } finally {
      setLoading(false);
    }
  }, [filters.vacancyId]);

  // ── Завантаження вакансій та HR (для фільтрів) ─────────────────────────────
  const loadMetadata = useCallback(async () => {
    try {
      const [vacRes, usersRes] = await Promise.all([
        axios.get('/api/vacancies/'),
        axios.get('/api/users/'),
      ]);
      setVacancies(vacRes.data.results ?? vacRes.data);
      setHrUsers(usersRes.data.results ?? usersRes.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // ── Завантаження кандидатів з фільтрами (якщо не використовуємо propCandidates)
  const loadFilteredCandidates = useCallback(async () => {
    if (propCandidates) return; // якщо передані ззовні — не завантажуємо самі
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.vacancyId) params.set('vacancy', filters.vacancyId);
      if (filters.assignedTo) params.set('assigned_to', filters.assignedTo);
      if (filters.searchQuery) params.set('search', filters.searchQuery);
      params.set('page_size', 500);

      const res = await axios.get(`/api/candidates/?${params.toString()}`);
      setCandidates(res.data.results ?? res.data);
    } catch (err) {
      console.error('Помилка завантаження кандидатів:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, propCandidates]);

  useEffect(() => {
    loadStages();
    loadMetadata();
  }, [loadStages, loadMetadata]);

  useEffect(() => {
    loadFilteredCandidates();
  }, [loadFilteredCandidates]);

  // ── Drop кандидата в колонку ───────────────────────────────────────────────
  const handleDrop = async (candidateId, stageId) => {
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate || candidate.stage === stageId) return;

    // Перевірка: чи не terminal stage
    const targetStage = stages.find(s => s.id === stageId);
    if (targetStage?.is_terminal) return;

    // Оптимістичний update
    setCandidates(prev => prev.map(c =>
      c.id === candidateId ? { ...c, stage: stageId, stage_id: stageId } : c
    ));

    try {
      await axios.patch(`/api/candidates/${candidateId}/update_status/`, { stage_id: stageId });
      onCandidateMoved?.();
    } catch (err) {
      console.error(err);
      loadFilteredCandidates();
    }
  };

  // ── Редагувати/видалити стейдж ─────────────────────────────────────────────
  const handleEditStage = async (stageData) => {
    setSaving(true);
    try {
      if (stageData._delete) {
        await axios.delete(`/api/vacancy-stages/${stageData.id}/`);
        setStages(prev => prev.filter(s => s.id !== stageData.id));
      } else if (stageData.id) {
        const res = await axios.patch(`/api/vacancy-stages/${stageData.id}/`, {
          name: stageData.name, color: stageData.color, is_terminal: stageData.is_terminal,
        });
        setStages(prev => prev.map(s => s.id === stageData.id ? res.data : s));
      } else {
        const payload = {
          name: stageData.name,
          color: stageData.color,
          is_terminal: stageData.is_terminal,
          order: stages.length,
          ...(filters.vacancyId ? { vacancy: filters.vacancyId } : {}),
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
    if (!filters.vacancyId) return;
    try {
      const res = await axios.post(`/api/vacancies/${filters.vacancyId}/copy_org_stages/`);
      setStages(res.data);
      setIsOrgTemplate(false);
    } catch (err) {
      console.error(err);
    }
  };

  // ── Скинути до шаблону орг ─────────────────────────────────────────────────
  const handleResetToOrg = async () => {
    if (!filters.vacancyId) return;
    if (!window.confirm('Скинути до шаблону організації? Кастомні стейджі цієї вакансії буде видалено.')) return;
    try {
      const res = await axios.post('/api/vacancy-stages/reset_to_org/', { vacancy_id: filters.vacancyId });
      setStages(res.data);
      setIsOrgTemplate(true);
    } catch (err) {
      console.error(err);
    }
  };

  // ── Зміна фільтрів ─────────────────────────────────────────────────────────
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // ── Кандидати по стейджах ──────────────────────────────────────────────────
  const getCandidatesForStage = (stageId) =>
    candidates.filter(c => (c.stage === stageId || c.stage_id === stageId));

  // ── Відкриття картки кандидата ─────────────────────────────────────────────
  const handleOpenCandidate = (candidate) => {
    setSelectedCandidate(candidate);
  };

  // ── Оновлення після зміни статусу в модалі ─────────────────────────────────
  const handleStatusChange = (id, newStageId) => {
    setCandidates(prev => prev.map(c =>
      c.id === id ? { ...c, stage: newStageId, stage_id: newStageId } : c
    ));
    onCandidateMoved?.();
  };

  // ── Видалення кандидата ────────────────────────────────────────────────────
  const handleDeleteCandidate = (id) => {
    setCandidates(prev => prev.filter(c => c.id !== id));
    onCandidateMoved?.();
  };

  if (loading && stages.length === 0) return (
    <div style={{textAlign:'center', padding:'40px', color:'var(--muted)', fontSize:'0.85rem'}}>
      Завантаження канбану...
    </div>
  );

  return (
    <div style={{display:'flex', flexDirection:'column', gap:'12px', height:'100%'}}>

      {/* ── Фільтри (НОВІ) ── */}
      <KanbanFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        vacancies={vacancies}
        hrUsers={hrUsers}
        isMobile={isMobile}
      />

      {/* ── Тулбар ── */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        gap:'8px', flexWrap:'wrap', flexShrink:0,
      }}>
        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
          <span style={{fontSize:'0.78rem', color:'var(--muted)', fontFamily:'DM Mono'}}>
            {stages.length} етап{stages.length===1?'':stages.length<5?'и':'ів'}
            {isOrgTemplate && filters.vacancyId && (
              <span style={{marginLeft:'6px', color:'#ca8a04'}}> · шаблон орг</span>
            )}
            {filters.vacancyId && !isOrgTemplate && (
              <span style={{marginLeft:'6px', color:'#16a34a'}}> · кастомний</span>
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
          {filters.vacancyId && isOrgTemplate && (
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
          {filters.vacancyId && !isOrgTemplate && (
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
              onOpenCandidate={handleOpenCandidate}
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

      {/* ── Модаль картки кандидата ── */}
      {selectedCandidate && (
        <CandidateCardModal
          candidateId={selectedCandidate.id}
          onClose={() => setSelectedCandidate(null)}
          onStatusChange={handleStatusChange}
          onDelete={handleDeleteCandidate}
        />
      )}
    </div>
  );
}

export default Kanban;