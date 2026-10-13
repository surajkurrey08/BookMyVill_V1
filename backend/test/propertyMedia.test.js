const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

let directory, media;
test.before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'bmv-property-media-'));
  process.env.PROPERTY_MEDIA_DIR = directory;
  process.env.MEDIA_STORAGE = 'local';
  media = require('../services/propertyMedia');
});
test.after(async () => { await fs.rm(directory, { recursive: true, force: true }); });

test('video larger than MongoDB document limit becomes a small URL and preserves its bytes', async () => {
  const bytes = Buffer.alloc(17 * 1024 * 1024, 42);
  const result = await media.storePropertyMedia(['https://example.com/photo.jpg'], [`data:video/mp4;base64,${bytes.toString('base64')}`], 'https://api.bookmyvilla.online');
  assert.deepEqual(result.photos, ['https://example.com/photo.jpg']);
  assert.match(result.videos[0], /^https:\/\/api\.bookmyvilla\.online\/api\/properties\/media\/[a-f0-9-]+\.mp4$/);
  const filename = path.basename(result.videos[0]);
  assert.deepEqual(await fs.readFile(path.join(directory, filename)), bytes);
  assert.ok(JSON.stringify(result.videos).length < 200);
  await result.cleanup();
  assert.deepEqual(await fs.readdir(directory), []);
});

test('invalid later media cleans earlier files and rejects executable MIME types', async () => {
  await assert.rejects(media.storePropertyMedia(['data:image/png;base64,aGVsbG8='], ['data:text/html;base64,aGVsbG8='], 'https://example.com'), { status: 400 });
  assert.deepEqual(await fs.readdir(directory), []);
});

test('existing URLs survive unchanged and omitted media is not cleared', async () => {
  const result = await media.storePropertyMedia(undefined, ['/old-video.mp4'], 'https://example.com');
  assert.equal(result.photos, undefined);
  assert.deepEqual(result.videos, ['/old-video.mp4']);
  assert.deepEqual(await fs.readdir(directory), []);
});

test('with Cloudinary configured, device uploads go to Cloudinary (signed) and failed saves remove them', async () => {
  const saved = { ...process.env }; const realFetch = global.fetch; const calls = [];
  Object.assign(process.env, { MEDIA_STORAGE: '', CLOUDINARY_CLOUD_NAME: 'demo-cloud', CLOUDINARY_API_KEY: 'key-1', CLOUDINARY_API_SECRET: 'secret-1' });
  global.fetch = async (url, init) => {
    const body = Object.fromEntries(init.body.entries());
    calls.push({ url, body });
    if (url.endsWith('/upload')) return { ok: true, json: async () => ({ secure_url: `https://res.cloudinary.com/demo-cloud/image/upload/${body.public_id}.jpg`, public_id: `${body.folder}/${body.public_id}` }) };
    return { ok: true, json: async () => ({ result: 'ok' }) };
  };
  try {
    const jpeg = `data:image/jpeg;base64,${Buffer.from('fake-jpeg').toString('base64')}`;
    const result = await media.storePropertyMedia(['https://example.com/kept.jpg', jpeg], undefined, 'http://localhost:2001');
    assert.equal(result.photos[0], 'https://example.com/kept.jpg');
    assert.match(result.photos[1], /^https:\/\/res\.cloudinary\.com\/demo-cloud\/image\/upload\/[a-f0-9-]+\.jpg$/);
    const upload = calls[0];
    assert.equal(upload.url, 'https://api.cloudinary.com/v1_1/demo-cloud/image/upload');
    assert.equal(upload.body.folder, 'bookmyvilla/properties');
    assert.equal(upload.body.api_key, 'key-1');
    assert.match(upload.body.signature, /^[a-f0-9]{40}$/);
    assert.deepEqual(await fs.readdir(directory), [], 'nothing written to local disk');
    await result.cleanup();
    assert.equal(calls[1].url, 'https://api.cloudinary.com/v1_1/demo-cloud/image/destroy');
    assert.match(calls[1].body.public_id, /^bookmyvilla\/properties\//);

    global.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'Invalid Signature' } }) });
    await assert.rejects(media.storePropertyMedia([jpeg], undefined, ''), { status: 502 });
  } finally {
    global.fetch = realFetch;
    for (const key of ['MEDIA_STORAGE', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
  }
});
