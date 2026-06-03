import axios from 'axios';
import toast from 'react-hot-toast';

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
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        delete axios.defaults.headers.common['Authorization'];
        window.location.href = '/';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Server errors (500+) — замінили DOM-маніпуляцію на toast
    if (error.response?.status >= 500 || !error.response) {
      toast.error('Сервер недоступний. Спробуйте пізніше.', {
        id: 'server-error', // запобігає дублюванню при кількох помилках підряд
        duration: 6000,
      });
    }

    return Promise.reject(error);
  }
);

export { API_URL };
export default axios;