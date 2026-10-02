const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

const router = express.Router();
const heroKeys = ['home', 'explore', 'packages', 'about', 'join'];
const maxImageBytes = 8 * 1024 * 1024;
const uploadDirectory = path.resolve(process.env.HERO_UPLOAD_DIR || path.join(__dirname, '..', 'uploads', 'site-heroes'));
const filePattern = /^(home|explore|packages|about|join)-[0-9a-f-]+\.(jpg|png|webp)$/;

const imageType = (bytes) => {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: 'image/jpeg', extension: 'jpg' };
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mime: 'image/png', extension: 'png' };
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return { mime: 'image/webp', extension: 'webp' };
  return null;
};

const latestFile = async (key) => {
  let names;
  try {
    names = await fs.readdir(uploadDirectory);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  const matches = names.filter((name) => filePattern.test(name) && name.startsWith(`${key}-`));
  const files = await Promise.all(matches.map(async (name) => ({ name, stat: await fs.stat(path.join(uploadDirectory, name)) })));
  files.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  return files[0] || null;
};

const imageRecord = (key, file) => file ? {
  url: `/api/site-heroes/${key}/image?v=${Math.floor(file.stat.mtimeMs)}`,
  updatedAt: file.stat.mtime.toISOString(),
} : null;

const requireAdmin = async (req, res, next) => {
  const rawToken = req.header('x-auth-token') || req.header('Authorization') || '';
  const token = rawToken.replace(/^Bearer\s+/i, '').trim();
  try {
    const identity = jwt.verify(token, process.env.JWT_SECRET || 'mahabaleshwar_secret_key_2026');
    if (identity.role !== 'admin' || !identity.id) return res.status(403).json({ msg: 'Admin access required.' });
    if (mongoose.connection.readyState === 1) {
      const admin = await User.findById(identity.id).select('role');
      if (!admin || admin.role !== 'admin') return res.status(403).json({ msg: 'Admin access required.' });
    }
    next();
  } catch {
    return res.status(401).json({ msg: 'A valid admin session is required.' });
  }
};

router.get('/', async (_req, res) => {
  try {
    const images = {};
    await Promise.all(heroKeys.map(async (key) => { images[key] = imageRecord(key, await latestFile(key)); }));
    res.set('Cache-Control', 'no-store').json({ images });
  } catch (error) {
    console.error('Hero image list error:', error);
    res.status(500).json({ msg: 'Unable to load hero images.' });
  }
});

router.get('/:key/image', async (req, res) => {
  if (!heroKeys.includes(req.params.key)) return res.sendStatus(404);
  try {
    const file = await latestFile(req.params.key);
    if (!file) return res.sendStatus(404);
    const extension = path.extname(file.name);
    res.set('Content-Type', extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg');
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(uploadDirectory, file.name));
  } catch (error) {
    console.error('Hero image read error:', error);
    res.status(500).json({ msg: 'Unable to load hero image.' });
  }
});

router.put('/:key', requireAdmin, async (req, res) => {
  const { key } = req.params;
  if (!heroKeys.includes(key)) return res.status(404).json({ msg: 'Unknown page.' });
  const image = req.body?.image;
  if (typeof image !== 'string') return res.status(400).json({ msg: 'Choose an image to upload.' });
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (!match) return res.status(400).json({ msg: 'Use a JPG, PNG, or WebP image.' });
  if (match[2].length > Math.ceil(maxImageBytes * 4 / 3) + 4) return res.status(413).json({ msg: 'Image must be 8 MB or smaller.' });

  const bytes = Buffer.from(match[2], 'base64');
  const type = imageType(bytes);
  if (!type || type.mime !== match[1]) return res.status(400).json({ msg: 'The selected file is not a valid JPG, PNG, or WebP image.' });
  if (bytes.length > maxImageBytes) return res.status(413).json({ msg: 'Image must be 8 MB or smaller.' });

  try {
    await fs.mkdir(uploadDirectory, { recursive: true });
    const name = `${key}-${crypto.randomUUID()}.${type.extension}`;
    await fs.writeFile(path.join(uploadDirectory, name), bytes, { flag: 'wx' });
    const names = await fs.readdir(uploadDirectory);
    await Promise.all(names.filter((oldName) => oldName !== name && filePattern.test(oldName) && oldName.startsWith(`${key}-`))
      .map((oldName) => fs.unlink(path.join(uploadDirectory, oldName))));
    res.json({ image: imageRecord(key, await latestFile(key)) });
  } catch (error) {
    console.error('Hero image upload error:', error);
    res.status(500).json({ msg: 'Unable to save image. Check server storage permissions.' });
  }
});

router.delete('/:key', requireAdmin, async (req, res) => {
  const { key } = req.params;
  if (!heroKeys.includes(key)) return res.status(404).json({ msg: 'Unknown page.' });
  try {
    const names = await fs.readdir(uploadDirectory).catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error));
    await Promise.all(names.filter((name) => filePattern.test(name) && name.startsWith(`${key}-`))
      .map((name) => fs.unlink(path.join(uploadDirectory, name))));
    res.json({ image: null });
  } catch (error) {
    console.error('Hero image reset error:', error);
    res.status(500).json({ msg: 'Unable to reset image.' });
  }
});

module.exports = router;
