// src/api/interviewsApi.js
import axios from '../api';

const BASE = '/api/interviews/';

export const interviewsApi = {
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

  changeStatus: (id, status) =>
    axios.patch(`${BASE}${id}/change-status/`, { status }).then(r => r.data),

  syncGoogle: (id) =>
    axios.post(`${BASE}${id}/sync-google/`).then(r => r.data),
};
