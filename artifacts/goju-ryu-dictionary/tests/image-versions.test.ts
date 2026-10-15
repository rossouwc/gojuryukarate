import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { imageVersions } from '../scripts/image-versions.mjs';
import { versionedAssetUrl } from '../src/lib/asset-url.ts';

const publicRoot = fileURLToPath(new URL('../public', import.meta.url));
const versions = imageVersions(publicRoot);
const terms = JSON.parse(readFileSync(new URL('../public/terms.json', import.meta.url), 'utf8'));

test('every illustrated term has a version derived from the actual image bytes', () => {
  const illustrated = terms.filter((term: { image: string | null }) => term.image);
  assert.equal(illustrated.length, 34);
  for (const term of illustrated) {
    const expected = createHash('sha256')
      .update(readFileSync(new URL(`../public/${term.image}`, import.meta.url)))
      .digest('hex').slice(0, 16);
    assert.equal(versions[term.image], expected);
    assert.equal(versionedAssetUrl(term.image, '/', versions), `/${term.image}?v=${expected}`);
  }
});

test('different image contents request a fresh URL, but unchanged images keep a stable URL', () => {
  const path = 'images/example.jpg';
  const oldVersions = { [path]: 'old-content-hash' };
  const newVersions = { [path]: 'new-content-hash' };
  assert.notEqual(versionedAssetUrl(path, '/', oldVersions), versionedAssetUrl(path, '/', newVersions));
  assert.equal(
    versionedAssetUrl(path, '/', { ...oldVersions }),
    versionedAssetUrl(path, '/', oldVersions),
  );
});

test('image URLs respect nested artifact paths and preserve existing query parameters and fragments', () => {
  const versions = { 'images/example.jpg': 'abc123' };
  assert.equal(
    versionedAssetUrl('/images/example.jpg?size=full&v=old#reference', '/dictionary/', versions),
    '/dictionary/images/example.jpg?size=full&v=abc123#reference',
  );
});

test('video sources and unversioned assets keep their existing URLs', () => {
  assert.equal(versionedAssetUrl('videos/mawashi-zuki.webm', '/', versions), '/videos/mawashi-zuki.webm');
  assert.equal(versionedAssetUrl('/videos/mawashi-zuki.mp4', '/dictionary/', versions), '/dictionary/videos/mawashi-zuki.mp4');
});
