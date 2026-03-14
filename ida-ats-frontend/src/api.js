import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';
axios.defaults.baseURL = API_URL;

export default API_URL;