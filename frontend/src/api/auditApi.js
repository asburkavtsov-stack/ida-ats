import axios from 'axiosConfig';

export const auditApi = {
  list: (params = {}) =>
    axios.get('/api/audit-log/', { params }).then(r => r.data),
};