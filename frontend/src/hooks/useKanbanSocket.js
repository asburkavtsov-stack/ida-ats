import { useEffect, useRef, useCallback } from 'react';
import { API_URL } from 'axiosConfig';

export function useKanbanSocket(vacancyId, onMove) {
  const wsRef       = useRef(null);
  const onMoveRef   = useRef(onMove);
  const reconnectRef = useRef(null);

  // Зберігаємо актуальний callback без перепідключення
  useEffect(() => { onMoveRef.current = onMove; }, [onMove]);

  const connect = useCallback(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    // vacancy '' → 'org' для org-шаблону
    const roomId = vacancyId || 'org';

    // HTTP → WS, HTTPS → WSS
    const wsBase = API_URL.replace(/^http/, 'ws');
    const url = `${wsBase}/ws/kanban/${roomId}/?token=${token}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      // Heartbeat кожні 25 сек щоб Railway не рвав з'єднання
      ws._pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'candidate_moved') {
          onMoveRef.current?.({
            candidateId: data.candidate_id,
            stageId:     data.stage_id,
            movedBy:     data.moved_by,
          });
        }
      } catch (_) {}
    };

    ws.onclose = (event) => {
      clearInterval(ws._pingInterval);
      // Автореконект якщо не 4001 (unauthorized) і не навмисне закрито
      if (event.code !== 4001 && event.code !== 1000) {
        reconnectRef.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [vacancyId]);

  useEffect(() => {
    connect();

    return () => {
      clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // не тригерити реконект при unmount
        wsRef.current.close(1000, 'unmount');
        clearInterval(wsRef.current._pingInterval);
      }
    };
  }, [connect]);
}