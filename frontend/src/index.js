import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ─── PWA Service Worker ───────────────────────────────────────────────────────
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then(reg => {
        console.log('[PWA] Service Worker зареєстровано:', reg.scope);

        // Перевіряємо оновлення кожні 60 хв
        setInterval(() => reg.update(), 60 * 60 * 1000);

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Є нова версія — можна показати toast "Оновити сторінку"
              window.dispatchEvent(new CustomEvent('pwa-update-available'));
            }
          });
        });
      })
      .catch(err => console.error('[PWA] Помилка реєстрації SW:', err));
  });
}