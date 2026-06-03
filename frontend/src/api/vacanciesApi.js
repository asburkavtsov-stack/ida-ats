// src/api/vacanciesApi.js
import axios from 'axiosConfig';

const BASE = '/api/vacancies/';

export const vacanciesApi = {
  list: (params = {}) =>
    axios.get(BASE, { params }).then(r => r.data),

  get: (id) =>
    axios.get(`${BASE}${id}/`).then(r => r.data),

  create: (data) =>
    axios.post(BASE, data).then(r => r.data),

  update: (id, data) =>
    axios.patch(`${BASE}${id}/`, data).then(r => r.data),

  delete: (id) =>
    axios.delete(`${BASE}${id}/`),

  // Делегування доступу: POST /api/vacancies/:id/access/
  grantAccess: (vacancyId, userId) =>
    axios.post(`${BASE}${vacancyId}/access/`, { user_id: userId }).then(r => r.data),

  // Відкликання доступу: DELETE /api/vacancies/:id/access/
  revokeAccess: (vacancyId, userId) =>
    axios.delete(`${BASE}${vacancyId}/access/`, { data: { user_id: userId } }).then(r => r.data),

  // Список хто має доступ: GET /api/vacancies/:id/access-list/
  listAccess: (vacancyId) =>
    axios.get(`${BASE}${vacancyId}/access-list/`).then(r => r.data),
};