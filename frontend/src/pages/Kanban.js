// Kanban.js — оптимізований: React.memo, useMemo, useCallback, без react-window (картки drag-and-drop несумісні з віртуалізацією)
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import axios from 'axiosConfig';
import toast from 'react-hot-toast';
import CandidateCardModal from '../components/CandidateCardModal';
import BulkActionBar from '../components/BulkActionBar';
import { KanbanSkeleton } from '../components/SkeletonComponents';

const STAGE_COLORS = [
  '#7a1a2e','#b03050','#8a3a5a','#c2185b','#e8a0b0',
  '#c94f2a','#16a34a','#2563eb','#7c3aed','#db2777',
  '#0891b2','#ca8a04','#4f46e5','#059669','#dc2626',
];

// ─── Кешований hex2rgba ───────────────────────────────────────────────────────
const hex2rgbaCache = new Map();
const hex2rgba = (hex, alpha = 0.12) => {
  const key = `${hex}_${alpha}`;
  if (hex2rgbaCache.has(key)) return hex2rgbaCache.get(key);
  if (!hex || hex.length < 7) {
    const result = `rgba(122,26,46,${alpha})`;
    hex2rgbaCache.set(key, result);
    return result;
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const result = `rgba(${r},${g},${b},${alpha})`;
  hex2rgbaCache.set(key, result);
  return result;
};

// ─── StageEditor ─────────────────────────────────────────────────────────────
const StageEditor = memo(function StageEditor({ stage, onSave, onDelete, onClose }) {
  const [name,       setName]       = useState(stage?.name       || '');
  const [color,      setColor]      = useState(stage?.color      || '#7a1a2e');
  const [isTerminal, setIsTerminal] = useState(stage?.is_terminal || false);
  const isNew = !stage?.id;

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = useCallback(() => {
    if (name.trim()) onSave({ ...stage, name: name.trim(), color, is_terminal: isTerminal });
  }, [name, color, isTerminal, stage, onSave]);

  const handleDelete = useCallback(() => {
    onDelete(stage.id);
    onClose();
  }, [stage?.id, onDelete, onClose]);

  return (
    <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:300, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'12px', padding:'16px', width:'240px', boxShadow:'0 8px 32px rgba(0,0,0,0.18)' }}>
      <div style={{ fontWeight:700, fontSize:'0.85rem', marginBottom:'12px' }}>{isNew ? '+ Новий етап' : 'Редагувати етап'}</div>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Назва етапу"
        autoFocus
        style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:'7px', fontSize:'0.85rem', fontFamily:'DM Sans', background:'var(--bg)', marginBottom:'10px', outline:'none' }}
      />
      <div style={{ display:'flex', flexWrap:'wrap', gap:'5px', marginBottom:'10px' }}>
        {STAGE_COLORS.map(c => (
          <button key={c} onClick={() => setColor(c)} style={{ width:'20px', height:'20px', borderRadius:'50%', background:c, border: color === c ? '2px solid #fff' : '2px solid transparent', outline: color === c ? `2px solid ${c}` : 'none', cursor:'pointer', padding:0, flexShrink:0 }} />
        ))}
      </div>
      <label style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'0.8rem', marginBottom:'12px', cursor:'pointer' }}>
        <input type="checkbox" checked={isTerminal} onChange={e => setIsTerminal(e.target.checked)} />
        Фінальний етап
      </label>
      <div style={{ display:'flex', gap:'6px' }}>
        <button onClick={onClose} style={{ flex:1, padding:'7px', borderRadius:'7px', border:'1px solid var(--border)', background:'transparent', cursor:'pointer', fontSize:'0.78rem' }}>Скасувати</button>
        {!isNew && onDelete && (
          <button onClick={handleDelete} style={{ padding:'7px 10px', borderRadius:'7px', border:'none', background:'#fee2e2', color:'#dc2626', cursor:'pointer', fontSize:'0.78rem' }}>🗑</button>
        )}
        <button onClick={handleSave} disabled={!name.trim()} style={{ flex:1, padding:'7px', borderRadius:'7px', border:'none', background: name.trim() ? 'var(--accent)' : 'var(--border)', color: name.trim() ? '#fff' : 'var(--muted)', cursor: name.trim() ? 'pointer' : 'not-allowed', fontSize:'0.78rem', fontWeight:600 }}>Зберегти</button>
      </div>
    </div>
  );
});

// ─── CandidateCard — memo, порівняння через id+selected ──────────────────────
const CandidateCard = memo(function CandidateCard({ candidate, onOpen, bulkMode, selected, onToggle, anonymousMode }) {
  const tags = useMemo(() => candidate.tags?.slice(0, 2) || [], [candidate.tags]);

  const displayName = anonymousMode
    ? `CAND-${String(candidate.id).padStart(4, '0')}`
    : `${candidate.first_name} ${candidate.last_name}`;

  return (
    <div
      draggable={!bulkMode}
      onDragStart={e => {
        if (bulkMode) { e.preventDefault(); return; }
        e.dataTransfer.setData('candidateId', String(candidate.id));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => bulkMode ? onToggle(candidate.id) : onOpen(candidate.id)}
      style={{
        background: selected ? 'rgba(159,18,57,0.06)' : 'var(--surface)',
        border: selected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
        borderRadius:'10px', padding:'12px',
        cursor: bulkMode ? 'pointer' : 'grab',
        transition:'box-shadow 0.15s, border 0.15s', userSelect:'none',
        display:'flex', gap:'8px', alignItems:'flex-start',
        willChange: 'box-shadow',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      {bulkMode && (
        <div style={{ width:'15px', height:'15px', borderRadius:'3px', flexShrink:0, marginTop:'2px', border:`2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`, background: selected ? 'var(--accent)' : 'var(--surface)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          {selected && <span style={{ color:'#fff', fontSize:'9px', fontWeight:700 }}>✓</span>}
        </div>
      )}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:'0.85rem', marginBottom:'3px', display:'flex', alignItems:'center', gap:'6px' }}>
          {displayName}
          {anonymousMode && (
            <span style={{ fontSize:'0.58rem', fontFamily:'DM Mono', padding:'1px 5px', borderRadius:'3px', background:'#fef3c7', color:'#92400e' }}>
              анонім
            </span>
          )}
        </div>
        {candidate.vacancy_title && (
          <div style={{ fontSize:'0.72rem', color:'var(--muted)', fontFamily:'DM Mono', marginBottom:'6px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {candidate.vacancy_title}
          </div>
        )}
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center' }}>
          {!anonymousMode && candidate.assigned_to_name && (
            <span style={{ fontSize:'0.68rem', color:'var(--muted)', fontFamily:'DM Mono' }}>👤 {candidate.assigned_to_name}</span>
          )}
          {tags.map(t => (
            <span key={t.id} style={{ fontSize:'0.65rem', padding:'1px 6px', borderRadius:'10px', background: hex2rgba(t.color || '#7a1a2e', 0.15), color: t.color || '#7a1a2e', fontWeight:600 }}>{t.name}</span>
          ))}
        </div>
      </div>
    </div>
  );
}, (prev, next) => (
  prev.candidate     === next.candidate &&
  prev.selected      === next.selected  &&
  prev.bulkMode      === next.bulkMode  &&
  prev.anonymousMode === next.anonymousMode
));

// ─── KanbanColumn — memo ──────────────────────────────────────────────────────
const KanbanColumn = memo(function KanbanColumn({ stage, candidates, onDrop, onOpen, onEdit, onDelete, isFirst, isLast, onMoveLeft, onMoveRight, isMobile, bulkMode, selectedIds, onToggle, anonymousMode }) {
  const [dragOver,   setDragOver]   = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  const colSelected = useMemo(
    () => candidates.filter(c => selectedIds.includes(c.id)).length,
    [candidates, selectedIds]
  );

  // Стабільні Set-lookup замість .includes() — O(1)
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const headerBg      = useMemo(() => hex2rgba(stage.color, 0.12), [stage.color]);
  const headerBadgeBg = useMemo(() => hex2rgba(stage.color, 0.25), [stage.color]);
  const dragBg        = useMemo(() => hex2rgba(stage.color, 0.06), [stage.color]);

  const handleDragOver = useCallback(e => {
    if (!bulkMode) { e.preventDefault(); setDragOver(true); }
  }, [bulkMode]);

  const handleDragLeave = useCallback(e => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false);
  }, []);

  const handleDrop = useCallback(e => {
    e.preventDefault();
    setDragOver(false);
    const id = parseInt(e.dataTransfer.getData('candidateId'));
    if (id) onDrop(id, stage.id);
  }, [onDrop, stage.id]);

  const handleEditSave = useCallback(s => {
    onEdit(s);
    setShowEditor(false);
  }, [onEdit]);

  const toggleEditor = useCallback(() => setShowEditor(v => !v), []);
  const closeEditor  = useCallback(() => setShowEditor(false), []);

  return (
    <div
      style={{ minWidth: isMobile ? '82vw' : '240px', maxWidth: isMobile ? '82vw' : '280px', flex:'0 0 auto', display:'flex', flexDirection:'column', background: dragOver ? dragBg : 'var(--bg)', border: dragOver ? `2px dashed ${stage.color}` : '2px solid transparent', borderRadius:'12px', transition:'background 0.15s, border 0.15s', padding:'6px', position:'relative' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 10px', marginBottom:'8px', borderRadius:'8px', background: headerBg }}>
        <div style={{ display:'flex', alignItems:'center', gap:'7px', minWidth:0 }}>
          <span style={{ width:'9px', height:'9px', borderRadius:'50%', background:stage.color, flexShrink:0 }} />
          <span style={{ fontWeight:700, fontSize:'0.82rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{stage.name}</span>
          <span style={{ fontSize:'0.68rem', fontFamily:'DM Mono', flexShrink:0, background: headerBadgeBg, color:stage.color, padding:'1px 7px', borderRadius:'10px' }}>
            {colSelected > 0 ? `${colSelected}/` : ''}{candidates.length}
          </span>
        </div>
        <div style={{ display:'flex', gap:'1px', alignItems:'center', position:'relative', flexShrink:0 }}>
          {!isFirst && <button onClick={onMoveLeft}  style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:'0.72rem', padding:'2px 3px' }}>←</button>}
          {!isLast  && <button onClick={onMoveRight} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:'0.72rem', padding:'2px 3px' }}>→</button>}
          <button onClick={toggleEditor} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:'1rem', padding:'2px 4px', borderRadius:'4px' }}>⋯</button>
          {showEditor && (
            <StageEditor stage={stage} onSave={handleEditSave} onDelete={onDelete} onClose={closeEditor} />
          )}
        </div>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'8px', overflowY:'auto', minHeight:'60px', maxHeight:'calc(100vh - 260px)', padding:'0 2px 4px' }}>
        {candidates.map(c => (
          <CandidateCard
            key={c.id}
            candidate={c}
            onOpen={onOpen}
            bulkMode={bulkMode}
            selected={selectedSet.has(c.id)}
            onToggle={onToggle}
            anonymousMode={anonymousMode}
          />
        ))}
        {candidates.length === 0 && (
          <div style={{ textAlign:'center', padding:'20px 0', color:'var(--muted)', fontSize:'0.72rem', fontFamily:'DM Mono', border:'1.5px dashed var(--border)', borderRadius:'8px' }}>Немає кандидатів</div>
        )}
      </div>
    </div>
  );
});

// ─── KanbanFilters — memo ────────────────────────────────────────────────────
const KanbanFilters = memo(function KanbanFilters({ vacancies, hrList, filters, onChange, isMobile }) {
  const inputStyle = { padding:'6px 10px', border:'1px solid var(--border)', borderRadius:'7px', fontSize:'0.8rem', fontFamily:'DM Sans', background:'var(--bg)', outline:'none', cursor:'pointer' };
  const hasActive = filters.search || filters.vacancy || filters.hr || filters.mine;

  return (
    <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--border)', marginBottom:'12px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'6px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'7px', padding:'6px 10px', flex: isMobile ? '1 1 100%' : '1 1 180px', maxWidth:'260px' }}>
        <span style={{ color:'var(--muted)', fontSize:'0.8rem' }}>🔍</span>
        <input
          value={filters.search}
          onChange={e => onChange('search', e.target.value)}
          placeholder="Пошук кандидата..."
          style={{ border:'none', background:'transparent', outline:'none', fontSize:'0.8rem', fontFamily:'DM Sans', width:'100%' }}
        />
        {filters.search && (
          <button onClick={() => onChange('search', '')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:'0.8rem', padding:0 }}>✕</button>
        )}
      </div>
      <select value={filters.vacancy} onChange={e => onChange('vacancy', e.target.value)} style={inputStyle}>
        <option value="">Всі вакансії</option>
        {vacancies.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
      </select>
      <select value={filters.hr} onChange={e => onChange('hr', e.target.value)} style={inputStyle}>
        <option value="">Всі HR</option>
        {hrList.map(h => <option key={h.id} value={h.id}>{h.first_name} {h.last_name || h.username}</option>)}
      </select>
      <label style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'0.8rem', cursor:'pointer', userSelect:'none' }}>
        <input type="checkbox" checked={filters.mine} onChange={e => onChange('mine', e.target.checked)} style={{ width:'15px', height:'15px' }} />
        Мої
      </label>
      {hasActive && (
        <button onClick={() => onChange('_reset', null)} style={{ padding:'6px 10px', borderRadius:'7px', border:'none', background:'var(--border)', color:'var(--muted)', cursor:'pointer', fontSize:'0.78rem' }}>✕ Скинути</button>
      )}
    </div>
  );
});

// ─── Головний компонент ───────────────────────────────────────────────────────
function Kanban({ searchQuery = '' }) {
  const [stages,              setStages]             = useState([]);
  const [candidates,          setCandidates]         = useState([]);
  const [vacancies,           setVacancies]          = useState([]);
  const [hrList,              setHrList]             = useState([]);
  const [loading,             setLoading]            = useState(true);
  const [saving,              setSaving]             = useState(false);
  const [isOrgTemplate,       setIsOrgTemplate]      = useState(true);
  const [showAddStage,        setShowAddStage]       = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [isMobile,            setIsMobile]           = useState(false);
  const [currentVacancyId,    setCurrentVacancyId]   = useState('');
  const [bulkMode,            setBulkMode]           = useState(false);
  const [selectedIds,         setSelectedIds]        = useState([]);
  const [anonymousMode,       setAnonymousMode]      = useState(false);
  const [filters,             setFilters]            = useState({ search: searchQuery, vacancy: '', hr: '', mine: false });

  useEffect(() => { setFilters(f => ({ ...f, search: searchQuery })); }, [searchQuery]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    Promise.all([axios.get('/api/vacancies/'), axios.get('/api/users/')])
      .then(([vacRes, usersRes]) => {
        setVacancies(vacRes.data.results ?? vacRes.data);
        setHrList(usersRes.data.results ?? usersRes.data);
      })
      .catch(console.error);
  }, []);

  const loadStages = useCallback(async () => {
    try {
      const params = currentVacancyId ? { vacancy: currentVacancyId } : { org_template: true };
      const res = await axios.get('/api/vacancy-stages/', { params });
      const data = res.data.results ?? res.data;
      setStages(data);
      setIsOrgTemplate(!currentVacancyId || data.every(s => !s.vacancy));
    } catch (err) { console.error('Помилка стейджів:', err); }
  }, [currentVacancyId]);

  useEffect(() => { loadStages(); }, [loadStages]);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page_size', '200');
      if (filters.search)  params.set('search',     filters.search);
      if (filters.vacancy) params.set('vacancy',     filters.vacancy);
      if (filters.hr)      params.set('assigned_to', filters.hr);
      if (filters.mine)    params.set('mine',        'true');
      if (currentVacancyId && !filters.vacancy) params.set('vacancy', currentVacancyId);
      const res = await axios.get(`/api/candidates/?${params}`);
      setCandidates(res.data.results ?? res.data);
      setSelectedIds([]);
    } catch (err) { console.error('Помилка кандидатів:', err); }
    finally { setLoading(false); }
  }, [filters, currentVacancyId]);

  useEffect(() => { loadCandidates(); }, [loadCandidates]);

  // ── Кандидати по стейджах — один прохід O(n) замість n*stages проходів ──────
  const candidatesByStage = useMemo(() => {
    const map = new Map();
    for (const stage of stages) map.set(stage.id, []);
    for (const c of candidates) {
      const stageId = c.stage_id ?? c.stage;
      if (map.has(stageId)) map.get(stageId).push(c);
    }
    return map;
  }, [candidates, stages]);

  const totalVisible = candidates.length;

  const handleFilterChange = useCallback((key, value) => {
    if (key === '_reset') setFilters({ search: '', vacancy: '', hr: '', mine: false });
    else setFilters(f => ({ ...f, [key]: value }));
  }, []);

  const handleDrop = useCallback(async (candidateId, stageId) => {
    if (bulkMode) return;
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate) return;
    if ((candidate.stage_id ?? candidate.stage) === stageId) return;
    setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, stage: stageId, stage_id: stageId } : c));
    try {
      await axios.patch(`/api/candidates/${candidateId}/update_status/`, { stage: stageId });
    } catch (err) { console.error(err); loadCandidates(); }
  }, [bulkMode, candidates, loadCandidates]);

  const handleSaveStage = useCallback(async (stageData) => {
    setSaving(true);
    try {
      if (stageData.id) {
        const res = await axios.patch(`/api/vacancy-stages/${stageData.id}/`, { name: stageData.name, color: stageData.color, is_terminal: stageData.is_terminal });
        setStages(prev => prev.map(s => s.id === stageData.id ? res.data : s));
      } else {
        const payload = { name: stageData.name, color: stageData.color, is_terminal: stageData.is_terminal, order: stages.length, ...(currentVacancyId ? { vacancy: currentVacancyId } : {}) };
        const res = await axios.post('/api/vacancy-stages/', payload);
        setStages(prev => [...prev, res.data]);
      }
    } catch (err) { console.error(err); toast.error('Не вдалося зберегти зміни'); }
    finally { setSaving(false); }
  }, [stages.length, currentVacancyId]);

  const handleDeleteStage = useCallback(async (stageId) => {
    if (!window.confirm('Видалити цей етап? Кандидати в ньому не будуть видалені.')) return;
    setSaving(true);
    try {
      await axios.delete(`/api/vacancy-stages/${stageId}/`);
      setStages(prev => prev.filter(s => s.id !== stageId));
    } catch (err) { console.error(err); toast.error('Помилка видалення'); }
    finally { setSaving(false); }
  }, []);

  const handleReorder = useCallback(async (fromIdx, toIdx) => {
    const reordered = [...stages];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setStages(reordered);
    try { await axios.post('/api/vacancy-stages/reorder/', { ordered_ids: reordered.map(s => s.id) }); }
    catch (err) { console.error(err); loadStages(); }
  }, [stages, loadStages]);

  const handleCopyOrgTemplate = useCallback(async () => {
    if (!currentVacancyId) return;
    try {
      const res = await axios.post(`/api/vacancies/${currentVacancyId}/copy_org_stages/`);
      setStages(res.data);
      setIsOrgTemplate(false);
    } catch (err) { console.error(err); }
  }, [currentVacancyId]);

  const handleResetToOrg = useCallback(async () => {
    if (!currentVacancyId) return;
    if (!window.confirm('Скинути до шаблону організації?')) return;
    try {
      const res = await axios.post('/api/vacancy-stages/reset_to_org/', { vacancy_id: currentVacancyId });
      setStages(res.data);
      setIsOrgTemplate(true);
    } catch (err) { console.error(err); }
  }, [currentVacancyId]);

  const handleToggleBulk = useCallback((id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const handleToggleBulkMode = useCallback(() => {
    setBulkMode(v => !v);
    setSelectedIds([]);
  }, []);

  const handleCandidateStatusChange = useCallback((id, stageId) => {
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, stage: stageId, stage_id: stageId } : c));
  }, []);

  const handleCandidateDelete = useCallback((id) => {
    setCandidates(prev => prev.filter(c => c.id !== id));
    setSelectedCandidateId(null);
  }, []);

  const handleAddStageClose  = useCallback(() => setShowAddStage(false), []);
  const handleAddStageSave   = useCallback(s => { handleSaveStage(s); setShowAddStage(false); }, [handleSaveStage]);
  const handleAddStageToggle = useCallback(() => setShowAddStage(v => !v), []);

  const handleBulkClear = useCallback(() => setSelectedIds([]), []);
  const handleBulkDone  = useCallback(() => { loadCandidates(); setSelectedIds([]); }, [loadCandidates]);

  // Стабільні callbacks для колонок — не змінюються при ре-рендері
  const columnMoveHandlers = useMemo(() =>
    stages.map((_, idx) => ({
      onMoveLeft:  () => handleReorder(idx, idx - 1),
      onMoveRight: () => handleReorder(idx, idx + 1),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stages.length, handleReorder]
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', gap:0 }}>

      {/* ── Тулбар ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', flexWrap:'wrap', marginBottom:'8px', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
          <select value={currentVacancyId} onChange={e => setCurrentVacancyId(e.target.value)} style={{ padding:'7px 12px', border:'1px solid var(--border)', borderRadius:'8px', fontSize:'0.82rem', fontFamily:'DM Sans', background:'var(--bg)', outline:'none', cursor:'pointer', maxWidth:'220px' }}>
            <option value="">🏢 Шаблон організації</option>
            {vacancies.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
          </select>
          <span style={{ fontSize:'0.72rem', color:'var(--muted)', fontFamily:'DM Mono' }}>
            {stages.length} етап{stages.length === 1 ? '' : stages.length < 5 ? 'и' : 'ів'}
            {isOrgTemplate && currentVacancyId && <span style={{ color:'#ca8a04' }}> · шаблон орг</span>}
            {saving && <span> · збереження...</span>}
          </span>
        </div>

        <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
          <button
            onClick={() => setAnonymousMode(v => !v)}
            title="Анонімний скринінг — приховує імена та контакти"
            style={{ padding:'6px 12px', borderRadius:'7px', fontSize:'0.78rem', border:`1px solid ${anonymousMode ? '#7c3aed' : 'var(--border)'}`, background: anonymousMode ? 'rgba(124,58,237,0.08)' : 'var(--surface)', color: anonymousMode ? '#7c3aed' : 'var(--muted)', cursor:'pointer', fontFamily:'DM Mono', transition:'all 0.15s' }}>
            {anonymousMode ? '🙈 Анонім' : '👁 Анонім'}
          </button>
          <button onClick={handleToggleBulkMode} style={{ padding:'6px 12px', borderRadius:'7px', fontSize:'0.78rem', border:`1px solid ${bulkMode ? 'var(--accent)' : 'var(--border)'}`, background: bulkMode ? 'rgba(159,18,57,0.08)' : 'var(--surface)', color: bulkMode ? 'var(--accent)' : 'var(--muted)', cursor:'pointer', fontFamily:'DM Mono', transition:'all 0.15s' }}>
            {bulkMode ? `✓ ${selectedIds.length} обрано` : '☐ Вибрати'}
          </button>
          {currentVacancyId && isOrgTemplate && (
            <button onClick={handleCopyOrgTemplate} style={{ padding:'6px 12px', borderRadius:'7px', border:'1px solid var(--border)', background:'var(--surface)', cursor:'pointer', fontSize:'0.78rem' }}>✏️ Кастомізувати</button>
          )}
          {currentVacancyId && !isOrgTemplate && (
            <button onClick={handleResetToOrg} style={{ padding:'6px 12px', borderRadius:'7px', border:'1px solid var(--border)', background:'var(--surface)', cursor:'pointer', fontSize:'0.78rem', color:'var(--muted)' }}>↺ До шаблону</button>
          )}
          <div style={{ position:'relative' }}>
            <button onClick={handleAddStageToggle} style={{ padding:'6px 14px', borderRadius:'7px', border:'none', background:'var(--accent)', color:'#fff', cursor:'pointer', fontSize:'0.78rem', fontWeight:600 }}>+ Етап</button>
            {showAddStage && (
              <StageEditor stage={null} onSave={handleAddStageSave} onDelete={null} onClose={handleAddStageClose} />
            )}
          </div>
        </div>
      </div>

      <KanbanFilters vacancies={vacancies} hrList={hrList} filters={filters} onChange={handleFilterChange} isMobile={isMobile} />

      {totalVisible > 0 && (
        <div style={{ fontSize:'0.72rem', color:'var(--muted)', fontFamily:'DM Mono', marginBottom:'8px', flexShrink:0 }}>
          {totalVisible} кандидат{totalVisible === 1 ? '' : totalVisible < 5 ? 'и' : 'ів'}
          {bulkMode && selectedIds.length > 0 && <span style={{ color:'var(--accent)', marginLeft:'8px' }}>· {selectedIds.length} обрано</span>}
        </div>
      )}

      {loading ? (
        <KanbanSkeleton columns={Math.max(stages.length, 4)} />
      ) : (
        <div style={{ display:'flex', gap:'12px', overflowX:'auto', flex:1, paddingBottom:'8px', alignItems:'flex-start', scrollSnapType: isMobile ? 'x mandatory' : 'none' }}>
          {stages.map((stage, idx) => (
            <div key={stage.id} style={{ scrollSnapAlign: isMobile ? 'start' : 'none', height:'100%' }}>
              <KanbanColumn
                stage={stage}
                candidates={candidatesByStage.get(stage.id) ?? []}
                onDrop={handleDrop}
                onOpen={setSelectedCandidateId}
                onEdit={handleSaveStage}
                onDelete={handleDeleteStage}
                isFirst={idx === 0}
                isLast={idx === stages.length - 1}
                onMoveLeft={columnMoveHandlers[idx]?.onMoveLeft}
                onMoveRight={columnMoveHandlers[idx]?.onMoveRight}
                isMobile={isMobile}
                bulkMode={bulkMode}
                selectedIds={selectedIds}
                onToggle={handleToggleBulk}
                anonymousMode={anonymousMode}
              />
            </div>
          ))}
          {stages.length === 0 && (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)', fontSize:'0.85rem' }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:'10px' }}>📋</div>
                <div style={{ fontWeight:600, marginBottom:'4px' }}>Немає етапів</div>
                <div style={{ fontSize:'0.78rem', fontFamily:'DM Mono' }}>Натисніть «+ Етап» щоб додати першу колонку</div>
              </div>
            </div>
          )}
        </div>
      )}

      <BulkActionBar selectedIds={selectedIds} onClear={handleBulkClear} onDone={handleBulkDone} />

      {selectedCandidateId && (
        <CandidateCardModal
          candidateId={selectedCandidateId}
          onClose={() => setSelectedCandidateId(null)}
          onStatusChange={handleCandidateStatusChange}
          onDelete={handleCandidateDelete}
        />
      )}
    </div>
  );
}

export default Kanban;