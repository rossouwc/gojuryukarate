import { decodeProgress, emptyProgress, STORAGE_KEY } from './engine.ts';
import type { StudyProgress } from './model.ts';

export type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
export type StorageAccessor = () => StoragePort;

export function readStudyStorage(getStorage: StorageAccessor) {
  try {
    return { progress: decodeProgress(getStorage().getItem(STORAGE_KEY)), warning: '' };
  } catch {
    return {
      progress: emptyProgress(),
      warning: 'Saved progress could not be read or browser storage is blocked. This session works, but changes will not be saved. Reset progress to try storage again.',
    };
  }
}

export function writeStudyStorage(progress: StudyProgress, getStorage: StorageAccessor): boolean {
  try {
    getStorage().setItem(STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
