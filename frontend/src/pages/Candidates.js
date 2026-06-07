// Candidates.js — оптимізований: React.memo, useMemo, useCallback, react-window при >300 записах
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { FixedSizeList } from 'react-window';
import axios from 'axiosConfig';
import toast from 'react-hot-toast';
import Loader from '../components/Loader';
import CandidateCardModal from '../components/CandidateCardModal';
import BulkActionBar from '../components/BulkActionBar';
import {
  STATUS_FILTERS,
  SOURCE_FILTERS, getSourceLabel, getSourceBg, getSourceText,
  getHrAvatarColor,
} from '../constants/statusColors';

const formatDate = (dateString) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
};

// ─── Кешований hex → rgba для бейджів ────────────────────────────────────────
const hex2rgbaCache = new Map();
const hex2rgba = (hex, alpha = 0.12) => {
  const key = `${hex}_${alpha}`;
  if (hex2rgbaCache.has(key)) return hex2rgbaCache.get(key);
  const r = parseInt((hex || '#757575').slice(1, 3), 16) || 117;
  const g = parseInt((hex || '#757575').slice(3, 5), 16) || 117;
  const b = parseInt((hex || '#757575').slice(5, 7), 16) || 117;
  const result = `rgba(${r},${g},${b},${alpha})`;
  hex2rgbaCache.set(key, result);
  return result;
};

// ─── StageBadge — memo, без parseInt під час рендеру ─────────────────────────
const StageBadge = memo(function StageBadge({ candidate }) {
  const name  = candidate.stage_name  || candidate.status_label || candidate.status || '—';
  const color = candidate.stage_color || '#757575';
  const bg    = useMemo(() => hex2rgba(color, 0.12), [color]);
  return (
    <span style={{ fontSize:'0.66rem', fontFamily:'DM Mono', padding:'3px 8px', borderRadius:'4px', background: bg, color }}>
      {name}
    </span>
  );
});

// ─── Checkbox ─────────────────────────────────────────────────────────────────
const CHECKBOX = memo(function Checkbox({ checked, indeterminate = false }) {
  return (
    <div style={{ width:'16px', height:'16px', borderRadius:'4px', flexShrink:0, border:`2px solid ${checked || indeterminate ? 'var(--accent)' : 'var(--border)'}`, background: checked ? 'var(--accent)' : indeterminate ? 'rgba(159,18,57,0.15)' : 'var(--surface)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all 0.1s', position:'relative' }}>
      {checked      && <span style={{ color:'#fff', fontSize:'10px', fontWeight:700, lineHeight:1, userSelect:'none' }}>✓</span>}
      {indeterminate && !checked && <span style={{ color:'var(--accent)', fontSize:'10px', fontWeight:700, lineHeight:1, userSelect:'none' }}>–</span>}
    </div>
  );
});

// ─── TableRow — memo, ре-рендер тільки при зміні самого кандидата або selected ─
const TableRow = memo(function TableRow({ candidate, isSelected, bulkMode, onOpen, onToggle, isMobile }) {
  const handleClick = useCallback(() => {
    bulkMode ? onToggle(candidate.id) : onOpen(candidate.id);
  }, [bulkMode, candidate.id, onOpen, onToggle]);

  const handleCheckboxClick = useCallback(e => {
    e.stopPropagation();
    onToggle(candidate.id);
  }, [candidate.id, onToggle]);

  const rowBg = isSelected ? 'rgba(159,18,57,0.05)' : 'transparent';

  if (isMobile) {
    return (
      <div
        onClick={handleClick}
        style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background 0.1s', background: rowBg, display:'flex', gap:'10px', alignItems:'flex-start' }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = rowBg; }}
      >
        {bulkMode && <div onClick={handleCheckboxClick} style={{ marginTop:'3px' }}><CHECKBOX checked={isSelected} /></div>}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
            <div>
              <div style={{ fontWeight:600, fontSize:'0.88rem' }}>{candidate.first_name} {candidate.last_name}</div>
              <div style={{ fontSize:'0.72rem', color:'var(--muted)', fontFamily:'DM Mono', marginTop:'2px' }}>{candidate.email}</div>
            </div>
            <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
              <StageBadge candidate={candidate} />
              <span style={{ fontSize:'0.66rem', fontFamily:'DM Mono', padding:'3px 8px', borderRadius:'4px', background:getSourceBg(candidate.source), color:getSourceText(candidate.source) }}>{getSourceLabel(candidate.source)}</span>
            </div>
          </div>
          <div style={{ fontSize:'0.78rem', color:'var(--muted)', marginBottom:'4px' }}>{candidate.vacancy_title || '—'}</div>
          {candidate.tags?.length > 0 && (
            <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', marginBottom:'4px' }}>
              {candidate.tags.map(tag => (
                <span key={tag.id} style={{ fontSize:'0.6rem', fontFamily:'DM Mono', padding:'2px 6px', borderRadius:'10px', background: tag.color + '20', border:`1px solid ${tag.color}`, color:tag.color }}>{tag.name}</span>
              ))}
            </div>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'4px' }}>
            {candidate.assigned_to && (
              <div style={{ width:'20px', height:'20px', borderRadius:'50%', background:getHrAvatarColor(candidate.assigned_to), display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.55rem', fontWeight:700, color:'#fff' }} title={candidate.assigned_to_name}>
                {(candidate.assigned_to_name?.[0] || '?').toUpperCase()}
              </div>
            )}
            <div style={{ fontFamily:'DM Mono', fontSize:'0.7rem', color:'var(--muted)' }}>{formatDate(candidate.created_at)}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <tr
      style={{ borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background 0.1s', background: rowBg }}
      onClick={handleClick}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = rowBg; }}
    >
      {bulkMode && (
        <td style={{ padding:'13px 16px' }} onClick={handleCheckboxClick}>
          <CHECKBOX checked={isSelected} />
        </td>
      )}
      <td style={{ padding:'13px 16px' }}>
        <div style={{ fontWeight:600, fontSize:'0.82rem' }}>{candidate.first_name} {candidate.last_name}</div>
        <div style={{ fontSize:'0.72rem', color:'var(--muted)', fontFamily:'DM Mono', marginTop:'1px' }}>{candidate.email}</div>
      </td>
      <td style={{ padding:'13px 16px', fontSize:'0.82rem' }}>{candidate.vacancy_title || '—'}</td>
      <td style={{ padding:'13px 16px' }}><StageBadge candidate={candidate} /></td>
      <td style={{ padding:'13px 16px' }}>
        <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
          {candidate.tags?.map(tag => (
            <span key={tag.id} style={{ fontSize:'0.6rem', fontFamily:'DM Mono', padding:'2px 6px', borderRadius:'10px', background: tag.color + '20', border:`1px solid ${tag.color}`, color:tag.color }}>{tag.name}</span>
          ))}
        </div>
      </td>
      <td style={{ padding:'13px 16px' }}>
        <span style={{ fontSize:'0.66rem', fontFamily:'DM Mono', padding:'3px 8px', borderRadius:'4px', background:getSourceBg(candidate.source), color:getSourceText(candidate.source) }}>{getSourceLabel(candidate.source)}</span>
      </td>
      <td style={{ padding:'13px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          {candidate.assigned_to && (
            <div style={{ width:'22px', height:'22px', borderRadius:'50%', background:getHrAvatarColor(candidate.assigned_to), display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.6rem', fontWeight:700, color:'#fff', flexShrink:0 }} title={candidate.assigned_to_name}>
              {(candidate.assigned_to_name?.[0] || '?').toUpperCase()}
            </div>
          )}
          <span style={{ fontFamily:'DM Mono', fontSize:'0.72rem', color:'var(--muted)' }}>{formatDate(candidate.created_at)}</span>
        </div>
      </td>
    </tr>
  );
}, (prev, next) => (
  prev.candidate  === next.candidate  &&
  prev.isSelected === next.isSelected &&
  prev.bulkMode   === next.bulkMode   &&
  prev.isMobile   === next.isMobile
));

// ─── VirtualRow — обгортка для react-window ───────────────────────────────────
// Використовується тільки при >300 записах на мобільному списку
function VirtualRow({ index, style, data }) {
  const { candidates, selectedSet, bulkMode, onOpen, onToggle } = data;
  const c = candidates[index];
  return (
    <div style={style}>
      <TableRow
        candidate={c}
        isSelected={selectedSet.has(c.id)}
        bulkMode={bulkMode}
        onOpen={onOpen}
        onToggle={onToggle}
        isMobile
      />
    </div>
  );
}

// ─── Поріг для віртуалізації ──────────────────────────────────────────────────
const VIRTUALIZE_THRESHOLD = 300;
const VIRTUAL_ROW_HEIGHT   = 130; // px — приблизна висота мобільного рядка

// ─── Головний компонент ───────────────────────────────────────────────────────
function Candidates({ searchQuery = '' }) {
  const [filter,       setFilter]       = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [tagFilter,    setTagFilter]    = useState([]);
  const [candidates,   setCandidates]   = useState([]);
  const [stages,       setStages]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [exporting,    setExporting]    = useState(false);
  const [currentPage,  setCurrentPage]  = useState(1);
  const [totalPages,   setTotalPages]   = useState(1);
  const [totalCount,   setTotalCount]   = useState(0);
  const [isMobile,     setIsMobile]     = useState(false);
  const [mineFilter,   setMineFilter]   = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [availableTags, setAvailableTags] = useState([]);
  const [bulkMode,     setBulkMode]     = useState(false);
  const [selectedIds,  setSelectedIds]  = useState([]);

  const PAGE_SIZE = 20;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    axios.get('/api/tags/')
      .then(res => setAvailableTags(res.data.results ?? res.data))
      .catch(() => {});
    axios.get('/api/vacancy-stages/', { params: { org_template: true } })
      .then(res => setStages(res.data.results ?? res.data))
      .catch(() => {});
  }, []);

  const fetchCandidates = useCallback((page = 1) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page',      page);
    params.set('page_size', PAGE_SIZE);
    if (filter !== 'all') {
      if (/^\d+$/.test(filter)) params.set('stage',  filter);
      else                       params.set('status', filter);
    }
    if (sourceFilter !== 'all') params.set('source', sourceFilter);
    if (searchQuery)             params.set('search', searchQuery);
    if (mineFilter)              params.set('mine',   'true');
    if (tagFilter.length > 0)   params.set('tags',   tagFilter.join(','));

    axios.get(`/api/candidates/?${params.toString()}`)
      .then(res => {
        if (res.data.results !== undefined) {
          setCandidates(res.data.results);
          setTotalPages(res.data.total_pages || 1);
          setTotalCount(res.data.count || 0);
        } else {
          setCandidates(res.data);
          setTotalPages(1);
          setTotalCount(res.data.length);
        }
        setSelectedIds([]);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [filter, sourceFilter, searchQuery, mineFilter, tagFilter]);

  useEffect(() => { setCurrentPage(1); }, [filter, sourceFilter, searchQuery, mineFilter, tagFilter]);
  useEffect(() => { fetchCandidates(currentPage); }, [fetchCandidates, currentPage]);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleExportCSV = useCallback(async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all')       params.set('status', filter);
      if (sourceFilter !== 'all') params.set('source', sourceFilter);
      if (searchQuery)            params.set('search', searchQuery);
      if (tagFilter.length > 0)  params.set('tags',   tagFilter.join(','));
      const response = await axios.get(`/api/candidates/export/?${params.toString()}`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url  = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `candidates_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('CSV експортовано');
    } catch { toast.error('Не вдалося експортувати CSV'); }
    finally  { setExporting(false); }
  }, [filter, sourceFilter, searchQuery, tagFilter]);

  // ── Bulk ─────────────────────────────────────────────────────────────────────
  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds(prev => prev.length === candidates.length ? [] : candidates.map(c => c.id));
  }, [candidates]);

  const handleToggleBulkMode = useCallback(() => {
    setBulkMode(v => !v);
    setSelectedIds([]);
  }, []);

  // Set для O(1) lookup замість .includes()
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const allSelected  = candidates.length > 0 && selectedIds.length === candidates.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < candidates.length;

  // ── Фільтри стейджів — мемоізовані ───────────────────────────────────────────
  const stageFilters = useMemo(() => [
    { key: 'all', label: 'Всі' },
    ...stages.map(s => ({ key: s.system_key || String(s.id), label: s.name, color: s.color })),
  ], [stages]);

  const activeStatusFilters = stages.length > 0 ? stageFilters : STATUS_FILTERS;

  // ── Чи потрібна віртуалізація ─────────────────────────────────────────────────
  const useVirtualization = isMobile && candidates.length > VIRTUALIZE_THRESHOLD;

  // ── Дані для VirtualRow (стабільний об'єкт) ──────────────────────────────────
  const virtualListData = useMemo(() => ({
    candidates,
    selectedSet,
    bulkMode,
    onOpen:   setSelectedCandidateId,
    onToggle: toggleSelect,
  }), [candidates, selectedSet, bulkMode, toggleSelect]);

  // ── Callbacks ─────────────────────────────────────────────────────────────────
  const handleCandidateStatusChange = useCallback((id, stageId) => {
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, stage: stageId, stage_id: stageId } : c));
  }, []);

  const handleCandidateDelete = useCallback((id) => {
    setCandidates(prev => prev.filter(c => c.id !== id));
    setSelectedCandidateId(null);
    setTotalCount(prev => prev - 1);
  }, []);

  const handleBulkClear = useCallback(() => setSelectedIds([]), []);
  const handleBulkDone  = useCallback(() => { fetchCandidates(currentPage); setSelectedIds([]); }, [fetchCandidates, currentPage]);

  const handleMineToggle    = useCallback(() => setMineFilter(v => !v), []);
  const handleFilterSet     = useCallback((key) => setFilter(key), []);
  const handleSourceFilter  = useCallback((key) => setSourceFilter(key), []);
  const handleTagToggle     = useCallback((id) => {
    setTagFilter(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  // ── Пагінація — мемоізована ───────────────────────────────────────────────────
  const paginationPages = useMemo(() =>
    Array.from({ length: totalPages }, (_, i) => i + 1)
      .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
      .reduce((acc, p, idx, arr) => {
        if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
        acc.push(p);
        return acc;
      }, []),
    [totalPages, currentPage]
  );

  return (
    <div style={{ padding: isMobile ? '8px' : '0' }}>

      {/* ── Фільтри ── */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'16px', alignItems:'center', flexWrap:'wrap' }}>
        <button onClick={handleMineToggle} style={{ padding: isMobile ? '8px 14px' : '6px 14px', borderRadius:'20px', border:`1px solid ${mineFilter ? 'var(--accent)' : 'var(--border)'}`, background: mineFilter ? 'var(--accent)' : 'var(--surface)', color: mineFilter ? '#fff' : 'var(--muted)', fontSize:'0.78rem', fontWeight:500, cursor:'pointer', fontFamily:'DM Sans', transition:'all 0.15s', marginRight:'4px' }}>
          👤 {mineFilter ? 'Мої' : 'Всі'}
        </button>

        {activeStatusFilters.map(f => (
          <button key={f.key} onClick={() => handleFilterSet(f.key)} style={{ padding: isMobile ? '8px 14px' : '6px 14px', borderRadius:'20px', fontSize:'0.78rem', fontWeight:500, cursor:'pointer', border: filter === f.key ? `1px solid ${f.color || 'var(--accent)'}` : '1px solid var(--border)', background: filter === f.key ? (f.color ? f.color + '20' : 'var(--accent)') : 'var(--surface)', color: filter === f.key ? (f.color || '#fff') : 'var(--muted)', transition:'all 0.15s' }}>
            {filter === f.key && f.color && (
              <span style={{ display:'inline-block', width:'6px', height:'6px', borderRadius:'50%', background:f.color, marginRight:'5px', verticalAlign:'middle' }} />
            )}
            {f.label}
          </button>
        ))}

        <div style={{ width:'1px', height:'20px', background:'var(--border)', margin:'0 4px' }} />

        {SOURCE_FILTERS.map(f => (
          <button key={f.key} onClick={() => handleSourceFilter(f.key)} style={{ padding: isMobile ? '8px 14px' : '6px 14px', borderRadius:'20px', fontSize:'0.78rem', fontWeight:500, cursor:'pointer', border:`1px solid ${sourceFilter === f.key ? 'var(--accent)' : 'var(--border)'}`, background: sourceFilter === f.key ? 'var(--accent)' : 'var(--surface)', color: sourceFilter === f.key ? '#fff' : 'var(--muted)', transition:'all 0.15s' }}>{f.label}</button>
        ))}

        {availableTags.length > 0 && (
          <>
            <div style={{ width:'1px', height:'20px', background:'var(--border)', margin:'0 4px' }} />
            <span style={{ fontFamily:'DM Mono', fontSize:'0.7rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'1px' }}>Теги:</span>
            {availableTags.map(tag => (
              <button key={tag.id} onClick={() => handleTagToggle(tag.id)} style={{ padding:'4px 10px', borderRadius:'20px', fontSize:'0.72rem', fontWeight:500, cursor:'pointer', border:`1px solid ${tagFilter.includes(tag.id) ? tag.color : 'var(--border)'}`, background: tagFilter.includes(tag.id) ? tag.color + '20' : 'var(--surface)', color: tagFilter.includes(tag.id) ? tag.color : 'var(--muted)', transition:'all 0.15s' }}>{tag.name}</button>
            ))}
          </>
        )}
      </div>

      {/* ── Верхня панель ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px', gap:'8px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ fontSize:'0.78rem', color:'var(--muted)', fontFamily:'DM Mono' }}>
            {loading ? 'Завантаження...' : `${totalCount} кандидат${totalCount === 1 ? '' : totalCount < 5 ? 'и' : 'ів'}`}
            {useVirtualization && !loading && (
              <span style={{ marginLeft:'6px', color:'#ca8a04' }}>· віртуальний список</span>
            )}
          </div>
          <button onClick={handleToggleBulkMode} style={{ padding:'5px 12px', borderRadius:'7px', fontSize:'0.75rem', border:`1px solid ${bulkMode ? 'var(--accent)' : 'var(--border)'}`, background: bulkMode ? 'rgba(159,18,57,0.08)' : 'var(--surface)', color: bulkMode ? 'var(--accent)' : 'var(--muted)', cursor:'pointer', fontFamily:'DM Mono', transition:'all 0.15s' }}>
            {bulkMode ? '✓ Режим вибору' : '☐ Вибрати'}
          </button>
        </div>
        <button onClick={handleExportCSV} disabled={exporting} style={{ padding:'6px 14px', borderRadius:'8px', border:'1px solid var(--border)', background:'var(--surface)', cursor: exporting ? 'not-allowed' : 'pointer', fontSize:'0.78rem', fontFamily:'DM Mono', opacity: exporting ? 0.6 : 1 }}>
          {exporting ? 'Експорт...' : '⬇ CSV'}
        </button>
      </div>

      {/* ── Таблиця / Картки ── */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'12px', overflow:'hidden' }}>
        {isMobile ? (
          loading ? (
            <div style={{ padding:'40px', textAlign:'center' }}><Loader /></div>
          ) : candidates.length === 0 ? (
            <div style={{ padding:'40px', textAlign:'center', color:'var(--muted)', fontSize:'0.82rem', fontFamily:'DM Mono' }}>Кандидатів не знайдено</div>
          ) : useVirtualization ? (
            // ── Віртуалізований список для >300 записів ──
            <FixedSizeList
              height={Math.min(candidates.length * VIRTUAL_ROW_HEIGHT, window.innerHeight - 300)}
              itemCount={candidates.length}
              itemSize={VIRTUAL_ROW_HEIGHT}
              itemData={virtualListData}
              overscanCount={5}
            >
              {VirtualRow}
            </FixedSizeList>
          ) : (
            // ── Звичайний список ──
            candidates.map(c => (
              <TableRow
                key={c.id}
                candidate={c}
                isSelected={selectedSet.has(c.id)}
                bulkMode={bulkMode}
                onOpen={setSelectedCandidateId}
                onToggle={toggleSelect}
                isMobile
              />
            ))
          )
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'var(--bg)' }}>
                {bulkMode && (
                  <th style={{ padding:'11px 16px', width:'40px', borderBottom:'1px solid var(--border)' }}>
                    <div onClick={toggleAll}><CHECKBOX checked={allSelected} indeterminate={someSelected} /></div>
                  </th>
                )}
                {['Кандидат', 'Вакансія', 'Етап', 'Теги', 'Джерело', 'HR / Дата'].map(h => (
                  <th key={h} style={{ padding:'11px 16px', textAlign:'left', fontSize:'0.72rem', fontFamily:'DM Mono', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.8px', borderBottom:'1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={bulkMode ? 7 : 6} style={{ padding:'40px', textAlign:'center' }}><Loader /></td></tr>
              ) : candidates.length === 0 ? (
                <tr><td colSpan={bulkMode ? 7 : 6} style={{ padding:'40px', textAlign:'center', color:'var(--muted)', fontSize:'0.82rem', fontFamily:'DM Mono' }}>Кандидатів не знайдено</td></tr>
              ) : candidates.map(c => (
                <TableRow
                  key={c.id}
                  candidate={c}
                  isSelected={selectedSet.has(c.id)}
                  bulkMode={bulkMode}
                  onOpen={setSelectedCandidateId}
                  onToggle={toggleSelect}
                  isMobile={false}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Пагінація ── */}
      {totalPages > 1 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', marginTop:'20px', flexWrap:'wrap' }}>
          <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} style={{ padding: isMobile ? '9px 16px' : '7px 14px', borderRadius:'8px', border:'1px solid var(--border)', background:'var(--surface)', color: currentPage === 1 ? 'var(--muted)' : 'var(--text)', fontSize:'0.78rem', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontFamily:'DM Mono', opacity: currentPage === 1 ? 0.5 : 1 }}>← Назад</button>
          {paginationPages.map((p, idx) =>
            p === '...'
              ? <span key={`d${idx}`} style={{ padding:'0 4px', color:'var(--muted)', fontFamily:'DM Mono', fontSize:'0.78rem' }}>...</span>
              : <button key={p} onClick={() => handlePageChange(p)} style={{ width: isMobile ? '42px' : '36px', height: isMobile ? '42px' : '36px', borderRadius:'8px', border:`1px solid ${currentPage === p ? 'var(--accent)' : 'var(--border)'}`, background: currentPage === p ? 'var(--accent)' : 'var(--surface)', color: currentPage === p ? '#fff' : 'var(--text)', fontSize:'0.78rem', cursor:'pointer', fontFamily:'DM Mono', fontWeight: currentPage === p ? 700 : 400 }}>{p}</button>
          )}
          <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} style={{ padding: isMobile ? '9px 16px' : '7px 14px', borderRadius:'8px', border:'1px solid var(--border)', background:'var(--surface)', color: currentPage === totalPages ? 'var(--muted)' : 'var(--text)', fontSize:'0.78rem', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontFamily:'DM Mono', opacity: currentPage === totalPages ? 0.5 : 1 }}>Вперед →</button>
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

export default Candidates;