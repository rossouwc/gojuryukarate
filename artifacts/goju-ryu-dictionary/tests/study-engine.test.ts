import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  advanceFlashSession, answerText, createQuizQuestions, DAY, decodeProgress,
  dueTerms, emptyProgress, makeFlashSession, promptText, recordRating,
  REVIEW_INTERVALS, selectSessionTerms, shuffle,
} from '../src/study/engine.ts';
import { STUDY_SETS } from '../src/study/model.ts';
import type { Direction, StudyProgress, Term } from '../src/study/model.ts';

const terms: Term[] = JSON.parse(readFileSync(new URL('../public/terms.json', import.meta.url), 'utf8'));
const now = Date.UTC(2026, 9, 15, 12);
const ids = new Set(terms.map(t => t.id));
const deterministic = () => 0.42;

test('curated sets explicitly reference distinct, existing vocabulary, not grading levels', () => {
  assert.equal(STUDY_SETS.length, 5);
  for (const set of STUDY_SETS) {
    assert.ok(set.ids.length > 0);
    assert.equal(new Set(set.ids).size, set.ids.length);
    assert.ok(set.ids.every(id => ids.has(id)));
  }
});

test('Remembered advances through all documented intervals and caps at 30 days', () => {
  let previous;
  for (let index = 0; index < 8; index++) {
    const next = recordRating(previous, 'remembered', now);
    const stage = Math.min(index + 1, 5);
    assert.equal(next.stage, stage);
    assert.equal(next.dueAt, now + REVIEW_INTERVALS[stage - 1] * DAY);
    assert.equal(next.attempts, index + 1);
    assert.equal(next.remembered, index + 1);
    previous = next;
  }
});

test('Again resets interval and schedules 10 minutes; retry success starts at 1 day', () => {
  const mature = recordRating({ ...recordRating(undefined, 'remembered', now), stage: 5 }, 'again', now);
  assert.equal(mature.stage, 0);
  assert.equal(mature.dueAt, now + 600_000);
  assert.equal(mature.remembered, 1);
  const recovered = recordRating(mature, 'remembered', now + 1);
  assert.equal(recovered.stage, 1);
  assert.equal(recovered.dueAt, now + 1 + DAY);
});

test('review due includes exact boundary, excludes future and unseen terms', () => {
  const progress = emptyProgress();
  progress.records[terms[0].id] = recordRating(undefined, 'again', now);
  assert.equal(dueTerms(terms, progress, now + 599_999).length, 0);
  assert.deepEqual(dueTerms(terms, progress, now + 600_000).map(t => t.id), [terms[0].id]);
});

test('sessions prioritize due and unseen vocabulary, deduplicate and cap at 10', () => {
  const progress = emptyProgress();
  progress.records[terms[0].id] = recordRating(undefined, 'remembered', now);
  progress.records[terms[3].id] = recordRating(undefined, 'again', now - DAY);
  const selected = selectSessionTerms([...terms, terms[3]], progress, now);
  assert.equal(selected.length, 10);
  assert.equal(selected[0].id, terms[3].id);
  assert.equal(selected[1].id, terms[1].id);
  assert.ok(!selected.some(t => t.id === terms[0].id));
  assert.equal(new Set(selected.map(t => t.id)).size, 10);
  assert.equal(selectSessionTerms(terms.slice(0, 3), progress, now).length, 3);
});

test('all-Again sessions repeat each distinct term at most once and always terminate', () => {
  let session = makeFlashSession([...terms, terms[0]]);
  assert.equal(session.originalIds.length, 10);
  let iterations = 0;
  while (session.index < session.queue.length) {
    session = advanceFlashSession(session, 'again');
    iterations++;
    assert.ok(iterations <= 20);
  }
  assert.equal(iterations, 20);
  assert.equal(session.retriedIds.length, 10);
  assert.equal(session.ratings.length, 20);
  assert.deepEqual(advanceFlashSession(session, 'again'), session);
});

test('short sessions and empty sessions are valid, with no unnecessary retries', () => {
  let session = makeFlashSession(terms.slice(0, 2));
  session = advanceFlashSession(session, 'remembered');
  session = advanceFlashSession(session, 'remembered');
  assert.equal(session.index, session.queue.length);
  assert.equal(session.queue.length, 2);
  assert.equal(makeFlashSession([]).queue.length, 0);
  assert.deepEqual(advanceFlashSession(makeFlashSession([]), 'again'), makeFlashSession([]));
});

for (const direction of ['ja-en', 'en-ja'] as Direction[]) {
  test(`${direction} quiz answers are unique with exactly one correct choice`, () => {
    const questions = createQuizQuestions(terms, terms, direction, deterministic);
    assert.equal(questions.length, 10);
    for (const question of questions) {
      const labels = question.options.map(t => answerText(t, direction).toLowerCase());
      assert.equal(new Set(labels).size, labels.length);
      assert.equal(question.options.filter(t => t.id === question.term.id).length, 1);
      assert.ok(question.options.length >= 2 && question.options.length <= 4);
      assert.ok(promptText(question.term, direction));
    }
  });
}

test('ambiguous reverse prompts are skipped rather than penalizing defensible answers', () => {
  const a = { ...terms[0], id: 'example-a', english: 'same meaning' };
  const b = { ...terms[1], id: 'example-b', english: 'Same Meaning' };
  assert.equal(createQuizQuestions([a, b], [a, b, terms[2]], 'en-ja', deterministic).length, 0);
});

test('ambiguous Japanese/kanji prompts and duplicate distractors are rejected', () => {
  const a = { ...terms[0], id: 'example-a', english: 'first meaning' };
  const b = { ...a, id: 'example-b', english: 'second meaning' };
  assert.equal(createQuizQuestions([a], [a, b, terms[2]], 'ja-en', deterministic).length, 0);
  const alias = { ...terms[1], id: 'alias', english: terms[1].english.toUpperCase() };
  const questions = createQuizQuestions([terms[0]], [terms[0], terms[1], alias], 'ja-en', deterministic);
  assert.equal(questions[0].options.length, 2);
});

test('quiz has graceful empty/smaller results when no safe distractors exist', () => {
  assert.equal(createQuizQuestions([terms[0]], [terms[0]], 'ja-en', deterministic).length, 0);
  assert.equal(createQuizQuestions(terms.slice(0, 2), terms, 'ja-en', deterministic).length, 2);
});

test('shuffle does not mutate source data', () => {
  const input = [1, 2, 3, 4];
  const shuffled = shuffle(input, deterministic);
  assert.deepEqual(input, [1, 2, 3, 4]);
  assert.deepEqual([...shuffled].sort(), input);
});

test('versioned progress round-trips with review and saved vocabulary intact', () => {
  const progress: StudyProgress = {
    version: 1,
    records: { [terms[0].id]: recordRating(undefined, 'again', now) },
    savedIds: [terms[0].id, terms[1].id],
  };
  assert.deepEqual(decodeProgress(JSON.stringify(progress)), progress);
  assert.deepEqual(decodeProgress(null), emptyProgress());
  assert.deepEqual(decodeProgress(JSON.stringify({ ...progress, savedIds: [terms[0].id, terms[0].id] })).savedIds, [terms[0].id]);
});

test('malformed/unknown storage schemas are not silently accepted or overwritten', () => {
  for (const invalid of [
    '{bad json', 'null', '[]',
    '{"version":2,"records":{},"savedIds":[]}',
    '{"version":1,"records":{},"savedIds":[2]}',
    '{"version":1,"records":[],"savedIds":[]}',
  ]) assert.throws(() => decodeProgress(invalid));
  for (const patch of [
    { stage: 6 }, { stage: -1 }, { stage: 0.5 }, { dueAt: 'tomorrow' },
    { attempts: -2 }, { attempts: 0 }, { remembered: 3 }, { lastRating: 'correct' },
    { lastReviewed: -1 },
  ]) {
    const progress = { version: 1, records: { [terms[0].id]: { ...recordRating(undefined, 'again', now), ...patch } }, savedIds: [] };
    assert.throws(() => decodeProgress(JSON.stringify(progress)));
  }
});

test('all 102 terms are eligible for flashcards, including non-illustrated vocabulary', () => {
  assert.equal(terms.length, 102);
  assert.equal(terms.filter(t => !t.image).length, 68);
  const studied = emptyProgress();
  const seen = new Set<string>();
  for (let pass = 0; pass < 11; pass++) {
    for (const term of selectSessionTerms(terms, studied, now)) {
      seen.add(term.id);
      studied.records[term.id] = recordRating(undefined, 'remembered', now);
    }
  }
  assert.equal(seen.size, 102);
});
