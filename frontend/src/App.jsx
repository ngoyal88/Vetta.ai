import React, { useEffect, useRef } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import NotFoundPage from 'features/website/pages/NotFoundPage';
import { appRoutes } from 'routes/appRoutes';
import { authRoutes } from 'routes/authRoutes';
import { legacyRedirects } from 'routes/legacyRedirects';
import { websiteRoutes } from 'routes/websiteRoutes';
import ErrorBoundary from 'shared/components/ErrorBoundary';

function App() {
  const scrollRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (location.hash) {
      const target = document.querySelector(location.hash);
      if (target) {
        target.scrollIntoView({ behavior: 'auto', block: 'start' });
        return;
      }
    }

    container.scrollTo({ top: 0, left: 0, behavior: 'auto' });

  }, [location.pathname, location.hash]);

  return (
    <>
      <Toaster
        position="top-center"
        gutter={8}
        limit={1}
        toastOptions={{
          duration: 3200,
          style: {
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
          },
          success: { iconTheme: { primary: 'var(--success)', secondary: 'var(--bg-surface)' } },
          error: { iconTheme: { primary: 'var(--error)', secondary: 'var(--bg-surface)' } },
        }}
        containerStyle={{ marginTop: 56 }}
      />

      <div className="app-scroll" ref={scrollRef}>
        <ErrorBoundary>
          <Routes>
            {websiteRoutes}
            {authRoutes}
            {appRoutes}
            {legacyRedirects}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </div>
    </>
  );
}

export default App;

