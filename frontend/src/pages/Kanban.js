import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import Loader from '../components/Loader';
import CandidateCardModal from '../components/CandidateCardModal';
import { KANBAN_COLUMNS, SOURCE_FILTERS, getStatusLabel, getStatusBg, getStatusText, getHrAvatarColor, getSourceLabel, getSourceBg, getSourceText } from '../constants/statusColors';

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
};

function Kanban({ searchQuery = '', orgId = null }) {
  const [filter, setFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [mineFilter, setMineFilter] = useState(false);
  const [tagFilter, setTagFilter] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [vacancies, setVacancies] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    axios.get('/api/me/').then(res => setCurrentUserId(res.data.id)).catch(() => {});
    axios.get('/api/tags/').then(res => setAvailableTags(res.data.results ?? res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const candUrl = orgId
      ? `/api/candidates/?organization=${orgId}&page_size=200`
      : '/api/candidates/?page_size=200';
    const vacUrl = orgId
      ? `/api/vacancies/?organization=${orgId}`
      : '/api/vacancies/';

    Promise.all([axios.get(candUrl), axios.get(vacUrl)])
      .then(([candidatesRes, vacanciesRes]) => {
        setCandidates(candidatesRes.data.results ?? candidatesRes.data);
        setVacancies(vacanciesRes.data.results ?? vacanciesRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId]);

  useEffect(() => { setFilter('all'); setSourceFilter('all'); setTagFilter([]); }, [orgId]);

  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const candidateId = parseInt(draggableId);
    const newStatus = destination.droppableId;
    setCandidates(prev => prev.map(c =>
      c.id === candidateId ? { ...c, status: newStatus } : c
    ));
    axios.patch(`/api/candidates/${candidateId}/update_status/`, { status: newStatus })
      .catch(() => {
        setCandidates(prev => prev.map(c =>
          c.id === candidateId ? { ...c, status: source.droppableId } : c
        ));
      });
  };

  const handleStatusChange = (candidateId, newStatus) => {
    setCandidates(prev => prev.map(c =>
      c.id === candidateId ? { ...c, status: newStatus } : c
    ));
    axios.patch(`/api/candidates/${candidateId}/update_status/`, { status: newStatus })
      .catch(() => {
        setCandidates(prev => prev.map(c =>
          c.id === candidateId ? { ...c, status: c.status } : c
        ));
      });
  };

  const filtered = candidates.filter(c => {
    const matchesFilter = filter === 'all'
      ? true
      : c.vacancy === parseInt(filter.replace('vac_', ''));
    const matchesSource = sourceFilter === 'all'
      ? true
      : c.source === sourceFilter;
    const matchesSearch = searchQuery === '' ||
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.vacancy_title && c.vacancy_title.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesMine = !mineFilter || c.assigned_to === currentUserId;
    const matchesTags = tagFilter.length === 0 || (c.tags && c.tags.some(t => tagFilter.includes(t.id)));
    return matchesFilter && matchesSource && matchesSearch && matchesMine && matchesTags;
  });

  const vacancyFilters = [
    { key: 'all', label: 'Всі' },
    ...vacancies.map(v => ({ key: `vac_${v.id}`, label: v.title, id: v.id })),
  ];

  if (loading) return <Loader />;

  return (
    <div style={{ padding: isMobile ? '8px' : '0' }}>
      {/* ─── Filters ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {/* Vacancy filter */}
        <span style={{ fontFamily: 'DM Mono', fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Вакансія:
        </span>
        {vacancyFilters.map(v => (
          <div
            key={v.key}
            onClick={() => setFilter(v.key)}
            role="button"
            tabIndex={0}
            aria-label={`Фільтр за вакансією: ${v.label}`}
            aria-pressed={filter === v.key}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFilter(v.key); }}}
            style={{
              padding: isMobile ? '8px 14px' : '6px 12px', borderRadius: '20px', fontSize: '0.78rem',
              fontWeight: 500, cursor: 'pointer',
              border: `1px solid ${filter === v.key ? 'var(--accent)' : 'var(--border)'}`,
              background: filter === v.key ? 'var(--accent)' : 'var(--surface)',
              color: filter === v.key ? '#fff' : 'var(--muted)',
              transition: 'all 0.15s',
            }}
          >
            {v.label}
          </div>
        ))}
        {filter !== 'all' && (
          <button
            onClick={() => setFilter('all')}
            aria-label="Скинути фільтр вакансій"
            type="button"
            style={{ padding: isMobile ? '6px 12px' : '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '0.72rem', cursor: 'pointer', marginLeft: '8px' }}
          >
            <span aria-hidden="true">✕</span> Скинути
          </button>
        )}

        {/* Source filter */}
        <span style={{ fontFamily: 'DM Mono', fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', marginLeft: '12px' }}>
          Джерело:
        </span>
        {SOURCE_FILTERS.map(f => (
          <div
            key={f.key}
            onClick={() => setSourceFilter(f.key)}
            role="button"
            tabIndex={0}
            aria-label={`Фільтр за джерелом: ${f.label}`}
            aria-pressed={sourceFilter === f.key}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSourceFilter(f.key); }}}
            style={{
              padding: isMobile ? '8px 14px' : '6px 12px', borderRadius: '20px', fontSize: '0.78rem',
              fontWeight: 500, cursor: 'pointer',
              border: `1px solid ${sourceFilter === f.key ? 'var(--accent)' : 'var(--border)'}`,
              background: sourceFilter === f.key ? 'var(--accent)' : 'var(--surface)',
              color: sourceFilter === f.key ? '#fff' : 'var(--muted)',
              transition: 'all 0.15s',
            }}
          >
            {f.label}
          </div>
        ))}
        {sourceFilter !== 'all' && (
          <button
            onClick={() => setSourceFilter('all')}
            aria-label="Скинути фільтр джерел"
            type="button"
            style={{ padding: isMobile ? '6px 12px' : '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '0.72rem', cursor: 'pointer', marginLeft: '8px' }}
          >
            <span aria-hidden="true">✕</span> Скинути
          </button>
        )}

        {/* Tag filters */}
        {availableTags.length > 0 && (
          <>
            <span style={{ fontFamily: 'DM Mono', fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', marginLeft: '12px' }}>
              Теги:
            </span>
            {availableTags.map(tag => (
              <div
                key={tag.id}
                onClick={() => setTagFilter(prev => prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id])}
                style={{
                  padding: '4px 10px', borderRadius: '20px', fontSize: '0.72rem',
                  fontWeight: 500, cursor: 'pointer',
                  border: `1px solid ${tagFilter.includes(tag.id) ? tag.color : 'var(--border)'}`,
                  background: tagFilter.includes(tag.id) ? tag.color + '20' : 'var(--surface)',
                  color: tagFilter.includes(tag.id) ? tag.color : 'var(--muted)',
                }}
              >
                {tag.name}
              </div>
            ))}
            {tagFilter.length > 0 && (
              <button
                onClick={() => setTagFilter([])}
                style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '0.72rem', cursor: 'pointer' }}
              >
                ✕ Скинути
              </button>
            )}
          </>
        )}

        {/* Mine filter */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setMineFilter(!mineFilter)}
            aria-label={mineFilter ? 'Показати всіх кандидатів' : 'Показати тільки моїх кандидатів'}
            aria-pressed={mineFilter}
            type="button"
            style={{
              padding: isMobile ? '8px 14px' : '6px 12px',
              borderRadius: '20px',
              border: `1px solid ${mineFilter ? 'var(--accent)' : 'var(--border)'}`,
              background: mineFilter ? 'var(--accent)' : 'var(--surface)',
              color: mineFilter ? '#fff' : 'var(--muted)',
              fontSize: '0.78rem',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'DM Sans',
              transition: 'all 0.15s',
            }}
          >
            <span aria-hidden="true">👤</span> {mineFilter ? 'Мої кандидати' : 'Всі кандидати'}
          </button>
        </div>
      </div>

      {/* ─── Summary ────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: isMobile ? '12px' : '20px',
        padding: isMobile ? '10px 12px' : '10px 16px',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '16px',
        flexWrap: 'wrap',
      }}>
        {KANBAN_COLUMNS.map(col => {
          const count = filtered.filter(c => c.status === col.key).length;
          return (
            <div key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--muted)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color }} aria-hidden="true" />
              <strong style={{ color: 'var(--text)', fontFamily: 'DM Mono' }}>{count}</strong> {col.label.toLowerCase()}
            </div>
          );
        })}
      </div>

      {/* ─── Kanban Board ───────────────────────────────────── */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div style={{
          display: 'flex', gap: isMobile ? '8px' : '16px',
          overflowX: 'auto', paddingBottom: '16px',
          scrollSnapType: isMobile ? 'x mandatory' : 'none',
          WebkitOverflowScrolling: 'touch',
        }}>
          {KANBAN_COLUMNS.map(col => {
            const cards = filtered.filter(c => c.status === col.key);
            return (
              <div key={col.key} style={{
                width: isMobile ? '85vw' : '280px',
                flexShrink: 0,
                scrollSnapAlign: isMobile ? 'start' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 4px', marginBottom: '10px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: col.color }} aria-hidden="true" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{col.label}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: 'DM Mono', fontSize: '0.7rem', background: 'var(--surface2)', color: 'var(--muted)', padding: '2px 8px', borderRadius: '20px' }}>
                    {cards.length}
                  </span>
                </div>
                <Droppable droppableId={col.key} isDropDisabled={isMobile}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      style={{
                        minHeight: '80px', borderRadius: '10px',
                        background: snapshot.isDraggingOver ? 'rgba(var(--accent-rgb), 0.05)' : 'transparent',
                        border: snapshot.isDraggingOver ? '1px dashed var(--accent)' : '1px dashed transparent',
                        transition: 'all 0.15s', padding: '2px',
                      }}
                    >
                      {cards.length === 0 && (
                        <div style={{
                          textAlign: 'center', padding: '30px 16px', color: 'var(--muted)',
                          fontSize: '0.78rem', border: '1px dashed var(--border)', borderRadius: '10px',
                          opacity: snapshot.isDraggingOver ? 0 : 1, transition: 'opacity 0.15s', pointerEvents: 'none',
                        }}>
                          Перетягніть кандидата сюди
                        </div>
                      )}
                      {cards.map((c, i) => (
                        <Draggable key={c.id} draggableId={String(c.id)} index={i} isDragDisabled={isMobile}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              role="button"
                              tabIndex={0}
                              aria-label={`Кандидат ${c.first_name} ${c.last_name}, вакансія ${c.vacancy_title}, статус ${getStatusLabel(c.status)}. Натисніть пробіл, щоб підняти.`}
                              onClick={() => !snapshot.isDragging && setSelectedCandidateId(c.id)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setSelectedCandidateId(c.id);
                                }
                              }}
                              style={{
                                background: 'var(--surface)',
                                border: `1px solid ${snapshot.isDragging ? 'var(--accent)' : 'var(--border)'}`,
                                borderRadius: '10px', padding: isMobile ? '12px' : '14px', marginBottom: '10px',
                                cursor: isMobile ? 'default' : 'grab',
                                boxShadow: snapshot.isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : 'var(--shadow)',
                                transition: 'box-shadow 0.15s',
                                ...provided.draggableProps.style,
                              }}
                            >
                              <div style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '4px' }}>{c.first_name} {c.last_name}</div>
                              <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: '6px' }}>{c.vacancy_title}</div>
                              
                              {/* Tags */}
                              {c.tags && c.tags.length > 0 && (
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px', marginBottom: '8px' }}>
                                  {c.tags.map(tag => (
                                    <span key={tag.id} style={{
                                      fontSize: '0.6rem', fontFamily: 'DM Mono', padding: '2px 6px',
                                      borderRadius: '10px', background: tag.color + '20',
                                      border: `1px solid ${tag.color}`, color: tag.color,
                                    }}>
                                      {tag.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.66rem', fontFamily: 'DM Mono', padding: '3px 8px', borderRadius: '4px', background: getStatusBg(c.status), color: getStatusText(c.status) }}>
                                  {getStatusLabel(c.status)}
                                </span>
                                {c.source && c.source !== 'other' && (
                                  <span style={{ fontSize: '0.62rem', fontFamily: 'DM Mono', padding: '2px 6px', borderRadius: '4px', background: getSourceBg(c.source), color: getSourceText(c.source) }}>
                                    {getSourceLabel(c.source)}
                                  </span>
                                )}
                                <span style={{ fontSize: '0.62rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
                                  {formatDate(c.created_at)}
                                </span>
                                {c.assigned_to ? (
                                  <div
                                    style={{
                                      marginLeft: 'auto',
                                      width: '24px',
                                      height: '24px',
                                      borderRadius: '50%',
                                      background: getHrAvatarColor(c.assigned_to),
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '0.6rem',
                                      fontWeight: 700,
                                      color: '#fff',
                                      flexShrink: 0,
                                    }}
                                    title={c.assigned_to_name || c.assigned_to_username || 'HR'}
                                    aria-label={`Призначено: ${c.assigned_to_name || c.assigned_to_username || 'HR'}`}
                                  >
                                    {(c.assigned_to_name?.[0] || c.assigned_to_username?.[0] || '?').toUpperCase()}
                                  </div>
                                ) : (
                                  <div style={{ marginLeft: 'auto', width: '24px', height: '24px', borderRadius: '6px', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'var(--muted)' }} aria-hidden="true">
                                    {c.first_name?.[0]}{c.last_name?.[0]}
                                  </div>
                                )}
                              </div>
                              {isMobile && (
                                <div style={{ marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                                  <label htmlFor={`status-select-${c.id}`} style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'DM Mono', display: 'block', marginBottom: '4px' }}>
                                    Змінити статус
                                  </label>
                                  <select
                                    id={`status-select-${c.id}`}
                                    value={c.status}
                                    onChange={(e) => handleStatusChange(c.id, e.target.value)}
                                    style={{
                                      width: '100%', padding: '8px 12px',
                                      border: '1px solid var(--border)', borderRadius: '6px',
                                      fontSize: '0.78rem', fontFamily: 'DM Sans',
                                      background: 'var(--bg)', color: 'var(--text)',
                                      outline: 'none', cursor: 'pointer',
                                    }}
                                  >
                                    {KANBAN_COLUMNS.map(col => (
                                      <option key={col.key} value={col.key}>{col.label}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {selectedCandidateId && (
        <CandidateCardModal
          candidateId={selectedCandidateId}
          onClose={() => setSelectedCandidateId(null)}
          onStatusChange={(id, status) => {
            setCandidates(prev => prev.map(c =>
              c.id === id ? { ...c, status } : c
            ));
          }}
          onDelete={(id) => {
            setCandidates(prev => prev.filter(c => c.id !== id));
            setSelectedCandidateId(null);
          }}
        />
      )}
    </div>
  );
}

export default Kanban;