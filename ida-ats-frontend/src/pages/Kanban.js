import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import Loader from '../components/Loader';

const columns = [
  { key: 'new',       label: 'Нові',       color: '#7a1a2e' },
  { key: 'screening', label: 'Скринінг',   color: '#b03050' },
  { key: 'interview', label: 'Співбесіда', color: '#8a3a5a' },
  { key: 'offer',     label: 'Оффер',      color: '#e8a0b0' },
  { key: 'rejected',  label: 'Відмова',    color: '#aaaaaa' },
];

const statusColors = {
  new:       { bg: '#f9eaed', text: '#7a1a2e' },
  screening: { bg: '#fff3e0', text: '#c94f2a' },
  interview: { bg: '#f5eaf0', text: '#8a3a5a' },
  offer:     { bg: '#fce4ec', text: '#c2185b' },
  rejected:  { bg: '#f5f5f5', text: '#757575' },
};

const statusLabels = {
  new: 'Новий', screening: 'Скринінг', interview: 'Співбесіда', offer: 'Оффер', rejected: 'Відмова'
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
};

function Kanban({ searchQuery = '', orgId = null }) {
  const [filter, setFilter] = useState('all');
  const [candidates, setCandidates] = useState([]);
  const [vacancies, setVacancies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
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

  useEffect(() => { setFilter('all'); }, [orgId]);

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
    const matchesSearch = searchQuery === '' ||
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.vacancy_title && c.vacancy_title.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const vacancyFilters = [
    { key: 'all', label: 'Всі' },
    ...vacancies.map(v => ({ key: `vac_${v.id}`, label: v.title, id: v.id })),
  ];

  if (loading) return <Loader />;

  return (
    <div style={{ padding: isMobile ? '8px' : '0' }}>
      {/* Фільтри */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'DM Mono', fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Вакансія:
        </span>
        {vacancyFilters.map(v => (
          <div
            key={v.key}
            onClick={() => setFilter(v.key)}
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
            style={{ padding: isMobile ? '6px 12px' : '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '0.72rem', cursor: 'pointer', marginLeft: '8px' }}
          >
            ✕ Скинути
          </button>
        )}
      </div>

      {/* Summary */}
      <div style={{
        display: 'flex', gap: isMobile ? '12px' : '20px',
        padding: isMobile ? '10px 12px' : '10px 16px',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '16px',
        flexWrap: 'wrap',
      }}>
        {columns.map(col => {
          const count = filtered.filter(c => c.status === col.key).length;
          return (
            <div key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--muted)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color }} />
              <strong style={{ color: 'var(--text)', fontFamily: 'DM Mono' }}>{count}</strong> {col.label.toLowerCase()}
            </div>
          );
        })}
      </div>

      {/* Канбан */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div style={{
          display: 'flex', gap: isMobile ? '8px' : '16px',
          overflowX: 'auto', paddingBottom: '16px',
          scrollSnapType: isMobile ? 'x mandatory' : 'none',
          WebkitOverflowScrolling: 'touch',
        }}>
          {columns.map(col => {
            const cards = filtered.filter(c => c.status === col.key);
            return (
              <div key={col.key} style={{
                width: isMobile ? '85vw' : '250px',
                flexShrink: 0,
                scrollSnapAlign: isMobile ? 'start' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 4px', marginBottom: '10px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: col.color }} />
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
                              <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: '10px' }}>{c.vacancy_title}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.66rem', fontFamily: 'DM Mono', padding: '3px 8px', borderRadius: '4px', background: statusColors[c.status]?.bg, color: statusColors[c.status]?.text }}>
                                  {statusLabels[c.status]}
                                </span>
                                <span style={{ fontSize: '0.62rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
                                  {formatDate(c.created_at)}
                                </span>
                                <div style={{ marginLeft: 'auto', width: '24px', height: '24px', borderRadius: '6px', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'var(--muted)' }}>
                                  {c.first_name?.[0]}{c.last_name?.[0]}
                                </div>
                              </div>
                              {isMobile && (
                                <div style={{ marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                                  <select
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
                                    {columns.map(col => (
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
    </div>
  );
}

export default Kanban;