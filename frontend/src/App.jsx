import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { Toaster } from 'react-hot-toast';
import AppShell from 'shared/layout/AppShell';
import ErrorBoundary from 'shared/components/ErrorBoundary';
import Home from "shared/pages/Home";
import ContactPage from "features/landing/ContactPage";
import PricingPage from "features/landing/PricingPage";
import SignIn from "features/auth/pages/SignIn";
import SignUp from "features/auth/pages/SignUp";
import Dashboard from 'features/dashboard/pages/Dashboard';
import VaultLayout from 'features/vault/layout/VaultLayout';
import VaultHubPage from 'features/vault/pages/VaultHubPage';
import VaultComparePage from 'features/vault/pages/VaultComparePage';
import VaultCompareResultPage from 'features/vault/pages/VaultCompareResultPage';
import VaultLibraryPage from 'features/vault/pages/VaultLibraryPage';
import VaultVersionsPage from 'features/vault/pages/VaultVersionsPage';
import VaultVersionDetailPage from 'features/vault/pages/VaultVersionDetailPage';
import Profile from 'features/dashboard/pages/Profile';
import HistoryPage from 'features/dashboard/pages/HistoryPage';
import AnalyticsPage from 'features/dashboard/pages/AnalyticsPage';
import ModesPage from 'features/modes/pages/ModesPage';
import RoleTargetedPage from 'features/modes/role-targeted/pages/RoleTargetedPage';
import PressureModePage from 'features/modes/pressure-mode/pages/PressureModePage';
import ResumeDeepDivePage from 'features/modes/resume-deep-dive/pages/ResumeDeepDivePage';
import BlindModePage from 'features/modes/blind-mode/pages/BlindModePage';
import PairProgrammingPage from 'features/modes/pair-programming/pages/PairProgrammingPage';
import SignalIntelligencePage from 'features/signal/pages/SignalIntelligencePage';
import PrivateRoute from 'shared/components/PrivateRoute';
import GuestRoute from 'shared/components/GuestRoute';
import NotFound from 'shared/pages/NotFound';
import { useBackendHealth } from 'shared/context/BackendHealthContext';

const InterviewRoom = lazy(() => import('features/interview/pages/InterviewRoom'));
const InterviewRoomLiveKit = lazy(() => import('features/interview/pages/InterviewRoomLiveKit'));

function useInterviewTransport() {
  const [searchParams] = useSearchParams();
  const { livekitAvailable, healthLoading } = useBackendHealth();
  const envForce = import.meta.env.VITE_USE_LIVEKIT;
  if (envForce === 'true') return true;
  if (envForce === 'false') return false;
  if (searchParams.get('transport') === 'ws') return false;
  try {
    if (typeof window !== 'undefined' && sessionStorage.getItem('force_ws')) return false;
  } catch (_) {}
  return !healthLoading && livekitAvailable;
}

function InterviewRoomFallback() {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin h-10 w-10 rounded-full border-2 border-[var(--teal-1)] border-t-transparent" />
        <p className="text-sm text-[var(--cream-3)]">Loading interview...</p>
      </div>
    </div>
  );
}

function InterviewRoute() {
  const useLiveKit = useInterviewTransport();
  return useLiveKit ? <InterviewRoomLiveKit /> : <InterviewRoom />;
}

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
          <Route path="/" element={<Home />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route
            path="/docs"
            element={<Navigate to={{ pathname: '/', hash: '#assessment' }} replace />}
          />
          <Route
            path="/privacy"
            element={<Navigate to={{ pathname: '/', hash: '#privacy' }} replace />}
          />
          <Route
            path="/terminal"
            element={<Navigate to={{ pathname: '/', hash: '#system-status' }} replace />}
          />
          <Route
            path="/signin"
            element={
              <GuestRoute>
                <SignIn />
              </GuestRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <GuestRoute>
                <SignUp />
              </GuestRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <AppShell>
                  <Dashboard />
                </AppShell>
              </PrivateRoute>
            }
          />
          <Route
            path="/resume-vault"
            element={
              <PrivateRoute>
                <AppShell>
                  <VaultLayout />
                </AppShell>
              </PrivateRoute>
            }
          >
            <Route index element={<VaultHubPage />} />
            <Route path="compare" element={<VaultComparePage />} />
            <Route path="compare/result" element={<VaultCompareResultPage />} />
            <Route path="library" element={<VaultLibraryPage />} />
            <Route path="r/:resumeId" element={<VaultVersionsPage />} />
            <Route path="r/:resumeId/:versionId" element={<VaultVersionDetailPage />} />
          </Route>
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <AppShell>
                  <Profile />
                </AppShell>
              </PrivateRoute>
            }
          />
          <Route
            path="/history"
            element={
              <PrivateRoute>
                <AppShell>
                  <HistoryPage />
                </AppShell>
              </PrivateRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <PrivateRoute>
                <AppShell>
                  <AnalyticsPage />
                </AppShell>
              </PrivateRoute>
            }
          />
          <Route
            path="/signal-intelligence"
            element={
              <PrivateRoute>
                <AppShell>
                  <SignalIntelligencePage />
                </AppShell>
              </PrivateRoute>
            }
          />
          <Route
            path="/ai-interview"
            element={
              <PrivateRoute>
                <AppShell>
                  <ModesPage />
                </AppShell>
              </PrivateRoute>
            }
          />
          <Route
            path="/ai-interview/role-targeted"
            element={
              <PrivateRoute>
                <AppShell>
                  <RoleTargetedPage />
                </AppShell>
              </PrivateRoute>
            }
          />
          <Route path="/role-targeted" element={<Navigate to="/ai-interview/role-targeted" replace />} />
          <Route
            path="/ai-interview/pressure-mode"
            element={
              <PrivateRoute>
                <AppShell>
                  <PressureModePage />
                </AppShell>
              </PrivateRoute>
            }
          />
          <Route
            path="/ai-interview/resume-deep-dive"
            element={
              <PrivateRoute>
                <AppShell>
                  <ResumeDeepDivePage />
                </AppShell>
              </PrivateRoute>
            }
          />
          <Route
            path="/ai-interview/blind-mode"
            element={
              <PrivateRoute>
                <AppShell>
                  <BlindModePage />
                </AppShell>
              </PrivateRoute>
            }
          />
          <Route
            path="/ai-interview/pair-programming"
            element={
              <PrivateRoute>
                <AppShell>
                  <PairProgrammingPage />
                </AppShell>
              </PrivateRoute>
            }
          />
          <Route path="/modes" element={<Navigate to="/ai-interview" replace />} />
          <Route path="/modes/role-targeted" element={<Navigate to="/ai-interview/role-targeted" replace />} />
          <Route path="/modes/pressure-mode" element={<Navigate to="/ai-interview/pressure-mode" replace />} />
          <Route path="/modes/resume-deep-dive" element={<Navigate to="/ai-interview/resume-deep-dive" replace />} />
          <Route path="/modes/blind-mode" element={<Navigate to="/ai-interview/blind-mode" replace />} />
          <Route path="/modes/pair-programming" element={<Navigate to="/ai-interview/pair-programming" replace />} />
          <Route
            path="/interview/:sessionId"
            element={
              <PrivateRoute>
                <Suspense fallback={<InterviewRoomFallback />}>
                  <InterviewRoute />
                </Suspense>
              </PrivateRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </ErrorBoundary>
      </div>
    </>
  );
}

export default App;
