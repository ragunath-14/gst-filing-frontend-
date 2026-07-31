import { API_BASE_URL } from '../api/axios';

// Uploaded files are served by the backend at /uploads/... — same relative-
// vs-absolute concern as the API base URL (see api/axios.js).
export const fileUrl = (filePath) => `${API_BASE_URL}/${filePath}`;
