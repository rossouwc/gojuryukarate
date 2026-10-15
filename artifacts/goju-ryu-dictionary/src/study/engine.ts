import type { Direction, FlashSession, QuizQuestion, Rating, ReviewRecord, StudyProgress, Term } from './model.ts';

export const STORAGE_KEY = 'goju-ryu-study-v1';
export const DAY = 86_400_000;
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30] as const;
export const emptyProgress = (): StudyProgress => ({ version: 1, records: {}, savedIds: [] });

export function recordRating(previous: ReviewRecord | undefined, rating: Rating, now: number): ReviewRecord {
  const stage = rating === 'again' ? 0 : Math.min((previous?.stage ?? 0) + 1, REVIEW_INTERVALS.length);
  return {
    stage,
    dueAt: now + (rating === 'again' ? 10 * 60_000 : REVIEW_INTERVALS[stage - 1] * DAY),
    attempts: (previous?.attempts ?? 0) + 1,
    remembered: (previous?.remembered ?? 0) + Number(rating === 'remembered'),
    lastReviewed: now,
    lastRating: rating,
  };
}

export function dueTerms(terms: Term[], progress: StudyProgress, now: number): Term[] {
  return terms.filter(t => progress.records[t.id] && progress.records[t.id].dueAt <= now)
    .sort((a, b) => progress.records[a.id].dueAt - progress.records[b.id].dueAt);
}

// Due vocabulary first, then unseen terms. Deliberate topic practice can include future reviews.
export function selectSessionTerms(terms: Term[], progress: StudyProgress, now: number): Term[] {
  const priority = (t: Term) => {
    const record = progress.records[t.id];
    return !record ? 1 : record.dueAt <= now ? 0 : 2;
  };
  return [...new Map(terms.map(t => [t.id, t])).values()].sort((a, b) =>
    priority(a) - priority(b) || (progress.records[a.id]?.dueAt ?? 0) - (progress.records[b.id]?.dueAt ?? 0)
  ).slice(0, 10);
}

export function makeFlashSession(terms: Term[]): FlashSession {
  const ids = [...new Set(terms.map(t => t.id))].slice(0, 10);
  return { queue: ids, index: 0, originalIds: ids, retriedIds: [], ratings: [] };
}

// Each difficult term repeats once at the end; repeated Again cannot cause an endless session.
export function advanceFlashSession(session: FlashSession, rating: Rating): FlashSession {
  const id = session.queue[session.index];
  if (!id) return session;
  const retry = rating === 'again' && !session.retriedIds.includes(id);
  return {
    ...session,
    queue: retry ? [...session.queue, id] : session.queue,
    retriedIds: retry ? [...session.retriedIds, id] : session.retriedIds,
    index: session.index + 1,
    ratings: [...session.ratings, { id, rating }],
  };
}

export function promptText(term: Term, direction: Direction): string {
  return direction === 'ja-en' ? `${term.name}${term.kanji ? ` · ${term.kanji}` : ''}` : term.english;
}
export function answerText(term: Term, direction: Direction): string {
  return promptText(term, direction === 'ja-en' ? 'en-ja' : 'ja-en');
}
const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createQuizQuestions(selected: Term[], allTerms: Term[], direction: Direction, random = Math.random): QuizQuestion[] {
  const prompt = (t: Term) => normalize(promptText(t, direction));
  const answer = (t: Term) => normalize(answerText(t, direction));
  const meanings = new Map<string, Set<string>>();
  for (const t of allTerms) {
    const options = meanings.get(prompt(t)) ?? new Set();
    options.add(answer(t));
    meanings.set(prompt(t), options);
  }
  const questions: QuizQuestion[] = [];
  for (const term of [...new Map(selected.map(t => [t.id, t])).values()]) {
    // Do not ask a prompt with several defensible answers in this dictionary.
    if (!prompt(term) || !answer(term) || meanings.get(prompt(term))?.size !== 1) continue;
    const candidates = shuffle(allTerms.filter(t => t.id !== term.id && prompt(t) !== prompt(term)
      && answer(t) !== answer(term) && meanings.get(prompt(t))?.size === 1), random);
    candidates.sort((a, b) => Number(b.category === term.category) - Number(a.category === term.category));
    const distinct = new Map<string, Term>();
    for (const candidate of candidates) {
      if (!distinct.has(answer(candidate))) distinct.set(answer(candidate), candidate);
    }
    const distractors = [...distinct.values()].slice(0, 3);
    if (!distractors.length) continue;
    questions.push({ term, options: shuffle([term, ...distractors], random) });
    if (questions.length === 10) break;
  }
  return questions;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const validNumber = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const validId = (id: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);

export function decodeProgress(raw: string | null): StudyProgress {
  if (raw === null) return emptyProgress();
  const data: unknown = JSON.parse(raw);
  if (!isObject(data) || data.version !== 1 || !isObject(data.records)
      || !Array.isArray(data.savedIds) || !data.savedIds.every(id => typeof id === 'string' && validId(id))) {
    throw new Error('Unrecognized study progress');
  }
  const records: Record<string, ReviewRecord> = {};
  for (const [id, r] of Object.entries(data.records)) {
    if (!validId(id) || !isObject(r) || !Number.isInteger(r.stage) || !validNumber(r.stage)
        || (r.stage as number) > REVIEW_INTERVALS.length
        || !validNumber(r.dueAt) || !validNumber(r.lastReviewed)
        || !Number.isInteger(r.attempts) || !validNumber(r.attempts) || (r.attempts as number) < 1
        || !Number.isInteger(r.remembered) || !validNumber(r.remembered) || (r.remembered as number) > (r.attempts as number)
        || (r.lastRating !== 'again' && r.lastRating !== 'remembered')) {
      throw new Error('Invalid study record');
    }
    records[id] = r as ReviewRecord;
  }
  return { version: 1, records, savedIds: [...new Set(data.savedIds as string[])] };
}
