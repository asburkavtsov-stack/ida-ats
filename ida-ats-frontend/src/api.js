import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';
axios.defaults.baseURL = API_URL;

// Перехоплювач — якщо 401, виходимо
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      delete axios.defaults.headers.common['Authorization'];
      window.location.href = '/';
    }
    if (error.response?.status >= 500 || !error.response) {
      const toast = document.createElement('div');
      toast.textContent = '⚠ Сервер недоступний. Спробуйте пізніше.';
      toast.style.cssText = `
        position: fixed; bottom: 24px; right: 24px; z-index: 9999;
        background: #dc2626; color: #fff; padding: 12px 20px;
        border-radius: 10px; font-family: DM Sans, sans-serif;
        font-size: 0.85rem; font-weight: 600;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        animation: fadeIn 0.2s ease;
      `;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 6000);
    }
    return Promise.reject(error);
  }
);

export default API_URL;