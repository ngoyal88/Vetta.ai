import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';
import { Link } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { Home, RefreshCw, TriangleAlert } from 'lucide-react';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  handleReload(): void {
    window.location.reload();
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const { fallback } = this.props;
      if (fallback) return fallback;

      const showDetails = import.meta.env.DEV && this.state.error instanceof Error;

      return (
        <div className="min-h-screen bg-[var(--bg-0)] px-4 py-10 text-[var(--color-on-surface)]">
          <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center justify-center">
            <div className="glass-panel w-full rounded-2xl border border-[var(--border-subtle)] p-8 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-on-surface)_4%,transparent),0_24px_80px_rgba(2,6,23,0.45)] md:p-10">
              <div className="mx-auto max-w-xl text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-error)]/25 bg-[var(--color-error-container)]/35 text-[var(--color-error)]">
                  <TriangleAlert className="h-7 w-7" aria-hidden="true" />
                </div>

                <p className="type-label-sm mb-3 uppercase tracking-[0.18em] text-[var(--color-on-surface-variant)]">
                  System Fallback
                </p>
                <h1 className="type-headline-lg tracking-tight text-[var(--color-on-surface)]">
                  Something went wrong
                </h1>
                <p className="type-body-md mx-auto mt-3 max-w-lg text-[var(--color-on-surface-variant)]">
                  We hit an unexpected runtime error while rendering this screen. Reload to retry, or return home to
                  continue elsewhere in the app.
                </p>

                {showDetails && this.state.error ? (
                  <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--color-surface-container-low)]/80 p-4 text-left">
                    <p className="type-label-sm uppercase tracking-[0.12em] text-[var(--color-on-surface-variant)]">
                      Debug Details
                    </p>
                    <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words font-mono text-sm text-[var(--color-on-surface)]">
                      {this.state.error.message}
                    </pre>
                  </div>
                ) : null}

                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={this.handleReload}
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-[var(--color-on-primary)] transition-[transform,opacity,box-shadow] duration-150 hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-0)]"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Reload
                  </button>

                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--color-surface-container-low)]/70 px-5 py-3 text-sm font-semibold text-[var(--color-on-surface)] transition-[border-color,background-color,color] duration-150 hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-0)]"
                  >
                    <Home className="h-4 w-4" aria-hidden="true" />
                    Go home
                  </Link>
                </div>

                <p className="type-label-sm mt-6 text-[var(--color-on-surface-variant)]/85">
                  If this keeps happening, the error has already been captured for investigation.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
