import { useCallback, useEffect, useState } from 'react';
import { emptyProgress, recordRating } from './engine';
import { readStudyStorage, writeStudyStorage } from './storage';
import type { Rating } from './model';

const browserStorage = () => window.localStorage;

export function useStudyProgress() {
  const [initial] = useState(() => readStudyStorage(browserStorage));
  const [progress, setProgress] = useState(initial.progress);
  const [storageWarning, setStorageWarning] = useState(initial.warning);
  const [canPersist, setCanPersist] = useState(!initial.warning);

  useEffect(() => {
    if (!canPersist) return;
    if (!writeStudyStorage(progress, browserStorage)) {
      setCanPersist(false);
      setStorageWarning('Browser storage is unavailable. You can keep studying, but progress is only held for this session and will be lost on reload.');
    }
  }, [progress, canPersist]);

  const rate = useCallback((id: string, rating: Rating) => {
    setProgress(current => ({
      ...current,
      records: { ...current.records, [id]: recordRating(current.records[id], rating, Date.now()) },
    }));
  }, []);
  const toggleSaved = useCallback((id: string) => {
    setProgress(current => ({
      ...current,
      savedIds: current.savedIds.includes(id) ? current.savedIds.filter(saved => saved !== id) : [...current.savedIds, id],
    }));
  }, []);
  // Call only after an explicit UI confirmation. No silent reset on storage/schema errors.
  const reset = useCallback(() => {
    const next = emptyProgress();
    setProgress(next);
    if (writeStudyStorage(next, browserStorage)) {
      setCanPersist(true);
      setStorageWarning('');
    } else {
      setCanPersist(false);
      setStorageWarning('Progress was reset for this session, but browser storage is blocked. Previously stored data may remain until browser storage is available.');
    }
  }, []);

  return { progress, storageWarning, rate, toggleSaved, reset };
}
export type StudyProgressController = ReturnType<typeof useStudyProgress>;
