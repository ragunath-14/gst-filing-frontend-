import axios from 'axios';

// Empty by default so every request/link stays relative — correct for local
// dev (Vite proxy) and the single-container deploy (FastAPI serves the built
// frontend itself). Set VITE_API_BASE_URL at build time when the frontend
// and backend are hosted separately (e.g. frontend on Vercel, backend on
// Render) to the backend's origin, e.g. https://gst-filing-api.onrender.com
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' }
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
