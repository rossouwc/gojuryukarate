import { Link, useLocation } from 'wouter';
import { AlertTriangle } from 'lucide-react';

export function AppNav() {
  const [location] = useLocation();
  const onStudy = location.startsWith('/study');
  return (
    <nav className="mode-nav" aria-label="Main sections">
      <Link href="/" className="mode-link" aria-current={!onStudy ? 'page' : undefined} data-testid="link-nav-dictionary">
        Dictionary
      </Link>
      <Link href="/study" className="mode-link" aria-current={onStudy ? 'page' : undefined} data-testid="link-nav-study">
        Study
      </Link>
    </nav>
  );
}

export function AppHeader() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">剛</div>
          <div className="brand-copy">
            <p className="brand-name">Gōjū-ryū Dictionary</p>
            <p className="brand-kicker">A visual field guide for the dōjō</p>
          </div>
        </div>
        <AppNav />
      </div>
    </header>
  );
}

export function StorageBanner({ warning }: { warning: string }) {
  if (!warning) return null;
  return (
    <div className="storage-banner" role="status" data-testid="status-storage-warning">
      <AlertTriangle size={16} aria-hidden="true" />
      <p>{warning}</p>
    </div>
  );
}
