import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMediaUrl } from '../utils/mediaUrl.js';
import { API_BASE_URL } from '../config.js';

test('mediaUrl - resolves relative media paths to active API_BASE_URL', () => {
  const filename = '613ad069-9917-4038-989f-4b36d9be6e49.jpg';
  const input = `/api/properties/media/${filename}`;
  const result = resolveMediaUrl(input);
  assert.equal(result, `${API_BASE_URL}/api/properties/media/${filename}`);
});

test('mediaUrl - rewrites internal docker service hostnames to active API_BASE_URL', () => {
  const filename = '613ad069-9917-4038-989f-4b36d9be6e49.jpg';
  const input = `https://villa-service:2103/api/properties/media/${filename}`;
  const result = resolveMediaUrl(input);
  assert.equal(result, `${API_BASE_URL}/api/properties/media/${filename}`);
});

test('mediaUrl - upgrades http://api.bookmyvilla.online to https://', () => {
  const filename = 'e0cdd210-4c15-4720-96aa-fcc011d499ce.jpg';
  const input = `http://api.bookmyvilla.online/api/properties/media/${filename}`;
  const result = resolveMediaUrl(input);
  assert.equal(result, `https://api.bookmyvilla.online/api/properties/media/${filename}`);
});

test('mediaUrl - preserves external image URLs untouched', () => {
  const unsplash = 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=800';
  const google = 'https://lh3.googleusercontent.com/gps-cs-s/ANWiy9T5D9N_SJalCozG38uSPOtwFqQfdq9l_axsH6K5kMYcXYQQqQGAFyNj65jydZOW0hQ2DmhAYKl0t9Ugy0fO_sL8Ewgx468lo-NlQAQvaq5MNLdQ5H0flFQj492KS1waKXnoiwGoeQ=s1360-w1360-h1020-rw';
  assert.equal(resolveMediaUrl(unsplash), unsplash);
  assert.equal(resolveMediaUrl(google), google);
});

test('mediaUrl - preserves base64 and data URLs untouched', () => {
  const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...';
  const blobUrl = 'blob:http://localhost:5173/77c3855e-26f6-419b-a010-877712345678';
  assert.equal(resolveMediaUrl(dataUrl), dataUrl);
  assert.equal(resolveMediaUrl(blobUrl), blobUrl);
});

test('mediaUrl - returns fallback for empty or non-string inputs', () => {
  const fallback = 'https://images.unsplash.com/fallback.jpg';
  assert.equal(resolveMediaUrl('', fallback), fallback);
  assert.equal(resolveMediaUrl(null, fallback), fallback);
  assert.equal(resolveMediaUrl(undefined, fallback), fallback);
  assert.equal(resolveMediaUrl(12345, fallback), fallback);
});
