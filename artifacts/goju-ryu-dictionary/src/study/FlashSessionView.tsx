import { useEffect, useRef, useState } from 'react';
import { Bookmark, Eye } from 'lucide-react';
import { answerText, promptText } from './engine';
import { imageSrc } from './DetailDialog';
import type { Direction, FlashSession, Rating, Term } from './model';

export function DirectionToggle({ direction, onChange }: { direction: Direction; onChange: (d: Direction) => void }) {
  return (
    <div className="seg" role="group" aria-label="Prompt direction">
      <button type="button" aria-pressed={direction === 'ja-en'} onClick={() => onChange('ja-en')} data-testid="button-direction-ja-en">
        Japanese to English
      </button>
      <button type="button" aria-pressed={direction === 'en-ja'} onClick={() => onChange('en-ja')} data-testid="button-direction-en-ja">
        English to Japanese
      </button>
    </div>
  );
}

export function FlashSessionView({
  session,
  direction,
  termsById,
  savedIds,
  onRate,
  onDirection,
  onOpen,
  onToggleSaved,
  onRestart,
  onClose,
}: {
  session: FlashSession;
  direction: Direction;
  termsById: Map<string, Term>;
  savedIds: string[];
  onRate: (id: string, rating: Rating) => void;
  onDirection: (d: Direction) => void;
  onOpen: (id: string) => void;
  onToggleSaved: (id: string) => void;
  onRestart: () => void;
  onClose: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const promptRef = useRef<HTMLHeadingElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const completeRef = useRef<HTMLHeadingElement>(null);
  const finished = session.index >= session.queue.length;
  const id = session.queue[session.index];
  const term = id ? termsById.get(id) : undefined;

  useEffect(() => {
    if (finished) completeRef.current?.focus();
    else if (session.index > 0) promptRef.current?.focus();
  }, [session.index, finished]);

  if (finished) {
    const last = new Map(session.ratings.map((r) => [r.id, r.rating]));
    const tough = session.originalIds.filter((x) => last.get(x) === 'again');
    const good = session.originalIds.length - tough.length;
    return (
      <section className="session-card" aria-labelledby="flash-done" data-testid="flash-complete">
        <p className="session-kicker">Round complete</p>
        <h2 id="flash-done" ref={completeRef} tabIndex={-1} className="session-title">
          {good} of {session.originalIds.length} felt solid.
        </h2>
        <p className="session-copy">
          Terms marked Again will return in about ten minutes. Remembered terms come back after longer gaps. This reflects vocabulary recall only.
        </p>
        {tough.length > 0 && (
          <ul className="mini-list" aria-label="Terms to revisit">
            {tough.map((x) => {
              const t = termsById.get(x);
              return t ? (
                <li key={x}>
                  <span>{t.name} <em>{t.english}</em></span>
                  <button type="button" className="study-btn small" onClick={() => onOpen(x)} data-testid={`button-open-tough-${x}`}>
                    Details
                  </button>
                </li>
              ) : null;
            })}
          </ul>
        )}
        <div className="session-actions">
          <button type="button" className="study-btn primary" onClick={onRestart} data-testid="button-study-again">Another round</button>
          <button type="button" className="study-btn" onClick={onClose} data-testid="button-back-to-study">Back to study</button>
        </div>
      </section>
    );
  }
  if (!term) return null;

  const isSecondLook = session.index >= session.originalIds.length;
  const saved = savedIds.includes(term.id);
  const rate = (rating: Rating) => {
    onRate(term.id, rating);
    setRevealed(false);
  };

  return (
    <section className="session-card" aria-labelledby="flash-prompt" data-testid="flash-session">
      <div className="session-meta">
        <span data-testid="text-flash-progress">Card {session.index + 1} of {session.queue.length}</span>
        {isSecondLook && <span className="pill">Second look</span>}
        <DirectionToggle
          direction={direction}
          onChange={(d) => {
            setRevealed(false);
            onDirection(d);
          }}
        />
      </div>
      <p className="session-note">Terms marked Again come back once more at the end of this round, then the round ends.</p>
      <p className="session-kicker">{direction === 'ja-en' ? 'What does this mean?' : 'What is the Japanese term?'}</p>
      <h2 id="flash-prompt" ref={promptRef} tabIndex={-1} className="flash-prompt" lang={direction === 'ja-en' ? 'ja' : 'en'} data-testid="text-flash-prompt">
        {promptText(term, direction)}
      </h2>
      {!revealed ? (
        <div className="session-actions">
          <button
            type="button"
            className="study-btn primary big"
            onClick={() => {
              setRevealed(true);
              setTimeout(() => answerRef.current?.focus(), 0);
            }}
            data-testid="button-reveal"
          >
            <Eye size={16} aria-hidden="true" /> Reveal answer
          </button>
        </div>
      ) : (
        <>
          <div ref={answerRef} tabIndex={-1} className="answer-block" aria-live="polite" data-testid="flash-answer">
            <p className="session-kicker">Answer</p>
            <p className="answer-text" data-testid="text-flash-answer">{answerText(term, direction)}</p>
            <div className="answer-cue">
              {term.image && <img src={imageSrc(term.image)} alt={`${term.name} reference illustration`} />}
              <div>
                <p className="detail-section-label">Movement cue</p>
                <p className="cue-text">{term.description}</p>
                <button type="button" className="link-btn" onClick={() => onOpen(term.id)} data-testid="button-open-detail">
                  Open full detail
                </button>
              </div>
            </div>
          </div>
          <div className="rate-row" role="group" aria-label="How well did you recall it?">
            <button type="button" className="study-btn big" onClick={() => rate('again')} data-testid="button-rate-again">
              Again
            </button>
            <button type="button" className="study-btn primary big" onClick={() => rate('remembered')} data-testid="button-rate-remembered">
              Remembered
            </button>
          </div>
        </>
      )}
      <button
        type="button"
        className="study-btn small save-inline"
        aria-pressed={saved}
        onClick={() => onToggleSaved(term.id)}
        data-testid="button-save-current"
      >
        <Bookmark size={14} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
        {saved ? 'Saved for review' : 'Save for review'}
      </button>
    </section>
  );
}
