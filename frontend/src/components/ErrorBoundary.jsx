import React from 'react';
import { Link } from 'react-router-dom';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const fallback = this.props.fallback;
      if (fallback) return fallback;

      return (
        <div className="min-h-screen bg-black flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-gray-400 mb-6">
              We encountered an unexpected error. Please try again or go back home.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link
                to="/"
                className="px-6 py-3 bg-cyan-600 text-black font-medium rounded-lg hover:bg-cyan-500 transition focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black"
              >
                Go home
              </Link>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-6 py-3 border border-cyan-500/50 text-cyan-400 rounded-lg hover:bg-cyan-500/10 transition focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black"
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
