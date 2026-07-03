import React from 'react';
import { Link } from 'react-router-dom';
import * as Sentry from '@sentry/react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    Sentry.captureException(error, { extra: { componentStack: errorInfo?.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      const fallback = this.props.fallback;
      if (fallback) return fallback;

      return (
        <div className="min-h-screen bg-[var(--bg-0)] flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Something went wrong</h1>
            <p className="text-[var(--cream-3)] mb-6">
              We encountered an unexpected error. Please try again or go back home.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link
                to="/"
                className="px-6 py-3 bg-[var(--teal-1)] text-[var(--bg-0)] font-medium rounded-lg hover:opacity-90 transition"
              >
                Go home
              </Link>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-6 py-3 border border-[var(--border-subtle)] text-[var(--teal-1)] rounded-lg hover:bg-[var(--bg-surface)] transition"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
