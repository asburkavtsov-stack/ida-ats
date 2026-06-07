// SkeletonComponents.js — Loading Skeletons для Kanban, таблиці кандидатів і модалів

import React, { memo } from 'react';

// ─── Базова CSS анімація shimmer ──────────────────────────────────────────────
const SHIMMER_STYLE = `
@keyframes skeleton-shimmer {
  0%   { background-position: -600px 0; }
  100% { background-position:  600px 0; }
}
`;

let _styleInjected = false;
function injectShimmerStyle() {
  if (_styleInjected) return;
  const tag = document.createElement('style');
  tag.textContent = SHIMMER_STYLE;
  document.head.appendChild(tag);
  _styleInjected = true;
}

// ─── Базовий блок-скелетон ────────────────────────────────────────────────────
const Bone = memo(function Bone({ width = '100%', height = 14, radius = 6, style = {} }) {
  injectShimmerStyle();
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%)',
      backgroundSize: '600px 100%',
      animation: 'skeleton-shimmer 1.4s infinite linear',
      flexShrink: 0,
      ...style,
    }} />
  );
});

// ─── KanbanCardSkeleton — одна картка ────────────────────────────────────────
const KanbanCardSkeleton = memo(function KanbanCardSkeleton() {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <Bone width="70%" height={13} />
      <Bone width="50%" height={11} />
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        <Bone width={48} height={18} radius={10} />
        <Bone width={40} height={18} radius={10} />
      </div>
    </div>
  );
});

// ─── KanbanColumnSkeleton — одна колонка ─────────────────────────────────────
const KanbanColumnSkeleton = memo(function KanbanColumnSkeleton({ cardCount = 3 }) {
  return (
    <div style={{
      minWidth: 240,
      maxWidth: 280,
      flex: '0 0 auto',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg)',
      borderRadius: 12,
      border: '2px solid transparent',
      padding: 6,
    }}>
      {/* Заголовок колонки */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        marginBottom: 8,
        borderRadius: 8,
        background: 'var(--border)',
      }}>
        <Bone width={9} height={9} radius={50} />
        <Bone width={80} height={12} />
        <Bone width={24} height={18} radius={10} style={{ marginLeft: 'auto' }} />
      </div>

      {/* Картки */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: cardCount }).map((_, i) => (
          <KanbanCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
});

// ─── KanbanSkeleton — вся дошка ───────────────────────────────────────────────
export const KanbanSkeleton = memo(function KanbanSkeleton({ columns = 4 }) {
  const cardCounts = [3, 5, 2, 4, 3];
  return (
    <div style={{
      display: 'flex',
      gap: 12,
      overflowX: 'hidden',
      flex: 1,
      paddingBottom: 8,
      alignItems: 'flex-start',
    }}>
      {Array.from({ length: columns }).map((_, i) => (
        <KanbanColumnSkeleton key={i} cardCount={cardCounts[i % cardCounts.length]} />
      ))}
    </div>
  );
});

// ─── CandidateRowSkeleton — один рядок таблиці ───────────────────────────────
const CandidateRowSkeleton = memo(function CandidateRowSkeleton({ isMobile = false }) {
  if (isMobile) {
    return (
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <Bone width={130} height={13} />
              <Bone width={100} height={11} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Bone width={60} height={22} radius={4} />
              <Bone width={50} height={22} radius={4} />
            </div>
          </div>
          <Bone width="55%" height={11} />
          <div style={{ display: 'flex', gap: 4 }}>
            <Bone width={40} height={18} radius={10} />
            <Bone width={48} height={18} radius={10} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '13px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <Bone width={120} height={13} />
          <Bone width={90} height={11} />
        </div>
      </td>
      <td style={{ padding: '13px 16px' }}><Bone width={100} height={12} /></td>
      <td style={{ padding: '13px 16px' }}><Bone width={70} height={22} radius={4} /></td>
      <td style={{ padding: '13px 16px' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <Bone width={44} height={18} radius={10} />
          <Bone width={36} height={18} radius={10} />
        </div>
      </td>
      <td style={{ padding: '13px 16px' }}><Bone width={55} height={22} radius={4} /></td>
      <td style={{ padding: '13px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bone width={22} height={22} radius={50} />
          <Bone width={65} height={11} />
        </div>
      </td>
    </tr>
  );
});

// ─── CandidateTableSkeleton — вся таблиця ────────────────────────────────────
export const CandidateTableSkeleton = memo(function CandidateTableSkeleton({ rows = 8, isMobile = false }) {
  if (isMobile) {
    return (
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        {Array.from({ length: rows }).map((_, i) => (
          <CandidateRowSkeleton key={i} isMobile />
        ))}
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
            {['Кандидат', 'Вакансія', 'Етап', 'Теги', 'Джерело', 'HR / Дата'].map(h => (
              <th key={h} style={{
                padding: '11px 16px',
                textAlign: 'left',
                fontSize: '0.72rem',
                fontFamily: 'DM Mono',
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                fontWeight: 500,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <CandidateRowSkeleton key={i} isMobile={false} />
          ))}
        </tbody>
      </table>
    </div>
  );
});

// ─── ModalSkeleton — скелетон модала картки кандидата ────────────────────────
export const ModalSkeleton = memo(function ModalSkeleton() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.45)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: 16,
        width: '100%',
        maxWidth: 680,
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Заголовок */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            <Bone width={200} height={18} />
            <Bone width={140} height={13} />
          </div>
          <Bone width={28} height={28} radius={8} />
        </div>

        {/* Тіло */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, overflow: 'auto' }}>

          {/* Статус-бейджі */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Bone width={90} height={28} radius={8} />
            <Bone width={75} height={28} radius={8} />
            <Bone width={85} height={28} radius={8} />
          </div>

          {/* Секція: Контакти */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Bone width={80} height={11} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Bone width={50} height={10} />
                <Bone width="90%" height={36} radius={8} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Bone width={50} height={10} />
                <Bone width="90%" height={36} radius={8} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Bone width={60} height={10} />
                <Bone width="90%" height={36} radius={8} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Bone width={70} height={10} />
                <Bone width="90%" height={36} radius={8} />
              </div>
            </div>
          </div>

          {/* Секція: Примітки */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <Bone width={70} height={11} />
            <Bone width="100%" height={80} radius={8} />
          </div>

          {/* Секція: Теги */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Bone width={40} height={11} />
            <div style={{ display: 'flex', gap: 6 }}>
              <Bone width={52} height={22} radius={10} />
              <Bone width={44} height={22} radius={10} />
              <Bone width={60} height={22} radius={10} />
            </div>
          </div>
        </div>

        {/* Футер */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
        }}>
          <Bone width={80} height={36} radius={8} />
          <Bone width={100} height={36} radius={8} />
        </div>
      </div>
    </div>
  );
});

// ─── Default export (іменований об'єкт) ─────────────────────────────────────
const SkeletonComponents = {
  KanbanSkeleton,
  CandidateTableSkeleton,
  ModalSkeleton,
};

export default SkeletonComponents;