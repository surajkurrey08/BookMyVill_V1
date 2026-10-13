const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { HttpError } = require('../utils/validate');

const mediaDirectory = path.resolve(process.env.PROPERTY_MEDIA_DIR || path.join(__dirname, '..', 'uploads', 'properties'));
const extensions = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov'
};

// Device uploads go to Cloudinary when it is configured: every environment
// (local runs, the VPS, each microservice) shares one database, so a file kept
// on one machine's disk shows as a broken photo everywhere else. Without
// Cloudinary (tests, offline runs) files fall back to the local upload folder.
function cloudinary() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME, key = process.env.CLOUDINARY_API_KEY, secret = process.env.CLOUDINARY_API_SECRET;
  if (process.env.MEDIA_STORAGE === 'local' || !cloud || !key || !secret || /^your_/i.test(cloud)) return null;
  return { cloud, key, secret, folder: process.env.CLOUDINARY_FOLDER || 'bookmyvilla/properties' };
}
const signed = (params, secret) => ({ ...params, signature: createHash('sha1').update(Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&') + secret).digest('hex') });
// `file` is sent but never signed (Cloudinary signs the other parameters only).
async function cloudinaryCall(config, kind, action, params, file) {
  const form = new FormData();
  for (const [k, v] of Object.entries({ ...signed({ ...params, timestamp: Math.floor(Date.now() / 1000) }, config.secret), api_key: config.key, ...(file && { file }) })) form.append(k, String(v));
  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloud}/${kind}/${action}`, { method: 'POST', body: form, signal: AbortSignal.timeout(90000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error?.message || `Cloudinary ${action} failed (${response.status})`), { cloudinary: true });
  return data;
}
async function uploadToCloudinary(config, dataUrl, kind) {
  const data = await cloudinaryCall(config, kind, 'upload', { folder: config.folder, public_id: randomUUID() }, dataUrl);
  if (!data.secure_url) throw new Error('Cloudinary returned no URL');
  return { url: data.secure_url, publicId: data.public_id };
}

// Keep file bytes out of MongoDB's 16 MB document limit. Existing URL values
// remain valid; new device uploads go to Cloudinary (or the upload folder).
async function storePropertyMedia(photos, videos, origin) {
  const created = [];
  const uploaded = [];
  const remote = cloudinary();
  const cleanup = () => Promise.all([
    ...created.map(file => fs.unlink(file).catch(() => {})),
    ...uploaded.map(({ publicId, kind }) => cloudinaryCall(remote, kind, 'destroy', { public_id: publicId }).catch(() => {}))
  ]);
  async function store(values, kind) {
    if (values === undefined) return undefined;
    if (!Array.isArray(values) || values.length > 50) throw new HttpError(400, 'Choose up to 50 media files per type.');
    const stored = [];
    for (const value of values) {
      if (typeof value !== 'string') throw new HttpError(400, 'Invalid property media.');
      if (!value.startsWith('data:')) {
        if (value.length > 2048 || !/^(https?:\/\/|\/(?!\/))/.test(value)) throw new HttpError(400, 'Use a valid media URL or choose a file from your device.');
        stored.push(value);
        continue;
      }
      const match = /^data:([^;]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
      if (!match || !match[1].startsWith(`${kind}/`) || !extensions[match[1]]) throw new HttpError(400, kind === 'image' ? 'Upload PNG, JPG or WebP images.' : 'Upload MP4, WebM or MOV videos.');
      const bytes = Buffer.from(match[2], 'base64');
      if (!bytes.length || bytes.length > 30 * 1024 * 1024) throw new HttpError(413, 'Each media file must be 30 MB or smaller.');
      if (remote) {
        try {
          const file = await uploadToCloudinary(remote, value, kind);
          uploaded.push({ publicId: file.publicId, kind });
          stored.push(file.url);
        } catch (err) {
          console.error('Property media upload to Cloudinary failed:', err.message);
          throw new HttpError(502, 'Photo upload failed. Check your connection and try again.');
        }
        continue;
      }
      await fs.mkdir(mediaDirectory, { recursive: true });
      const filename = `${randomUUID()}.${extensions[match[1]]}`;
      const target = path.join(mediaDirectory, filename);
      created.push(target);
      await fs.writeFile(target, bytes, { flag: 'wx' });
      stored.push(`${origin.replace(/\/$/, '')}/api/properties/media/${filename}`);
    }
    return stored;
  }
  try {
    return { photos: await store(photos, 'image'), videos: await store(videos, 'video'), cleanup };
  } catch (err) {
    await cleanup();
    throw err;
  }
}

function mediaOrigin(req) {
  const rawHost = req ? (req.get('x-forwarded-host') || req.get('host') || '') : '';
  const isInternalService = !rawHost || /^[a-z0-9_-]+-service(:\d+)?$/i.test(rawHost);

  if (isInternalService) {
    return (process.env.PUBLIC_API_URL || (process.env.NODE_ENV === 'production'
      ? 'https://api.bookmyvilla.online' : 'http://localhost:2001')).replace(/\/+$/, '');
  }

  const proto = req ? (req.get('x-forwarded-proto') || req.protocol || 'http') : 'http';
  if (process.env.NODE_ENV === 'production' || rawHost.includes('bookmyvilla.online')) {
    return `https://${rawHost}`;
  }
  return `${proto}://${rawHost}`;
}

function normalizeMediaUrl(url, origin) {
  if (!url || typeof url !== 'string') return url;
  const match = /(?:\/api\/properties\/media\/|\/uploads\/properties\/)([a-f0-9-]{36}\.(?:png|jpg|webp|mp4|webm|mov))/i.exec(url);
  if (match) {
    const filename = match[1];
    if (/^https?:\/\/[a-z0-9_-]+-service(?::\d+)?/i.test(url)) {
      const base = (origin || process.env.PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? 'https://api.bookmyvilla.online' : 'http://localhost:2001')).replace(/\/+$/, '');
      return `${base}/api/properties/media/${filename}`;
    }
    if (/^http:\/\/api\.bookmyvilla\.online/i.test(url)) {
      return url.replace(/^http:/i, 'https:');
    }
    if (origin) {
      return `${origin.replace(/\/+$/, '')}/api/properties/media/${filename}`;
    }
    return url;
  }
  if (/^http:\/\/api\.bookmyvilla\.online/i.test(url)) {
    return url.replace(/^http:/i, 'https:');
  }
  return url;
}


function stayInfo(value) {
  const s = value || {};
  const str = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
  return {
    checkInTime: str(s.checkInTime, 40), checkOutTime: str(s.checkOutTime, 40),
    wifiName: str(s.wifiName, 60), wifiPassword: str(s.wifiPassword, 60),
    houseRules: Array.isArray(s.houseRules) ? s.houseRules.map(r => String(r).slice(0, 160)).filter(Boolean).slice(0, 20) : [],
    arrivalNotes: str(s.arrivalNotes, 1000), foodInfo: str(s.foodInfo, 1000)
  };
}

module.exports = { mediaDirectory, storePropertyMedia, mediaOrigin, normalizeMediaUrl, stayInfo, cloudinary, uploadToCloudinary };

