import { upload } from '@vercel/blob/client';

/**
 * Uploads a file straight from the browser to Vercel Blob, bypassing the
 * Python backend entirely so large GST documents (up to 20MB) aren't capped
 * by Vercel Functions' 4.5MB request-body limit.
 *
 * Requires frontend/api/blob-upload-token.js to be reachable — that's a real
 * Vercel Function, so this only works under `vercel dev` or a real Vercel
 * deployment, not a plain `npm run dev` Vite session.
 *
 * @param {File} file
 * @returns {Promise<{url: string, pathname: string, contentType: string}>}
 */
export async function uploadFileToBlob(file) {
  const authToken = localStorage.getItem('token');
  if (!authToken) {
    throw new Error('Not logged in');
  }

  const blob = await upload(file.name, file, {
    access: 'private',
    handleUploadUrl: '/api/blob-upload-token',
    clientPayload: JSON.stringify({ authToken }),
  });

  return blob;
}

/**
 * Uploads multiple files to Vercel Blob in parallel and returns their blob
 * refs in the same order as the input files.
 *
 * @param {File[]} files
 * @returns {Promise<Array<{file: File, blob: {url: string, pathname: string, contentType: string}} | {file: File, error: Error}>>}
 */
export async function uploadFilesToBlob(files) {
  return Promise.all(
    files.map(async (file) => {
      try {
        const blob = await uploadFileToBlob(file);
        return { file, blob };
      } catch (error) {
        return { file, error };
      }
    })
  );
}
