/**
 * @deprecated Import from `./downloadFile` instead.
 *
 * Re-exports from downloadFile.js for backward-compatibility with existing
 * import sites. All download logic now goes through the authenticated backend
 * proxy (downloadFile.js) rather than direct CDN links.
 */
export { fileUrl, resolveFileUrl, downloadFile, resolveDownloadUrl } from './downloadFile';
