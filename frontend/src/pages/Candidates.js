import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axiosConfig';
import Loader from '../components/Loader';
import CandidateCardModal from '../components/CandidateCardModal';
import {
  SOURCE_FILTERS, getSourceLabel, getSourceBg, getSourceText,
  getHrAvatarColor,
} from '../constants/statusColors';

const formatDate = (dateString) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';
  return `${String(date.getDate()).padStart(2,'0')}.${String(date.getMonth()+1).padStart(2,'0')}.${date.getFullYear()}`;
};

// Бейдж статусу — використовує stage_name/stage_color якщо є, інакше fallback
function StageBadge({ candidate }) {
  const name  = candidate.stage_name  || candidate.status_label || candidate.status || '—';
  const color = candidate.stage_color || '#757575';
  const r = parseInt(color.slice(1,3)||'75',16);
  const g = parseInt(color.slice(3,5)||'75',16);
  const b = parseInt(color.slice(5,7)||'75',16);
  const bg = `rgba(${r},${g},${b},0.12)`;
  return (
    <span style={{
      fontSize:'0.66rem', fontFamily:'DM Mono', padding:'3px 8px',
      borderRadius:'4px', background: bg, color,
    }}>
      {name}
    </span>
  );
}

function Candidates({ searchQuery = '' }) {
  const [filter,       setFilter]       = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [tagFilter,    setTagFilter]    = useState([]);
  const [candidates,   setCandidates]   = useState([]);
  const [stages,       setStages]       = useState([]);   // org-level stages для фільтрів
  const [loading,      setLoading]      = useState(true);
  const [exporting,    setExporting]    = useState(false);
  const [currentPage,  setCurrentPage]  = useState(1);
  const [totalPages,   setTotalPages]   = useState(1);
  const [totalCount,   setTotalCount]   = useState(0);
  const [isMobile,     setIsMobile]     = useState(false);
  const [mineFilter,   setMineFilter]   = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [availableTags, setAvailableTags] = useState([]);
  const PAGE_SIZE = 20;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Завантажуємо теги і стейджі орг для фільтрів
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
    // Фільтр по system_key (сумісність) або stage_id
    if (filter !== 'all') {
      // Перевіряємо чи це system_key або числовий id
      if (/^\d+$/.test(filter)) {
        params.set('stage', filter);
      } else {
        params.set('status', filter);
      }
    }
    if (sourceFilter !== 'all') params.set('source',      sourceFilter);
    if (searchQuery)             params.set('search',      searchQuery);
    if (mineFilter)              params.set('mine',        'true');
    if (tagFilter.length > 0)   params.set('tags',        tagFilter.join(','));

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
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [filter, sourceFilter, searchQuery, mineFilter, tagFilter]);

  useEffect(() => { setCurrentPage(1); }, [filter, sourceFilter, searchQuery, mineFilter, tagFilter]);
  useEffect(() => { fetchCandidates(currentPage); }, [fetchCandidates, currentPage]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all')       params.set('status', filter);
      if (sourceFilter !== 'all') params.set('source', sourceFilter);
      if (searchQuery)            params.set('search', searchQuery);
      if (tagFilter.length > 0)  params.set('tags',   tagFilter.join(','));
      const response = await axios.get(`/api/candidates/export/?${params.toString()}`, { responseType:'blob' });
      const blob = new Blob([response.data], { type:'text/csv;charset=utf-8;' });
      const url  = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `candidates_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch { alert('Не вдалося експортувати CSV'); }
    finally  { setExporting(false); }
  };

  // Формуємо фільтри статусу: спочатку статичні system_key, потім кастомні стейджі
  const stageFilters = [
    { key:'all', label:'Всі' },
    ...stages.map(s => ({
      key:   s.system_key || String(s.id),
      label: s.name,
      color: s.color,
    })),
  ];
  // Якщо стейджі ще не завантажились — fallback до статичних
  const activeStatusFilters = stages.length > 0 ? stageFilters : STATUS_FILTERS;

  return (
    <div style={{ padding: isMobile ? '8px' : '0' }}>

      {/* ── Фільтри ── */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'16px', alignItems:'center', flexWrap:'wrap' }}>

        {/* Мої */}
        <button
          onClick={() => setMineFilter(!mineFilter)}
          style={{
            padding: isMobile ? '8px 14px' : '6px 14px', borderRadius:'20px',
            border: `1px solid ${mineFilter ? 'var(--accent)' : 'var(--border)'}`,
            background: mineFilter ? 'var(--accent)' : 'var(--surface)',
            color: mineFilter ? '#fff' : 'var(--muted)',
            fontSize:'0.78rem', fontWeight:500, cursor:'pointer', fontFamily:'DM Sans',
            transition:'all 0.15s', marginRight:'4px',
          }}
        >
          👤 {mineFilter ? 'Мої' : 'Всі'}
        </button>

        {/* Статуси / стейджі */}
        {activeStatusFilters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: isMobile ? '8px 14px' : '6px 14px', borderRadius:'20px',
              fontSize:'0.78rem', fontWeight:500, cursor:'pointer',
              border: filter === f.key
                ? `1px solid ${f.color || 'var(--accent)'}`
                : '1px solid var(--border)',
              background: filter === f.key
                ? (f.color ? f.color + '20' : 'var(--accent)')
                : 'var(--surface)',
              color: filter === f.key
                ? (f.color || '#fff')
                : 'var(--muted)',
              transition:'all 0.15s',
            }}
          >
            {filter === f.key && f.color && (
              <span style={{
                display:'inline-block', width:'6px', height:'6px',
                borderRadius:'50%', background: f.color,
                marginRight:'5px', verticalAlign:'middle',
              }}/>
            )}
            {f.label}
          </button>
        ))}

        <div style={{ width:'1px', height:'20px', background:'var(--border)', margin:'0 4px' }} />

        {/* Джерела */}
        {SOURCE_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setSourceFilter(f.key)}
            style={{
              padding: isMobile ? '8px 14px' : '6px 14px', borderRadius:'20px',
              fontSize:'0.78rem', fontWeight:500, cursor:'pointer',
              border: `1px solid ${sourceFilter === f.key ? 'var(--accent)' : 'var(--border)'}`,
              background: sourceFilter === f.key ? 'var(--accent)' : 'var(--surface)',
              color: sourceFilter === f.key ? '#fff' : 'var(--muted)',
              transition:'all 0.15s',
            }}
          >
            {f.label}
          </button>
        ))}

        {/* Теги */}
        {availableTags.length > 0 && (
          <>
            <div style={{ width:'1px', height:'20px', background:'var(--border)', margin:'0 4px' }} />
            <span style={{ fontFamily:'DM Mono', fontSize:'0.7rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'1px' }}>Теги:</span>
            {availableTags.map(tag => (
              <button
                key={tag.id}
                onClick={() => setTagFilter(prev =>
                  prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                )}
                style={{
                  padding:'4px 10px', borderRadius:'20px', fontSize:'0.72rem',
                  fontWeight:500, cursor:'pointer',
                  border: `1px solid ${tagFilter.includes(tag.id) ? tag.color : 'var(--border)'}`,
                  background: tagFilter.includes(tag.id) ? tag.color + '20' : 'var(--surface)',
                  color: tagFilter.includes(tag.id) ? tag.color : 'var(--muted)',
                  transition:'all 0.15s',
                }}
              >
                {tag.name}
              </button>
            ))}
          </>
        )}
      </div>

      {/* ── Верхня панель: кількість + експорт ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
        <div style={{ fontSize:'0.78rem', color:'var(--muted)', fontFamily:'DM Mono' }}>
          {loading ? 'Завантаження...' : `${totalCount} кандидат${totalCount===1?'':totalCount<5?'и':'ів'}`}
        </div>
        <button
          onClick={handleExportCSV}
          disabled={exporting}
          style={{
            padding:'6px 14px', borderRadius:'8px',
            border:'1px solid var(--border)', background:'var(--surface)',
            cursor: exporting ? 'not-allowed' : 'pointer',
            fontSize:'0.78rem', fontFamily:'DM Mono',
            opacity: exporting ? 0.6 : 1,
          }}
        >
          {exporting ? 'Експорт...' : '⬇ CSV'}
        </button>
      </div>

      {/* ── Таблиця / Картки ── */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'12px', overflow:'hidden' }}>
        {isMobile ? (
          <div>
            {loading ? (
              <div style={{ padding:'40px', textAlign:'center' }}><Loader /></div>
            ) : candidates.length === 0 ? (
              <div style={{ padding:'40px', textAlign:'center', color:'var(--muted)', fontSize:'0.82rem', fontFamily:'DM Mono' }}>
                Кандидатів не знайдено
              </div>
            ) : candidates.map((c, i) => (
              <div
                key={c.id || i}
                onClick={() => setSelectedCandidateId(c.id)}
                style={{
                  padding:'14px 16px', borderBottom:'1px solid var(--border)',
                  cursor:'pointer', transition:'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:'0.88rem' }}>{c.first_name} {c.last_name}</div>
                    <div style={{ fontSize:'0.72rem', color:'var(--muted)', fontFamily:'DM Mono', marginTop:'2px' }}>{c.email}</div>
                  </div>
                  <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                    <StageBadge candidate={c} />
                    <span style={{
                      fontSize:'0.66rem', fontFamily:'DM Mono', padding:'3px 8px', borderRadius:'4px',
                      background: getSourceBg(c.source), color: getSourceText(c.source),
                    }}>
                      {getSourceLabel(c.source)}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize:'0.78rem', color:'var(--muted)', marginBottom:'4px' }}>{c.vacancy_title || '—'}</div>
                {c.tags?.length > 0 && (
                  <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', marginBottom:'4px' }}>
                    {c.tags.map(tag => (
                      <span key={tag.id} style={{
                        fontSize:'0.6rem', fontFamily:'DM Mono', padding:'2px 6px', borderRadius:'10px',
                        background: tag.color + '20', border:`1px solid ${tag.color}`, color: tag.color,
                      }}>{tag.name}</span>
                    ))}
                  </div>
                )}
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'4px' }}>
                  {c.assigned_to && (
                    <div style={{
                      width:'20px', height:'20px', borderRadius:'50%',
                      background: getHrAvatarColor(c.assigned_to),
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:'0.55rem', fontWeight:700, color:'#fff',
                    }} title={c.assigned_to_name || c.assigned_to_username}>
                      {(c.assigned_to_name?.[0] || c.assigned_to_username?.[0] || '?').toUpperCase()}
                    </div>
                  )}
                  <div style={{ fontFamily:'DM Mono', fontSize:'0.7rem', color:'var(--muted)' }}>{formatDate(c.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'var(--bg)' }}>
                {['Кандидат','Вакансія','Етап','Теги','Джерело','HR / Дата'].map(h => (
                  <th key={h} style={{
                    padding:'11px 16px', textAlign:'left',
                    fontSize:'0.72rem', fontFamily:'DM Mono', color:'var(--muted)',
                    textTransform:'uppercase', letterSpacing:'0.8px',
                    borderBottom:'1px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding:'40px', textAlign:'center' }}><Loader /></td></tr>
              ) : candidates.length === 0 ? (
                <tr><td colSpan={6} style={{ padding:'40px', textAlign:'center', color:'var(--muted)', fontSize:'0.82rem', fontFamily:'DM Mono' }}>Кандидатів не знайдено</td></tr>
              ) : candidates.map((c, i) => (
                <tr
                  key={c.id || i}
                  style={{ borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background 0.1s' }}
                  onClick={() => setSelectedCandidateId(c.id)}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding:'13px 16px' }}>
                    <div style={{ fontWeight:600, fontSize:'0.82rem' }}>{c.first_name} {c.last_name}</div>
                    <div style={{ fontSize:'0.72rem', color:'var(--muted)', fontFamily:'DM Mono', marginTop:'1px' }}>{c.email}</div>
                  </td>
                  <td style={{ padding:'13px 16px', fontSize:'0.82rem' }}>{c.vacancy_title || '—'}</td>
                  <td style={{ padding:'13px 16px' }}>
                    <StageBadge candidate={c} />
                  </td>
                  <td style={{ padding:'13px 16px' }}>
                    <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                      {c.tags?.map(tag => (
                        <span key={tag.id} style={{
                          fontSize:'0.6rem', fontFamily:'DM Mono', padding:'2px 6px', borderRadius:'10px',
                          background: tag.color + '20', border:`1px solid ${tag.color}`, color: tag.color,
                        }}>{tag.name}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding:'13px 16px' }}>
                    <span style={{
                      fontSize:'0.66rem', fontFamily:'DM Mono', padding:'3px 8px', borderRadius:'4px',
                      background: getSourceBg(c.source), color: getSourceText(c.source),
                    }}>{getSourceLabel(c.source)}</span>
                  </td>
                  <td style={{ padding:'13px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      {c.assigned_to && (
                        <div style={{
                          width:'22px', height:'22px', borderRadius:'50%',
                          background: getHrAvatarColor(c.assigned_to),
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:'0.6rem', fontWeight:700, color:'#fff', flexShrink:0,
                        }} title={c.assigned_to_name || c.assigned_to_username}>
                          {(c.assigned_to_name?.[0] || c.assigned_to_username?.[0] || '?').toUpperCase()}
                        </div>
                      )}
                      <span style={{ fontFamily:'DM Mono', fontSize:'0.72rem', color:'var(--muted)' }}>{formatDate(c.created_at)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Пагінація ── */}
      {totalPages > 1 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', marginTop:'20px', flexWrap:'wrap' }}>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            style={{
              padding: isMobile ? '9px 16px' : '7px 14px', borderRadius:'8px',
              border:'1px solid var(--border)', background:'var(--surface)',
              color: currentPage === 1 ? 'var(--muted)' : 'var(--text)',
              fontSize:'0.78rem', cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontFamily:'DM Mono', opacity: currentPage === 1 ? 0.5 : 1,
            }}
          >← Назад</button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx-1] > 1) acc.push('...');
              acc.push(p);
              return acc;
            }, [])
            .map((p, idx) =>
              p === '...' ? (
                <span key={`d${idx}`} style={{ padding:'0 4px', color:'var(--muted)', fontFamily:'DM Mono', fontSize:'0.78rem' }}>...</span>
              ) : (
                <button key={p} onClick={() => handlePageChange(p)} style={{
                  width: isMobile ? '42px' : '36px', height: isMobile ? '42px' : '36px', borderRadius:'8px',
                  border: `1px solid ${currentPage===p ? 'var(--accent)' : 'var(--border)'}`,
                  background: currentPage===p ? 'var(--accent)' : 'var(--surface)',
                  color: currentPage===p ? '#fff' : 'var(--text)',
                  fontSize:'0.78rem', cursor:'pointer', fontFamily:'DM Mono',
                  fontWeight: currentPage===p ? 700 : 400,
                }}>{p}</button>
              )
            )
          }

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={{
              padding: isMobile ? '9px 16px' : '7px 14px', borderRadius:'8px',
              border:'1px solid var(--border)', background:'var(--surface)',
              color: currentPage === totalPages ? 'var(--muted)' : 'var(--text)',
              fontSize:'0.78rem', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              fontFamily:'DM Mono', opacity: currentPage === totalPages ? 0.5 : 1,
            }}
          >Вперед →</button>
        </div>
      )}

      {/* ── Модаль кандидата ── */}
      {selectedCandidateId && (
        <CandidateCardModal
          candidateId={selectedCandidateId}
          onClose={() => setSelectedCandidateId(null)}
          onStatusChange={(id, stageId) => {
            setCandidates(prev => prev.map(c =>
              c.id === id ? { ...c, stage: stageId, stage_id: stageId } : c
            ));
          }}
          onDelete={(id) => {
            setCandidates(prev => prev.filter(c => c.id !== id));
            setSelectedCandidateId(null);
            setTotalCount(prev => prev - 1);
          }}
        />
      )}
    </div>
  );
}

export default Candidates;