import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArrowUpRight, Play, Search, X } from 'lucide-react';
import { AppNav, StorageBanner } from '@/study/AppNav';
import { DetailDialog, imageSrc } from '@/study/DetailDialog';
import { StudyPage } from '@/study/StudyApp';
import { useStudyProgress, type StudyProgressController } from '@/study/useStudyProgress';
import type { Category, Term } from '@/study/model';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

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

function useTerms() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

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

  return { terms, isLoading, error, onRetry: loadTerms };
}

type DataProps = { terms: Term[]; isLoading: boolean; error: boolean; onRetry: () => void; study: StudyProgressController };

function Home({ terms, isLoading, error, onRetry: loadTerms, study }: DataProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | Category>('all');
  const [tag, setTag] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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
          <AppNav />
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
        <DetailDialog
          saved={study.progress.savedIds.includes(selectedTerm.id)}
          onToggleSaved={() => study.toggleSaved(selectedTerm.id)}
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
  const [location] = useLocation();
  const data = useTerms();
  const study = useStudyProgress();
  useEffect(() => {
    const onStudy = location === '/study';
    const title = onStudy ? 'Study Goju-Ryu Vocabulary — Flashcards & Quizzes' : 'Goju-Ryu Karate Dictionary';
    const description = onStudy
      ? 'Practise Goju-Ryu vocabulary with short flashcard sessions, two-way quizzes, spaced review, and progress saved on this device.'
      : 'Explore 102 Goju-Ryu Karate terms with Japanese kanji, clear English explanations, and illustrated technique guides.';
    document.title = title;
    for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) {
      document.querySelector(selector)?.setAttribute('content', title);
    }
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
      document.querySelector(selector)?.setAttribute('content', description);
    }
  }, [location]);
  return (
    <>
      <StorageBanner warning={study.storageWarning} />
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/"><Home {...data} study={study} /></Route>
          <Route path="/study"><StudyPage {...data} study={study} /></Route>
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </>
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
