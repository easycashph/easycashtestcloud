import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Without this, an uncaught render error anywhere in the tree unmounts everything React manages —
 * including `RoleProvider` — dropping the user back to a blank/login-looking screen. That reads as
 * "I got logged out" even though the session itself (access token, refresh cookie) was never
 * touched; the real cause was a render crash, not `apiClient.ts`'s `onSessionExpired` path. This
 * boundary contains the crash to an error screen instead, so a bad page never masquerades as an
 * auth problem.
 */
export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm font-medium">Something went wrong loading this page.</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            You&apos;re still signed in — this isn&apos;t a session problem. Try again, and report it if it keeps happening.
          </p>
          <Button size="sm" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
