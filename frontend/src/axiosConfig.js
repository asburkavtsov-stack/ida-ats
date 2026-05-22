import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';
axios.defaults.baseURL = API_URL;

let isRefreshing = false;
let refreshSubscribers = [];

function onTokenRefreshed(newToken) {
  refreshSubscribers.forEach(callback => callback(newToken));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback) {
  refreshSubscribers.push(callback);
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) throw new Error('No refresh token');

  const res = await axios.post('/api/auth/refresh/', { refresh: refreshToken });
  const newAccess = res.data.access;
  localStorage.setItem('access_token', newAccess);
  axios.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`;
  return newAccess;
}

// Request interceptor — ensure token is always attached
axios.interceptors.request.use(
  config => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor — handle 401 with token refresh
axios.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      // If this is the refresh endpoint itself, logout immediately
      if (originalRequest.url?.includes('/auth/refresh/')) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        delete axios.defaults.headers.common['Authorization'];
        window.location.href = '/';
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (isRefreshing) {
        // Wait for refresh to complete
        return new Promise(resolve => {
          addRefreshSubscriber(newToken => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(axios(originalRequest));
          });
        });
      }

      isRefreshing = true;

      try {
        const newToken = await refreshAccessToken();
        onTokenRefreshed(newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axios(originalRequest);
      } catch (refreshError) {
        // Refresh failed — logout
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        delete axios.defaults.headers.common['Authorization'];
        window.location.href = '/';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Server errors (500+)
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

export { API_URL };
export default axios;