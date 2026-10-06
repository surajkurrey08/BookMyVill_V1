const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

let directory, media;
test.before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'bmv-property-media-'));
  process.env.PROPERTY_MEDIA_DIR = directory;
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
