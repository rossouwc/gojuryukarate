import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArrowUpRight, ChevronLeft, ChevronRight, Info, Pause, Play, Search, X } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

type Category = 'stances' | 'punches' | 'strikes' | 'kicks' | 'blocks' | 'general';

type Term = {
  id: string;
  name: string;
  kanji: string;
  category: Category;
  tag?: string;
  english: string;
  description: string;
  image: string | null;
  video?: string;
};

type TechniqueMedia = Pick<Term, 'id'> & {
  video: string;
};

const queryClient = new QueryClient();
const categoryOrder: Array<'all' | Category> = ['all', 'stances', 'punches', 'strikes', 'kicks', 'blocks', 'general'];
const categoryLabels: Record<'all' | Category, string> = {
  all: 'All terms',
  stances: 'Stances',
  punches: 'Punches',
  strikes: 'Strikes',
  kicks: 'Kicks',
  blocks: 'Blocks',
  general: 'General',
};

const generalTags = ['Commands & etiquette', 'Levels & directions', 'Body weapons', 'Concepts', 'Kata'];

function imageSrc(path: string) {
  const cleanPath = path.replace(/^\/+/, '');
  return `${import.meta.env.BASE_URL}${cleanPath}`;
}

function LoadingGrid() {
  return (
    <div className="skeleton-grid" aria-label="Loading terminology" data-testid="status-loading">
      {Array.from({ length: 12 }).map((_, index) => (
        <div className="skeleton-card" key={index}>
          <div className="skeleton-block skeleton-image" />
          <div className="skeleton-block skeleton-copy" />
        </div>
      ))}
    </div>
  );
}

function TermCard({
  term,
  index,
  onOpen,
}: {
  term: Term;
  index: number;
  onOpen: (term: Term) => void;
}) {
  const isTextOnly = !term.image;
  return (
    <button
      className="technique-card"
      style={{ animationDelay: `${Math.min(index * 35, 350)}ms` }}
      onClick={() => onOpen(term)}
      data-testid={`card-term-${term.id}`}
      aria-label={`Open ${term.name}, ${term.english}`}
    >
      <div className={`card-art ${isTextOnly ? 'text-only-art' : ''}`}>
        {term.image ? (
          <img
            src={imageSrc(term.image)}
            alt={`${term.name} — ${term.english}`}
            loading="lazy"
            data-testid={`img-term-${term.id}`}
          />
        ) : (
          <div className="text-art-inner">
            <span className="text-art-kanji">{term.kanji || term.name.charAt(0)}</span>
          </div>
        )}
        <span className={`card-category ${isTextOnly ? 'text-tag' : ''}`}>{term.tag || categoryLabels[term.category]}</span>
        {term.video ? (
          <span className="card-motion-badge" aria-hidden="true">
            <Play size={9} fill="currentColor" /> 4 sec
          </span>
        ) : null}
        <span className={`card-index ${isTextOnly ? 'text-tag' : ''}`}>{String(index + 1).padStart(2, '0')}</span>
      </div>
      <div className="card-info">
        <div className="card-name-row">
          <h3 className="card-name">{term.name}</h3>
          <span className="card-kanji">{term.kanji}</span>
        </div>
        <p className="card-english">{term.english}</p>
        <p className="card-description">{term.description}</p>
        <span className="card-link">
          Study entry <ArrowUpRight size={13} strokeWidth={2.2} aria-hidden="true" />
        </span>
      </div>
    </button>
  );
}

function DetailPanel({
  term,
  position,
  total,
  onClose,
  onNavigate,
}: {
  term: Term;
  position: number;
  total: number;
  onClose: () => void;
  onNavigate: (direction: -1 | 1) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && position > 0) onNavigate(-1);
      if (event.key === 'ArrowRight' && position < total - 1) onNavigate(1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNavigate, position, total]);

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
    <>
      <div className="backdrop" onClick={onClose} data-testid="button-close-backdrop" />
      <aside
        className="detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        data-testid={`detail-panel-${term.id}`}
      >
        <div className="detail-panel-inner">
          <div className="detail-top">
            <span className="detail-label">Field guide / {term.category} {term.tag ? ` / ${term.tag}` : ''}</span>
            <button
              className="close-detail"
              onClick={onClose}
              aria-label="Close detail"
              data-testid="button-close-detail"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className={`detail-art ${!term.image ? 'text-only-art' : ''}`}>
            {term.image ? (
              !term.video || videoFailed ? (
                <img
                  src={imageSrc(term.image)}
                  alt={`${term.name} reference`}
                  data-testid={`detail-image-${term.id}`}
                />
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
            <p>Use this guide as a memory cue, then confirm the shape and timing with your instructor on the floor.</p>
          </div>
          <div className="detail-nav">
            <button
              onClick={() => onNavigate(-1)}
              disabled={position === 0}
              data-testid="button-previous-term"
              aria-label="Previous term"
            >
              <ChevronLeft size={14} aria-hidden="true" /> Previous
            </button>
            <span className="detail-index" aria-label={`Term ${position + 1} of ${total}`}>
              {String(position + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </span>
            <button
              onClick={() => onNavigate(1)}
              disabled={position === total - 1}
              data-testid="button-next-term"
              aria-label="Next term"
            >
              Next <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function Home() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | Category>('all');
  const [tag, setTag] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const loadTerms = () => {
    setIsLoading(true);
    setError(false);
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}terms.json`).then((response) => {
        if (!response.ok) throw new Error('Unable to load terminology');
        return response.json() as Promise<Term[]>;
      }),
      fetch(`${import.meta.env.BASE_URL}techniques.json`).then((response) => {
        if (!response.ok) throw new Error('Unable to load technique media');
        return response.json() as Promise<TechniqueMedia[]>;
      }),
    ])
      .then(([data, media]) => {
        const videosById = new Map(media.map((technique) => [technique.id, technique.video]));
        setTerms(data.map((term) => ({ ...term, video: videosById.get(term.id) })));
      })
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadTerms();
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    document.body.style.overflow = selectedId ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedId]);

  const filteredTerms = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return terms.filter((term) => {
      const matchesCategory = category === 'all' || term.category === category;
      const matchesTag = !tag || term.tag === tag;
      const searchable = `${term.name} ${term.kanji} ${term.english} ${term.description}`.toLowerCase();
      return matchesCategory && matchesTag && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [category, tag, query, terms]);

  const selectedTerm = useMemo(
    () => terms.find((term) => term.id === selectedId) ?? null,
    [selectedId, terms],
  );
  const selectedPosition = selectedTerm ? filteredTerms.findIndex((term) => term.id === selectedTerm.id) : -1;

  const categoryCount = (value: 'all' | Category) =>
    value === 'all' ? terms.length : terms.filter((term) => term.category === value).length;

  const tagCount = (value: string) =>
    terms.filter((term) => term.tag === value).length;

  const openTerm = (term: Term) => setSelectedId(term.id);
  const resetFilters = () => {
    setQuery('');
    setCategory('all');
    setTag(null);
    searchRef.current?.focus();
  };

  const handleCategoryChange = (value: 'all' | Category) => {
    setCategory(value);
    if (value !== 'general') setTag(null);
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <div className="brand-row">
            <div className="brand-mark" aria-hidden="true">剛</div>
            <div className="brand-copy">
              <p className="brand-name">Gōjū-ryū Dictionary</p>
              <p className="brand-kicker">A visual field guide for the dōjō</p>
            </div>
            <div className="header-rule" aria-hidden="true" />
            <span className="brand-note">Terminology for steady practice</span>
          </div>
          <div className="search-row">
            <div className="search-box">
              <Search className="search-icon" size={18} aria-hidden="true" />
              <input
                ref={searchRef}
                className="search-input"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search a term, translation, or cue"
                aria-label="Search terminology"
                data-testid="input-search-terms"
              />
              {query ? (
                <button className="clear-search" onClick={() => setQuery('')} aria-label="Clear search" data-testid="button-clear-search">
                  <X size={14} aria-hidden="true" />
                </button>
              ) : (
                <span className="shortcut" aria-hidden="true">⌘ K</span>
              )}
            </div>
            <div className="count-stamp" aria-label={`${terms.length} entries in dictionary`}>
              <strong>{terms.length || '—'}</strong>
              entries
            </div>
          </div>
          <nav className="filter-row" aria-label="Filter by technique category">
            <span className="filter-label">Browse by</span>
            {categoryOrder.map((value) => (
              <button
                key={value}
                className="filter-button"
                aria-pressed={category === value}
                onClick={() => handleCategoryChange(value)}
                data-testid={`filter-category-${value}`}
              >
                {categoryLabels[value]}
                <span className="filter-count">{categoryCount(value)}</span>
              </button>
            ))}
          </nav>
          
          {category === 'general' && (
            <nav className="sub-filter-row" aria-label="Filter by general tags">
              <span className="sub-filter-label">Tag</span>
              {generalTags.map((t) => (
                <button
                  key={t}
                  className="sub-filter-button"
                  aria-pressed={tag === t}
                  onClick={() => setTag(tag === t ? null : t)}
                  data-testid={`filter-tag-${t.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  {t} <span className="filter-count">{tagCount(t)}</span>
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>

      <main className="content">
        <section className="intro" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">Study / 呼吸と動作</p>
            <h1 id="page-title" className="intro-title">Find the shape.<br /><em>Remember the feeling.</em></h1>
            <p className="intro-copy">A compact reference for the language of Gōjū-ryū — from the rooted quiet of a stance to the clean line of a strike.</p>
          </div>
          <div className="kanji-seal" aria-hidden="true">道</div>
        </section>

        <div className="grid-heading">
          <h2>{query || category !== 'all' || tag ? 'Matching terms' : 'The vocabulary'}</h2>
          <span className="line" aria-hidden="true" />
          <span className="grid-meta" data-testid="text-result-count">{filteredTerms.length} shown</span>
        </div>

        {isLoading ? <LoadingGrid /> : error ? (
          <div className="empty-state" data-testid="status-error">
            <div className="empty-seal" aria-hidden="true">再</div>
            <h2>The guide is resting.</h2>
            <p>We could not load the supplied terminology. Check the connection and try again.</p>
            <button className="reset-button" onClick={loadTerms} data-testid="button-retry-loading">Try again</button>
          </div>
        ) : filteredTerms.length === 0 ? (
          <div className="empty-state" data-testid="status-empty">
            <div className="empty-seal" aria-hidden="true">探</div>
            <h2>No matching term.</h2>
            <p>Try a Japanese name, an English translation, or clear the current filters to return to the full field guide.</p>
            <button className="reset-button" onClick={resetFilters} data-testid="button-reset-filters">Show all terms</button>
          </div>
        ) : (
          <div className="term-grid" data-testid="grid-terms">
            {filteredTerms.map((term, index) => (
              <TermCard key={term.id} term={term} index={index} onOpen={openTerm} />
            ))}
          </div>
        )}
      </main>

      <footer className="site-footer">
        <span className="footer-mark" aria-hidden="true">剛柔</span>
        <span>Study with attention. Train with a teacher. This guide is a memory aid, not a substitute for instruction.</span>
      </footer>

      {selectedTerm && selectedPosition >= 0 ? (
        <DetailPanel
          term={selectedTerm}
          position={selectedPosition}
          total={filteredTerms.length}
          onClose={() => setSelectedId(null)}
          onNavigate={(direction) => {
            const next = filteredTerms[selectedPosition + direction];
            if (next) setSelectedId(next.id);
          }}
        />
      ) : null}
    </div>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
