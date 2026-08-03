/**
 * downloadFile.js
 *
 * Authenticated file download helper.
 *
 * Files are stored in Vercel Blob and served through the backend's
 * authenticated proxy endpoint (`GET /api/.../files/download/{id}`).
 * The blob CDN URL is never exposed directly to the browser — the backend
 * verifies the JWT before fetching the bytes from Vercel Blob and streaming
 * them back.
 *
 * Usage:
 *   import { downloadFile, resolveDownloadUrl } from '../utils/downloadFile';
 *
 *   // Trigger a file download for a known file ID:
 *   await downloadFile(fileId, originalName, 'admin');
 *
 *   // Or just get the URL if you need to open it in a new tab:
 *   const url = resolveDownloadUrl(fileId, 'company');
 */

import api, { API_BASE_URL } from '../api/axios';

/**
 * Build the authenticated download URL for a file ID.
 *
 * @param {string} fileId   - MongoDB _id of the gst_files document.
 * @param {'admin'|'company'} role - Which route to use.
 * @returns {string} Absolute API URL.
 */
export const resolveDownloadUrl = (fileId, role = 'admin') => {
  const prefix = role === 'company' ? '/api/company' : '/api/admin';
  return `${API_BASE_URL}${prefix}/files/download/${fileId}`;
};

/**
 * Fetch a file from the authenticated backend proxy and trigger a browser
 * download.  Adds the Authorization: Bearer token automatically via the
 * shared axios instance so the backend's JWT guard is satisfied.
 *
 * @param {string} fileId        - MongoDB _id of the gst_files document.
 * @param {string} originalName  - Suggested filename for the download prompt.
 * @param {'admin'|'company'} role - Which backend route to call.
 */
export const downloadFile = async (fileId, originalName, role = 'admin') => {
  const prefix = role === 'company' ? '/company' : '/admin';
  const endpoint = `${prefix}/files/download/${fileId}`;

  try {
    const response = await api.get(endpoint, {
      responseType: 'blob',   // tell axios to treat the response as a Blob
    });

    // Create an object URL from the response blob and click it to download
    const blobObj = new Blob([response.data], {
      type: response.headers['content-type'] || 'application/octet-stream',
    });
    const url = URL.createObjectURL(blobObj);
    const a = document.createElement('a');
    a.href = url;
    a.download = originalName || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('[downloadFile] download failed:', err);
    throw err;
  }
};

/**
 * Legacy alias — kept so any existing `fileUrl(f.filePath)` call sites
 * that have not yet been updated continue to at least compile.
 *
 * @deprecated Use downloadFile(fileId, originalName, role) instead.
 */
export const fileUrl = (filePath) => {
  if (!filePath) return '';
  // If it's already an absolute URL, return it directly (dev / legacy fallback)
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }
  return `${API_BASE_URL}/${filePath}`;
};

// Named re-export so existing: import { resolveFileUrl } from './downloadFile'  still works
export { fileUrl as resolveFileUrl };
