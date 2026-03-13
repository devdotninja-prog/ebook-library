import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const login = (username, password) => {
  const formData = new FormData();
  formData.append('username', username);
  formData.append('password', password);
  return api.post('/api/auth/login', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const register = (username, email, password) => {
  return api.post('/api/auth/register', { username, email, password });
};

export const getEbooks = (search = '') => {
  return api.get(`/api/ebooks?search=${search}`);
};

export const getEbook = (id) => {
  return api.get(`/api/ebooks/${id}`);
};

export const uploadEbook = (file, title, author) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', title);
  formData.append('author', author);
  return api.post('/api/ebooks', formData);
};

export const downloadEbook = (id) => {
  return api.get(`/api/ebooks/${id}/download`, { responseType: 'blob' });
};

export const convertEbook = (id) => {
  return api.post(`/api/ebooks/${id}/convert`);
};

export const deleteEbook = (id) => {
  return api.delete(`/api/ebooks/${id}`);
};

export default api;
