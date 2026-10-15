import { useEffect, useMemo, useState } from 'react';
import { Bookmark } from 'lucide-react';
import './study.css';
import { AppHeader } from './AppNav';
import { ConfirmDialog } from './Dialog';
import { DetailDialog } from './DetailDialog';
import { FlashSessionView } from './FlashSessionView';
import { QuizSessionView } from './QuizSessionView';
import { advanceFlashSession, createQuizQuestions, dueTerms, makeFlashSession, selectSessionTerms } from './engine';
import { STUDY_SETS, type Direction, type FlashSession, type QuizQuestion, type Term } from './model';
import type { StudyProgressController } from './useStudyProgress';

type Mode = 'flash' | 'quiz';
type Active =
  | { kind: 'flash'; id: number; direction: Direction; session: FlashSession; scope: string[]; label: string; source: Term[] }
  | { kind: 'quiz'; id: number; direction: Direction; questions: QuizQuestion[]; scope: string[]; label: string; requested: number; source: Term[] };
type Confirm = 'reset' | 'leave' | null;

function Choice({ name, value, checked, onChange, title, meta }: {
  name: string; value: string; checked: boolean; onChange: () => void; title: string; meta?: string;
}) {
  return (
    <label className="choice">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} data-testid={`radio-${name}-${value}`} />
      <span className="choice-title">{title}</span>
      {meta && <span className="choice-meta">{meta}</span>}
    </label>
  );
}

function TermRow({ term, saved, onOpen, onToggle, testKey }: {
  term: Term; saved: boolean; onOpen: () => void; onToggle: () => void; testKey: string;
}) {
  return (
    <li className="term-row">
      <span className="term-row-name">
        <strong>{term.name}</strong> <span lang="ja" className="term-row-kanji">{term.kanji}</span>
        <em>{term.english}</em>
      </span>
      <span className="term-row-actions">
        <button type="button" className="study-btn small" onClick={onOpen} aria-label={`Open details for ${term.name}`} data-testid={`button-${testKey}-open-${term.id}`}>
          Details
        </button>
        <button type="button" className="study-btn small" aria-pressed={saved} onClick={onToggle} aria-label={`${saved ? 'Remove' : 'Save'} ${term.name} ${saved ? 'from' : 'for'} review`} data-testid={`button-${testKey}-save-${term.id}`}>
          <Bookmark size={14} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
          {saved ? 'Saved' : 'Save'}
        </button>
      </span>
    </li>
  );
}

export function StudyPage({ terms, isLoading, error, onRetry, study }: {
  terms: Term[]; isLoading: boolean; error: boolean; onRetry: () => void; study: StudyProgressController;
}) {
  const { progress, rate, toggleSaved, reset } = study;
  const [now, setNow] = useState(() => Date.now());
  const [topic, setTopic] = useState('dojo');
  const [mode, setMode] = useState<Mode>('flash');
  const [direction, setDirection] = useState<Direction>('ja-en');
  const [active, setActive] = useState<Active | null>(null);
  const [notice, setNotice] = useState<string>('');
  const [fallback, setFallback] = useState<{ source: Term[]; label: string } | null>(null);
  const [detail, setDetail] = useState<{ scope: string[]; id: string } | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const termsById = useMemo(() => new Map(terms.map((t) => [t.id, t])), [terms]);
  const topics = useMemo(() => {
    const inSets = new Set(STUDY_SETS.flatMap((s) => s.ids));
    return [
      ...STUDY_SETS.map((s) => ({
        id: s.id, title: s.title, description: s.description,
        terms: s.ids.map((id) => termsById.get(id)).filter((t): t is Term => !!t),
      })),
      { id: 'other', title: 'Other vocabulary', description: 'Terms outside the five sets', terms: terms.filter((t) => !inSets.has(t.id)) },
      { id: 'all', title: 'All vocabulary', description: 'Every dictionary term', terms },
    ];
  }, [terms, termsById]);

  const current = topics.find((t) => t.id === topic) ?? topics[0];
  const due = useMemo(() => dueTerms(terms, progress, now), [terms, progress, now]);
  const savedTerms = useMemo(
    () => progress.savedIds.map((id) => termsById.get(id)).filter((t): t is Term => !!t),
    [progress.savedIds, termsById],
  );
  const seen = terms.filter((t) => progress.records[t.id]).length;
  const rememberedNow = terms.filter((t) => progress.records[t.id]?.lastRating === 'remembered').length;

  const beginFlash = (source: Term[], dir: Direction, label: string) => {
    const chosen = selectSessionTerms(source, progress, Date.now());
    if (!chosen.length) { setNotice('There are no terms to study here yet.'); return; }
    setCounter((c) => c + 1);
    setActive({ kind: 'flash', id: counter + 1, direction: dir, session: makeFlashSession(chosen), scope: chosen.map((t) => t.id), label, source });
  };
  const beginQuiz = (source: Term[], dir: Direction, label: string) => {
    const chosen = selectSessionTerms(source, progress, Date.now());
    if (!chosen.length) { setNotice('There are no terms to study here yet.'); return; }
    const questions = createQuizQuestions(chosen, terms, dir);
    if (!questions.length) {
      setActive(null);
      setFallback({ source, label });
      return;
    }
    setCounter((c) => c + 1);
    setActive({ kind: 'quiz', id: counter + 1, direction: dir, questions, scope: questions.map((q) => q.term.id), label, requested: chosen.length, source });
  };
  const start = (source: Term[], label: string) => {
    setNotice('');
    setFallback(null);
    setNow(Date.now());
    if (mode === 'flash') beginFlash(source, direction, label);
    else beginQuiz(source, direction, label);
  };

  const openDetail = (scope: string[], id: string) => setDetail({ scope, id });
  const detailTerms = detail ? detail.scope.map((id) => termsById.get(id)).filter((t): t is Term => !!t) : [];
  const detailPos = detail ? detailTerms.findIndex((t) => t.id === detail.id) : -1;
  const detailTerm = detailPos >= 0 ? detailTerms[detailPos] : null;

  const closeSession = () => { setActive(null); setNotice(''); };

  const changeActiveDirection = (dir: Direction) => {
    if (active?.direction === dir) return;
    setActive((a) => {
      if (!a) return a;
      if (a.kind === 'flash') return { ...a, direction: dir };
      return a;
    });
    if (active?.kind === 'quiz') {
      const q = createQuizQuestions(active.questions.map((x) => x.term), terms, dir);
      if (!q.length) { setActive(null); setFallback({ source: active.source, label: active.label }); return; }
      setCounter((c) => c + 1);
      setActive({ ...active, id: counter + 1, direction: dir, questions: q });
    }
  };

  const doConfirm = () => {
    if (confirm === 'reset') { reset(); setActive(null); setFallback(null); setNotice(''); setDetail(null); }
    if (confirm === 'leave') closeSession();
    setConfirm(null);
  };

  const modeLabel = mode === 'flash' ? 'flashcards' : 'quiz';

  return (
    <div className="app-shell study-page">
      <AppHeader />
      <main className="content" id="study-main">
        {isLoading ? (
          <div className="skeleton-grid study-skeleton" aria-label="Loading study vocabulary" data-testid="status-loading">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-card"><div className="skeleton-block skeleton-copy" /></div>)}
          </div>
        ) : error ? (
          <div className="empty-state" data-testid="status-error">
            <div className="empty-seal" aria-hidden="true">再</div>
            <h2>The guide is resting.</h2>
            <p>We could not load the vocabulary. Check the connection and try again.</p>
            <button className="reset-button" onClick={onRetry} data-testid="button-retry-loading">Try again</button>
          </div>
        ) : active ? (
          <div className="study-session">
            <div className="session-bar">
              <button type="button" className="study-btn small" onClick={() => setConfirm('leave')} data-testid="button-leave-session">
                Leave session
              </button>
              <span className="session-label" data-testid="text-session-label">{active.label} / {active.kind === 'flash' ? 'Flashcards' : 'Quiz'}</span>
              <button type="button" className="study-btn small danger" onClick={() => setConfirm('reset')} data-testid="button-reset-progress">
                Reset progress
              </button>
            </div>
            {active.kind === 'flash' ? (
              <FlashSessionView
                key={active.id}
                session={active.session}
                direction={active.direction}
                termsById={termsById}
                savedIds={progress.savedIds}
                onRate={(id, rating) => {
                  rate(id, rating);
                  setActive((a) => (a && a.kind === 'flash' ? { ...a, session: advanceFlashSession(a.session, rating) } : a));
                }}
                onDirection={changeActiveDirection}
                onOpen={(id) => openDetail(active.scope, id)}
                onToggleSaved={toggleSaved}
                onRestart={() => beginFlash(active.source, active.direction, active.label)}
                onClose={closeSession}
              />
            ) : (
              <QuizSessionView
                key={active.id}
                questions={active.questions}
                direction={active.direction}
                requested={active.requested}
                savedIds={progress.savedIds}
                onRate={rate}
                onDirection={changeActiveDirection}
                onOpen={(id) => openDetail(active.scope, id)}
                onToggleSaved={toggleSaved}
                onPracticeMistakes={(list) => beginFlash(list, active.direction, 'Quiz mistakes')}
                onClose={closeSession}
              />
            )}
          </div>
        ) : (
          <>
            <section className="intro" aria-labelledby="study-title">
              <div>
                <p className="eyebrow">Study / 稽古</p>
                <h1 id="study-title" className="intro-title">A few terms.<br /><em>Said until they stay.</em></h1>
                <p className="intro-copy">Short rounds of up to ten terms from the words you hear in the dōjō. Come back when it suits you.</p>
              </div>
              <div className="kanji-seal" aria-hidden="true">習</div>
            </section>

            <section className="study-panel" aria-labelledby="progress-h" data-testid="panel-progress">
              <h2 id="progress-h" className="panel-h">Your vocabulary</h2>
              <dl className="stat-row">
                <div><dt>Seen</dt><dd data-testid="text-stat-seen">{seen}</dd></div>
                <div><dt>Remembered now</dt><dd data-testid="text-stat-remembered">{rememberedNow}</dd></div>
                <div><dt>Due now</dt><dd data-testid="text-stat-due">{due.length}</dd></div>
                <div><dt>Saved</dt><dd data-testid="text-stat-saved">{savedTerms.length}</dd></div>
              </dl>
              <p className="panel-note">
                These numbers describe vocabulary recall only. They are not a measure of technique, fitness, or readiness for any grading, and the sets below are not a grading syllabus.
              </p>
            </section>

            <section className="study-panel" aria-labelledby="setup-h">
              <h2 id="setup-h" className="panel-h">Start a round</h2>
              <fieldset className="choice-group">
                <legend>Topic</legend>
                <div className="choice-grid">
                  {topics.map((t) => {
                    const dueN = dueTerms(t.terms, progress, now).length;
                    const newN = t.terms.filter((x) => !progress.records[x.id]).length;
                    return (
                      <Choice key={t.id} name="topic" value={t.id} checked={topic === t.id} onChange={() => setTopic(t.id)}
                        title={t.title} meta={`${t.description}. ${t.terms.length} terms, ${dueN} due, ${newN} new`} />
                    );
                  })}
                </div>
              </fieldset>
              <div className="choice-split">
                <fieldset className="choice-group">
                  <legend>Mode</legend>
                  <div className="choice-grid two">
                    <Choice name="mode" value="flash" checked={mode === 'flash'} onChange={() => setMode('flash')} title="Flashcards" meta="Reveal, then rate yourself" />
                    <Choice name="mode" value="quiz" checked={mode === 'quiz'} onChange={() => setMode('quiz')} title="Quiz" meta="Pick from distinct choices" />
                  </div>
                </fieldset>
                <fieldset className="choice-group">
                  <legend>Prompt</legend>
                  <div className="choice-grid two">
                    <Choice name="direction" value="ja-en" checked={direction === 'ja-en'} onChange={() => setDirection('ja-en')} title="Japanese to English" />
                    <Choice name="direction" value="en-ja" checked={direction === 'en-ja'} onChange={() => setDirection('en-ja')} title="English to Japanese" />
                  </div>
                </fieldset>
              </div>
              <button type="button" className="study-btn primary big" disabled={!current.terms.length}
                onClick={() => start(current.terms, current.title)} data-testid="button-start-session">
                Start {modeLabel}
              </button>
              <p className="panel-note">
                Rounds use due terms first, then new ones, up to {Math.min(10, current.terms.length)} here. If those are finished, a topic round lets you practise future reviews early. Quiz answers count as recognition practice, not technique ability.
              </p>
              {notice && <p className="notice" role="status" data-testid="status-notice">{notice}</p>}
              {fallback && (
                <div className="notice" role="status" data-testid="status-quiz-unavailable">
                  <p>A quiz could not be built for this selection because its prompts have no unambiguous answer choices.</p>
                  <button type="button" className="study-btn small" onClick={() => beginFlash(fallback.source, direction, fallback.label)} data-testid="button-fallback-flashcards">
                    Study these as flashcards
                  </button>
                </div>
              )}
            </section>

            <div className="review-cols">
              <section className="study-panel" aria-labelledby="due-h" data-testid="panel-due">
                <h2 id="due-h" className="panel-h">Due for review</h2>
                {due.length === 0 ? (
                  <p className="empty-line" data-testid="status-no-due">
                    {seen === 0 ? 'Nothing yet. Terms you rate will return here when they are due.' : 'Nothing is due right now. Check back later.'}
                  </p>
                ) : (
                  <>
                    <ul className="term-list" data-testid="list-due">
                      {due.map((t) => (
                        <TermRow key={t.id} term={t} testKey="due" saved={progress.savedIds.includes(t.id)}
                          onOpen={() => openDetail(due.map((d) => d.id), t.id)} onToggle={() => toggleSaved(t.id)} />
                      ))}
                    </ul>
                    <button type="button" className="study-btn primary" onClick={() => start(due, 'Due review')} data-testid="button-start-due">
                      Review due terms
                    </button>
                  </>
                )}
              </section>
              <section className="study-panel" aria-labelledby="saved-h" data-testid="panel-saved">
                <h2 id="saved-h" className="panel-h">Saved difficult terms</h2>
                {savedTerms.length === 0 ? (
                  <p className="empty-line" data-testid="status-no-saved">
                    No saved terms. Use Save for review during a session or in any term's detail.
                  </p>
                ) : (
                  <>
                    <ul className="term-list" data-testid="list-saved">
                      {savedTerms.map((t) => (
                        <TermRow key={t.id} term={t} testKey="saved" saved
                          onOpen={() => openDetail(savedTerms.map((d) => d.id), t.id)} onToggle={() => toggleSaved(t.id)} />
                      ))}
                    </ul>
                    <button type="button" className="study-btn primary" onClick={() => start(savedTerms, 'Saved review')} data-testid="button-start-saved">
                      Review saved terms
                    </button>
                  </>
                )}
              </section>
            </div>

            <section className="study-panel" aria-labelledby="how-h">
              <h2 id="how-h" className="panel-h">How review works</h2>
              <p className="panel-note flush">
                Again returns the term in about 10 minutes and once more at the end of the current round. Remembered terms return after 1, 3, 7, 14, then 30 days. A term marked Again goes back to the start of that ladder.
              </p>
              <p className="panel-note flush">
                Progress is stored only in this browser on this device. It does not sync to other devices or accounts.
              </p>
              <button type="button" className="study-btn danger" onClick={() => setConfirm('reset')} data-testid="button-reset-progress">
                Reset study progress
              </button>
            </section>
          </>
        )}
      </main>

      {detailTerm && detail && (
        <DetailDialog
          term={detailTerm}
          position={detailPos}
          total={detailTerms.length}
          onClose={() => setDetail(null)}
          onNavigate={(d) => {
            const next = detailTerms[detailPos + d];
            if (next) setDetail({ scope: detail.scope, id: next.id });
          }}
          saved={progress.savedIds.includes(detailTerm.id)}
          onToggleSaved={() => toggleSaved(detailTerm.id)}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm === 'reset' ? 'Reset all study progress?' : 'Leave this session?'}
          body={confirm === 'reset'
            ? 'This clears review history and saved terms on this device and ends any session in progress. It cannot be undone.'
            : 'Your answers so far are kept. You can start a new round any time.'}
          confirmLabel={confirm === 'reset' ? 'Reset progress' : 'Leave session'}
          onConfirm={doConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
