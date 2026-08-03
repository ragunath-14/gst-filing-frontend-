/**
 * frontend/api/blob-upload-token.js
 *
 * Vercel Serverless Function — deployed automatically alongside the Vite SPA
 * when the frontend/ project is deployed to Vercel.
 *
 * This endpoint generates short-lived client upload tokens for @vercel/blob/client
 * so the browser can PUT files directly to Vercel Blob without routing large
 * file bytes through the Python backend.
 *
 * After the upload completes the frontend POSTs the blob URL to the Python
 * backend (/api/admin/files/upload/{id} or /api/company/files/upload) for
 * text extraction (GSTIN / filing type detection) and DB persistence.
 *
 * Required Vercel environment variables (set in dashboard → Settings → Env Vars):
 *   BLOB_READ_WRITE_TOKEN   — from Storage → Blob store → .env.local tab
 *   JWT_SECRET              — same value as the Python backend's JWT_SECRET
 */

import { handleUpload } from '@vercel/blob/client';
import jwt from 'jsonwebtoken';

const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
];

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const jsonResponse = await handleUpload({
      body,
      request: req,

      // Called before a client token is issued. Verify the JWT here so that
      // only authenticated users can upload.
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = JSON.parse(clientPayload || '{}');
        const token = payload.authToken;

        if (!token) {
          throw new Error('Unauthorized: no auth token provided');
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          throw new Error('Server misconfiguration: JWT_SECRET not set');
        }

        let decoded;
        try {
          decoded = jwt.verify(token, jwtSecret);
        } catch {
          throw new Error('Unauthorized: invalid or expired token');
        }

        // Allow both admin and company roles to upload
        if (!decoded || !decoded.id) {
          throw new Error('Unauthorized: invalid token payload');
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_SIZE,
          // Add random suffix so collisions are avoided automatically
          addRandomSuffix: true,
          // Keep the blob valid for 1 hour
          tokenExpirationInSeconds: 3600,
        };
      },

      // Called after a successful upload — can be used for logging / webhooks.
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('[blob-upload-token] upload completed:', {
          url: blob.url,
          pathname: blob.pathname,
          size: blob.size,
        });
        // Note: the Python backend handles all extraction + DB writes when the
        // frontend calls the completion endpoint with the blob URL.
      },
    });

    res.status(200).json(jsonResponse);
  } catch (err) {
    console.error('[blob-upload-token] error:', err.message);
    res.status(err.message.startsWith('Unauthorized') ? 401 : 500).json({
      error: err.message,
    });
  }
}
