const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const MIME_BY_EXTENSION = { jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };

function storeImage(buffer, extension) {
  const cleanExtension = String(extension || '').toLowerCase();
  const mimeType = MIME_BY_EXTENSION[cleanExtension];
  if (!mimeType) throw new Error('Unsupported image type.');
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const filename = `${crypto.randomBytes(16).toString('hex')}.${cleanExtension}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer, { flag: 'wx', mode: 0o640 });
  return { filename, url: `/uploads/${filename}`, mimeType };
}

function deleteUploadedImage(imageUrl) {
  if (typeof imageUrl !== 'string') return false;
  let pathname;
  try { pathname = new URL(imageUrl, 'http://localhost').pathname; } catch { return false; }
  if (!pathname.startsWith('/uploads/')) return false;
  const filename = path.basename(pathname);
  if (!filename || filename === '.' || filename === '..') return false;
  const target = path.resolve(UPLOADS_DIR, filename);
  if (!target.startsWith(`${UPLOADS_DIR}${path.sep}`)) return false;
  try { fs.unlinkSync(target); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

module.exports = { UPLOADS_DIR, storeImage, deleteUploadedImage };
