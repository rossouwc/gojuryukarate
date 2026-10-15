import { useEffect, useRef, useState } from 'react';
import { Bookmark, ChevronLeft, ChevronRight, Info, Pause, Play, X } from 'lucide-react';
import { ModalShell } from './Dialog';
import type { Term } from './model';

export function imageSrc(path: string) {
  const cleanPath = path.replace(/^\/+/, '');
  return `${import.meta.env.BASE_URL}${cleanPath}`;
}

export function DetailDialog({
  term,
  position,
  total,
  onClose,
  onNavigate,
  saved,
  onToggleSaved,
}: {
  term: Term;
  position: number;
  total: number;
  onClose: () => void;
  onNavigate: (direction: -1 | 1) => void;
  saved: boolean;
  onToggleSaved: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input,textarea,select,video,[contenteditable="true"],[role="slider"]')) return;
      if (event.key === 'ArrowLeft' && position > 0) onNavigate(-1);
      if (event.key === 'ArrowRight' && position < total - 1) onNavigate(1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate, position, total]);

  useEffect(() => {
    setIsPlaying(false);
    setVideoFailed(false);
  }, [term.id]);

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      try {
        await video.play();
      } catch {
        setVideoFailed(true);
      }
    } else {
      video.pause();
    }
  };

  return (
    <ModalShell className="detail-panel" labelledBy="detail-title" onClose={onClose} testId={`detail-panel-${term.id}`}>
      <div className="detail-panel-inner">
        <div className="detail-top">
          <span className="detail-label">Field guide / {term.category} {term.tag ? ` / ${term.tag}` : ''}</span>
          <button className="close-detail" data-autofocus onClick={onClose} aria-label="Close detail" data-testid="button-close-detail">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className={`detail-art ${!term.image ? 'text-only-art' : ''}`}>
          {term.image ? (
            !term.video || videoFailed ? (
              <img src={imageSrc(term.image)} alt={`${term.name} reference`} data-testid={`detail-image-${term.id}`} />
            ) : (
              <>
                <video
                  key={term.id}
                  ref={videoRef}
                  poster={imageSrc(term.image)}
                  aria-label={`${term.name} four second movement demonstration`}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onError={() => setVideoFailed(true)}
                  data-testid={`detail-video-${term.id}`}
                >
                  <source src={imageSrc(term.video.replace(/\.mp4$/, '.webm'))} type="video/webm" />
                  <source src={imageSrc(term.video)} type="video/mp4" />
                </video>
                <button
                  className="video-control"
                  type="button"
                  onClick={togglePlayback}
                  aria-label={isPlaying ? `Pause ${term.name} demonstration` : `Play ${term.name} demonstration`}
                  aria-pressed={isPlaying}
                  data-testid={`button-video-${term.id}`}
                >
                  {isPlaying ? <Pause size={15} fill="currentColor" aria-hidden="true" /> : <Play size={15} fill="currentColor" aria-hidden="true" />}
                  <span>{isPlaying ? 'Pause movement' : 'Play movement'}</span>
                </button>
              </>
            )
          ) : (
            <div className="text-art-inner" style={{ transform: 'none' }}>
              <span className="text-art-kanji">{term.kanji || term.name.charAt(0)}</span>
            </div>
          )}
        </div>
        <div className="detail-heading">
          <div>
            <h2 id="detail-title">{term.name}</h2>
            <p className="detail-english">{term.english}</p>
          </div>
          <span className="detail-kanji" lang="ja">{term.kanji}</span>
        </div>
        <div className="detail-rule" />
        <p className="detail-section-label">Movement cue</p>
        <p className="detail-description">{term.description}</p>
        <div className="training-note">
          <Info size={16} aria-hidden="true" />
          <p>
            {term.image
              ? 'These AI-generated illustrations show selected moments, not complete movement sequences. Confirm the anatomy, form and terminology with a qualified instructor. A still image cannot establish timing, direction or weight distribution.'
              : 'Use this guide as a memory cue, then confirm the shape and timing with your instructor on the floor.'}
            {term.video && ' The existing motion clip uses the previous illustrations and has not been regenerated from this updated image set.'}
          </p>
        </div>
        <button
          type="button"
          className="study-btn save-detail"
          aria-pressed={saved}
          onClick={onToggleSaved}
          data-testid="button-save-detail"
        >
          <Bookmark size={15} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
          {saved ? 'Saved for review' : 'Save for review'}
        </button>
        <div className="detail-nav">
          <button onClick={() => onNavigate(-1)} disabled={position === 0} data-testid="button-previous-term" aria-label="Previous term">
            <ChevronLeft size={14} aria-hidden="true" /> Previous
          </button>
          <span className="detail-index" aria-label={`Term ${position + 1} of ${total}`}>
            {String(position + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
          <button onClick={() => onNavigate(1)} disabled={position === total - 1} data-testid="button-next-term" aria-label="Next term">
            Next <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
