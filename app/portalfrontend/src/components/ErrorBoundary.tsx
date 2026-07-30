import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { COMPANY } from '@/lib/companyInfo';

/**
 * Catches render-time errors anywhere below it and shows a recoverable screen.
 *
 * WITHOUT THIS, an uncaught error in any component unmounts the whole React tree and the visitor
 * gets a blank white page with no explanation and no way forward — on a lending site, that reads
 * as "this company is broken" or, worse, "this site is fake". A borrower mid-application deserves
 * a real message and a way out.
 *
 * Must be a class component: React has no hook equivalent of componentDidCatch.
 *
 * NOTE: this catches render/lifecycle errors only — not errors inside event handlers or async
 * code (those are handled locally by the pages' own try/catch and Alert components).
 */
interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Logged to the console for now. When error tracking is added (strategy doc §5, Phase 0),
    // report it here instead.
    console.error('Unhandled UI error:', error, errorInfo.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-lg font-bold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Sorry — an unexpected error occurred on this page. Your account and any submitted
            application are not affected.
          </p>

          <button
            onClick={this.handleReload}
            className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Reload the page
          </button>

          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            If this keeps happening, contact us at {COMPANY.contact.landline} or{' '}
            <a href={`mailto:${COMPANY.contact.dpoEmail}`} className="underline hover:text-foreground">
              {COMPANY.contact.dpoEmail}
            </a>
            .
          </p>
        </div>
      </div>
    );
  }
}
