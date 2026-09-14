import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArrowUpRight, BookOpen, ChevronLeft, ChevronRight, Info, Search, X } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

type Category = 'stance' | 'punch' | 'strike' | 'kick' | 'block';

type Technique = {
  id: string;
  name: string;
  kanji: string;
  category: Category;
  english: string;
  image: string;
  motion_prompt: string;
  duration_seconds: number;
  loop: boolean;
};

const queryClient = new QueryClient();
const categoryOrder: Array<'all' | Category> = ['all', 'stance', 'punch', 'strike', 'kick', 'block'];
const categoryLabels: Record<'all' | Category, string> = {
  all: 'All terms',
  stance: 'Stances',
  punch: 'Punches',
  strike: 'Strikes',
  kick: 'Kicks',
  block: 'Blocks',
};

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

function TechniqueCard({
  technique,
  index,
  onOpen,
}: {
  technique: Technique;
  index: number;
  onOpen: (technique: Technique) => void;
}) {
  return (
    <button
      className="technique-card"
      style={{ animationDelay: `${Math.min(index * 35, 350)}ms` }}
      onClick={() => onOpen(technique)}
      data-testid={`card-technique-${technique.id}`}
      aria-label={`Open ${technique.name}, ${technique.english}`}
    >
      <div className="card-art">
        <img
          src={imageSrc(technique.image)}
          alt={`${technique.name} — ${technique.english}`}
          loading="lazy"
          data-testid={`img-technique-${technique.id}`}
        />
        <span className="card-category">{technique.category}</span>
        <span className="card-index">{String(index + 1).padStart(2, '0')}</span>
      </div>
      <div className="card-info">
        <div className="card-name-row">
          <h3 className="card-name">{technique.name}</h3>
          <span className="card-kanji">{technique.kanji}</span>
        </div>
        <p className="card-english">{technique.english}</p>
        <p className="card-description">{technique.motion_prompt}</p>
        <span className="card-link">
          Study entry <ArrowUpRight size={13} strokeWidth={2.2} aria-hidden="true" />
        </span>
      </div>
    </button>
  );
}

function DetailPanel({
  technique,
  position,
  total,
  onClose,
  onNavigate,
}: {
  technique: Technique;
  position: number;
  total: number;
  onClose: () => void;
  onNavigate: (direction: -1 | 1) => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && position > 0) onNavigate(-1);
      if (event.key === 'ArrowRight' && position < total - 1) onNavigate(1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNavigate, position, total]);

  return (
    <>
      <div className="backdrop" onClick={onClose} data-testid="button-close-backdrop" />
      <aside
        className="detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        data-testid={`detail-panel-${technique.id}`}
      >
        <div className="detail-panel-inner">
          <div className="detail-top">
            <span className="detail-label">Field guide / {technique.category}</span>
            <button
              className="close-detail"
              onClick={onClose}
              aria-label="Close technique detail"
              data-testid="button-close-detail"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="detail-art">
            <img
              src={imageSrc(technique.image)}
              alt={`${technique.name} illustrated technique reference`}
              data-testid={`detail-image-${technique.id}`}
            />
          </div>
          <div className="detail-heading">
            <div>
              <h2 id="detail-title">{technique.name}</h2>
              <p className="detail-english">{technique.english}</p>
            </div>
            <span className="detail-kanji" lang="ja">{technique.kanji}</span>
          </div>
          <div className="detail-rule" />
          <p className="detail-section-label">Movement cue</p>
          <p className="detail-description">{technique.motion_prompt}</p>
          <div className="training-note">
            <Info size={16} aria-hidden="true" />
            <p>Use this illustration as a memory cue, then confirm the shape and timing with your instructor on the floor.</p>
          </div>
          <div className="detail-nav">
            <button
              onClick={() => onNavigate(-1)}
              disabled={position === 0}
              data-testid="button-previous-technique"
              aria-label="Previous technique"
            >
              <ChevronLeft size={14} aria-hidden="true" /> Previous
            </button>
            <span className="detail-index" aria-label={`Technique ${position + 1} of ${total}`}>
              {String(position + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </span>
            <button
              onClick={() => onNavigate(1)}
              disabled={position === total - 1}
              data-testid="button-next-technique"
              aria-label="Next technique"
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
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | Category>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const loadTechniques = () => {
    setIsLoading(true);
    setError(false);
    fetch(`${import.meta.env.BASE_URL}techniques.json`)
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load terminology');
        return response.json() as Promise<Technique[]>;
      })
      .then((data) => setTechniques(data))
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadTechniques();
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

  const filteredTechniques = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return techniques.filter((technique) => {
      const matchesCategory = category === 'all' || technique.category === category;
      const searchable = `${technique.name} ${technique.kanji} ${technique.english} ${technique.motion_prompt}`.toLowerCase();
      return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [category, query, techniques]);

  const selectedTechnique = useMemo(
    () => techniques.find((technique) => technique.id === selectedId) ?? null,
    [selectedId, techniques],
  );
  const selectedPosition = selectedTechnique ? filteredTechniques.findIndex((technique) => technique.id === selectedTechnique.id) : -1;

  const categoryCount = (value: 'all' | Category) =>
    value === 'all' ? techniques.length : techniques.filter((technique) => technique.category === value).length;

  const openTechnique = (technique: Technique) => setSelectedId(technique.id);
  const resetFilters = () => {
    setQuery('');
    setCategory('all');
    searchRef.current?.focus();
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
                aria-label="Search karate terminology"
                data-testid="input-search-techniques"
              />
              {query ? (
                <button className="clear-search" onClick={() => setQuery('')} aria-label="Clear search" data-testid="button-clear-search">
                  <X size={14} aria-hidden="true" />
                </button>
              ) : (
                <span className="shortcut" aria-hidden="true">⌘ K</span>
              )}
            </div>
            <div className="count-stamp" aria-label={`${techniques.length} entries in dictionary`}>
              <strong>{techniques.length || '—'}</strong>
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
                onClick={() => setCategory(value)}
                data-testid={`filter-category-${value}`}
              >
                {categoryLabels[value]}
                <span className="filter-count">{categoryCount(value)}</span>
              </button>
            ))}
          </nav>
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
          <h2>{query || category !== 'all' ? 'Matching terms' : 'The vocabulary'}</h2>
          <span className="line" aria-hidden="true" />
          <span className="grid-meta" data-testid="text-result-count">{filteredTechniques.length} shown</span>
        </div>

        {isLoading ? <LoadingGrid /> : error ? (
          <div className="empty-state" data-testid="status-error">
            <div className="empty-seal" aria-hidden="true">再</div>
            <h2>The guide is resting.</h2>
            <p>We could not load the supplied terminology. Check the connection and try again.</p>
            <button className="reset-button" onClick={loadTechniques} data-testid="button-retry-loading">Try again</button>
          </div>
        ) : filteredTechniques.length === 0 ? (
          <div className="empty-state" data-testid="status-empty">
            <div className="empty-seal" aria-hidden="true">探</div>
            <h2>No matching term.</h2>
            <p>Try a Japanese name, an English translation, or clear the current filters to return to the full field guide.</p>
            <button className="reset-button" onClick={resetFilters} data-testid="button-reset-filters">Show all terms</button>
          </div>
        ) : (
          <div className="term-grid" data-testid="grid-techniques">
            {filteredTechniques.map((technique, index) => (
              <TechniqueCard key={technique.id} technique={technique} index={index} onOpen={openTechnique} />
            ))}
          </div>
        )}
      </main>

      <footer className="site-footer">
        <span className="footer-mark" aria-hidden="true">剛柔</span>
        <span>Study with attention. Train with a teacher. This guide is a memory aid, not a substitute for instruction.</span>
      </footer>

      {selectedTechnique && selectedPosition >= 0 ? (
        <DetailPanel
          technique={selectedTechnique}
          position={selectedPosition}
          total={filteredTechniques.length}
          onClose={() => setSelectedId(null)}
          onNavigate={(direction) => {
            const next = filteredTechniques[selectedPosition + direction];
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