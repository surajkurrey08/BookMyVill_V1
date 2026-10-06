const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { HttpError } = require('../utils/validate');

const mediaDirectory = path.resolve(process.env.PROPERTY_MEDIA_DIR || path.join(__dirname, '..', 'uploads', 'properties'));
const extensions = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov'
};

// Keep file bytes out of MongoDB's 16 MB document limit. Existing URL values
// remain valid; new device uploads become files in the persistent upload mount.
async function storePropertyMedia(photos, videos, origin) {
  const created = [];
  const cleanup = () => Promise.all(created.map(file => fs.unlink(file).catch(() => {})));
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
  return process.env.PUBLIC_API_URL || (process.env.NODE_ENV === 'production'
    ? 'https://api.bookmyvilla.online' : `${req.protocol}://${req.get('host')}`);
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

module.exports = { mediaDirectory, storePropertyMedia, mediaOrigin, stayInfo };
