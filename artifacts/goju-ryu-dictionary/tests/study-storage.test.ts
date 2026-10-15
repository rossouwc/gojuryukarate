import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, recordRating, STORAGE_KEY } from '../src/study/engine.ts';
import { readStudyStorage, writeStudyStorage } from '../src/study/storage.ts';
import type { StoragePort } from '../src/study/storage.ts';

function memoryStorage(): StoragePort {
  const data = new Map<string, string>();
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
  };
}

test('progress persists and reloads through the browser-storage contract', () => {
  const storage = memoryStorage();
  const progress = emptyProgress();
  progress.records['musubi-dachi'] = recordRating(undefined, 'remembered', 1000);
  progress.savedIds = ['musubi-dachi'];
  assert.equal(writeStudyStorage(progress, () => storage), true);
  const reloaded = readStudyStorage(() => storage);
  assert.equal(reloaded.warning, '');
  assert.deepEqual(reloaded.progress, progress);
});

test('a blocked localStorage getter does not crash and reports temporary persistence', () => {
  const blocked = () => { throw new Error('SecurityError'); };
  assert.deepEqual(readStudyStorage(blocked).progress, emptyProgress());
  assert.ok(readStudyStorage(blocked).warning.includes('will not be saved'));
  assert.equal(writeStudyStorage(emptyProgress(), blocked), false);
});

test('quota errors do not crash or pretend to save new state', () => {
  const storage = memoryStorage();
  const before = emptyProgress();
  before.savedIds = ['musubi-dachi'];
  writeStudyStorage(before, () => storage);
  const quotaStorage: StoragePort = {
    getItem: storage.getItem,
    setItem: () => { throw new Error('QuotaExceededError'); },
  };
  assert.equal(writeStudyStorage(emptyProgress(), () => quotaStorage), false);
  assert.deepEqual(readStudyStorage(() => storage).progress, before);
});

test('future or corrupted progress remains untouched by the read operation', () => {
  const storage = memoryStorage();
  for (const raw of ['{"version":2,"records":{},"savedIds":[]}', '{invalid json']) {
    storage.setItem(STORAGE_KEY, raw);
    assert.ok(readStudyStorage(() => storage).warning);
    assert.equal(storage.getItem(STORAGE_KEY), raw);
  }
});

test('explicit confirmed reset writes an empty valid schema', () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, 'unreadable');
  assert.equal(writeStudyStorage(emptyProgress(), () => storage), true);
  assert.deepEqual(readStudyStorage(() => storage), { progress: emptyProgress(), warning: '' });
});
