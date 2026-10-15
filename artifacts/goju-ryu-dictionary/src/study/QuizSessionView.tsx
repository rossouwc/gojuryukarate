import { useEffect, useRef, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { answerText, promptText } from './engine';
import { DirectionToggle } from './FlashSessionView';
import type { Direction, QuizQuestion, Term } from './model';

export function QuizSessionView({
  questions,
  direction,
  requested,
  savedIds,
  onRate,
  onDirection,
  onOpen,
  onToggleSaved,
  onPracticeMistakes,
  onClose,
}: {
  questions: QuizQuestion[];
  direction: Direction;
  requested: number;
  savedIds: string[];
  onRate: (id: string, rating: 'again' | 'remembered') => void;
  onDirection: (d: Direction) => void;
  onOpen: (id: string) => void;
  onToggleSaved: (id: string) => void;
  onPracticeMistakes: (terms: Term[]) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [results, setResults] = useState<{ term: Term; correct: boolean }[]>([]);
  const nextRef = useRef<HTMLButtonElement>(null);
  const promptRef = useRef<HTMLHeadingElement>(null);
  const completeRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (picked) nextRef.current?.focus();
  }, [picked]);
  useEffect(() => {
    if (index >= questions.length) completeRef.current?.focus();
    else if (index > 0) promptRef.current?.focus();
  }, [index, questions.length]);

  const question = questions[index];

  if (!question) {
    const mistakes = results.filter((r) => !r.correct).map((r) => r.term);
    const score = results.length - mistakes.length;
    return (
      <section className="session-card" aria-labelledby="quiz-done" data-testid="quiz-results">
        <p className="session-kicker">Quiz results</p>
        <h2 id="quiz-done" ref={completeRef} tabIndex={-1} className="session-title" data-testid="text-quiz-score">
          {score} of {results.length} correct
        </h2>
        <p className="session-copy">
          This was recognition practice for vocabulary. It says nothing about how well you can perform a technique.
        </p>
        {mistakes.length > 0 ? (
          <>
            <h3 className="mini-heading">Review these</h3>
            <ul className="mini-list" data-testid="list-mistakes">
              {mistakes.map((t) => (
                <li key={t.id}>
                  <span>{t.name} <em>{t.english}</em></span>
                  <button type="button" className="study-btn small" onClick={() => onOpen(t.id)} data-testid={`button-open-mistake-${t.id}`}>
                    Details
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="session-copy">No mistakes this time.</p>
        )}
        <div className="session-actions">
          {mistakes.length > 0 && (
            <button type="button" className="study-btn primary" onClick={() => onPracticeMistakes(mistakes)} data-testid="button-practice-mistakes">
              Practice mistakes as flashcards
            </button>
          )}
          <button type="button" className="study-btn" onClick={onClose} data-testid="button-back-to-study">Back to study</button>
        </div>
      </section>
    );
  }

  const correctId = question.term.id;
  const isCorrect = picked === correctId;
  const saved = savedIds.includes(correctId);

  const choose = (option: Term) => {
    if (picked) return;
    setPicked(option.id);
    const correct = option.id === correctId;
    onRate(correctId, correct ? 'remembered' : 'again');
    setResults((r) => [...r, { term: question.term, correct }]);
  };
  const next = () => {
    setPicked(null);
    setIndex((i) => i + 1);
  };

  return (
    <section className="session-card" aria-labelledby="quiz-prompt" data-testid="quiz-session">
      <div className="session-meta">
        <span data-testid="text-quiz-progress">Question {index + 1} of {questions.length}</span>
        <DirectionToggle direction={direction} onChange={onDirection} />
      </div>
      <p className="session-note">
        Changing direction restarts this quiz.
        {questions.length < requested && ` ${requested - questions.length} of ${requested} terms were left out because they had no unambiguous choices.`}
      </p>
      <p className="session-kicker">{direction === 'ja-en' ? 'Choose the meaning' : 'Choose the Japanese term'}</p>
      <h2 id="quiz-prompt" ref={promptRef} tabIndex={-1} className="flash-prompt" data-testid="text-quiz-prompt">
        {promptText(question.term, direction)}
      </h2>
      <div className="quiz-options" role="group" aria-label="Answer choices">
        {question.options.map((option) => {
          const state = !picked ? '' : option.id === correctId ? 'is-correct' : option.id === picked ? 'is-wrong' : 'is-dim';
          return (
            <button
              key={option.id}
              type="button"
              className={`quiz-option ${state}`}
              aria-disabled={picked ? true : undefined}
              onClick={() => choose(option)}
              data-testid={`button-option-${option.id}`}
            >
              <span>{answerText(option, direction)}</span>
              {picked && option.id === correctId && <span className="vh"> (correct answer)</span>}
              {picked && option.id === picked && option.id !== correctId && <span className="vh"> (your answer, incorrect)</span>}
            </button>
          );
        })}
      </div>
      <div aria-live="polite" role="status" data-testid="status-quiz-feedback">
        {picked && (
          <div className={`answer-block ${isCorrect ? 'ok' : 'miss'}`}>
            <p className="answer-text">{isCorrect ? 'Correct.' : `Not quite. The answer is ${answerText(question.term, direction)}.`}</p>
            <p className="cue-text">{question.term.description}</p>
            <button type="button" className="link-btn" onClick={() => onOpen(correctId)} data-testid="button-open-detail">
              Open full detail
            </button>
          </div>
        )}
      </div>
      <div className="session-actions">
        {picked && (
          <button ref={nextRef} type="button" className="study-btn primary big" onClick={next} data-testid="button-next-question">
            {index === questions.length - 1 ? 'See results' : 'Next question'}
          </button>
        )}
        <button
          type="button"
          className="study-btn small save-inline"
          aria-pressed={saved}
          onClick={() => onToggleSaved(correctId)}
          data-testid="button-save-current"
        >
          <Bookmark size={14} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
          {saved ? 'Saved for review' : 'Save for review'}
        </button>
      </div>
    </section>
  );
}
