import { Suspense, lazy } from 'react';
import { Outlet, Route, useSearchParams } from 'react-router-dom';

import VaultLayout from 'features/vault/layout/VaultLayout';
import AppShell from 'shared/layout/AppShell';
import ErrorBoundary from 'shared/components/ErrorBoundary';
import PageLoadingState from 'shared/components/PageLoadingState';
import PrivateRoute from 'shared/components/PrivateRoute';
import { useBackendHealth } from 'shared/context/BackendHealthContext';

const Dashboard = lazy(() => import('features/dashboard/pages/Dashboard'));
const SettingsPage = lazy(() => import('features/dashboard/pages/SettingsPage'));
const AnalyticsPage = lazy(() => import('features/dashboard/pages/AnalyticsPage'));
const HistoryPage = lazy(() => import('features/dashboard/pages/HistoryPage'));
const ApplicationFitPage = lazy(() => import('features/application-fit/pages/ApplicationFitPage'));
const ApplicationFitHistoryPage = lazy(() => import('features/application-fit/pages/ApplicationFitHistoryPage'));
const SignalIntelligencePage = lazy(() => import('features/signal/pages/SignalIntelligencePage'));
const AiInterviewPage = lazy(() => import('features/modes/pages/AiInterviewPage'));
const RoleTargetedPage = lazy(() => import('features/modes/role-targeted/pages/RoleTargetedPage'));
const PressureModePage = lazy(() => import('features/modes/pressure-mode/pages/PressureModePage'));
const ResumeDeepDivePage = lazy(() => import('features/modes/resume-deep-dive/pages/ResumeDeepDivePage'));
const BlindModePage = lazy(() => import('features/modes/blind-mode/pages/BlindModePage'));
const PairProgrammingPage = lazy(() => import('features/modes/pair-programming/pages/PairProgrammingPage'));
const VaultHubPage = lazy(() => import('features/vault/pages/VaultHubPage'));
const VaultComparePage = lazy(() => import('features/vault/pages/VaultComparePage'));
const VaultCompareResultPage = lazy(() => import('features/vault/pages/VaultCompareResultPage'));
const VaultLibraryPage = lazy(() => import('features/vault/pages/VaultLibraryPage'));
const VaultVersionsPage = lazy(() => import('features/vault/pages/VaultVersionsPage'));
const VaultVersionDetailPage = lazy(() => import('features/vault/pages/VaultVersionDetailPage'));
const ResumeBuilderPage = lazy(() => import('features/resume-builder/pages/ResumeBuilderPage'));

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
  } catch {
    /* ignore */
  }
  return !healthLoading && livekitAvailable;
}

function RouteFallback() {
  return <PageLoadingState variant="shell" minHeightClassName="min-h-[40vh]" />;
}

function InterviewRoomFallback() {
  return <PageLoadingState variant="fullscreen" label="Loading interview…" fullScreen />;
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function InterviewRoute() {
  const useLiveKit = useInterviewTransport();
  return useLiveKit ? <InterviewRoomLiveKit /> : <InterviewRoom />;
}

function PrivateAppShell() {
  return (
    <PrivateRoute>
      <AppShell>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </AppShell>
    </PrivateRoute>
  );
}

const resumeBuilderEnabled = import.meta.env.VITE_RESUME_BUILDER_ENABLED === 'true';

export const appRoutes = (
  <>
    <Route element={<PrivateAppShell />}>
      <Route path="/dashboard" element={<LazyPage><Dashboard /></LazyPage>} />
      <Route path="/resume-vault" element={<VaultLayout />}>
        <Route index element={<LazyPage><VaultHubPage /></LazyPage>} />
        <Route path="compare" element={<LazyPage><VaultComparePage /></LazyPage>} />
        <Route path="compare/result" element={<LazyPage><VaultCompareResultPage /></LazyPage>} />
        <Route path="library" element={<LazyPage><VaultLibraryPage /></LazyPage>} />
        {resumeBuilderEnabled ? (
          <>
            <Route path="builder" element={<LazyPage><ResumeBuilderPage /></LazyPage>} />
            <Route path="builder/:draftId" element={<LazyPage><ResumeBuilderPage /></LazyPage>} />
          </>
        ) : null}
        <Route path="r/:resumeId" element={<LazyPage><VaultVersionsPage /></LazyPage>} />
        <Route path="r/:resumeId/:versionId" element={<LazyPage><VaultVersionDetailPage /></LazyPage>} />
      </Route>
      <Route path="/profile" element={<LazyPage><SettingsPage /></LazyPage>} />
      <Route path="/application-fit" element={<LazyPage><ApplicationFitPage /></LazyPage>} />
      <Route path="/application-fit/history" element={<LazyPage><ApplicationFitHistoryPage /></LazyPage>} />
      <Route path="/signal-intelligence" element={<LazyPage><SignalIntelligencePage /></LazyPage>} />
      <Route path="/ai-interview/analytics" element={<LazyPage><AnalyticsPage /></LazyPage>} />
      <Route path="/ai-interview/history" element={<LazyPage><HistoryPage /></LazyPage>} />
      <Route path="/ai-interview" element={<LazyPage><AiInterviewPage /></LazyPage>} />
      <Route path="/ai-interview/role-targeted" element={<LazyPage><RoleTargetedPage /></LazyPage>} />
      <Route path="/ai-interview/pressure-mode" element={<LazyPage><PressureModePage /></LazyPage>} />
      <Route path="/ai-interview/resume-deep-dive" element={<LazyPage><ResumeDeepDivePage /></LazyPage>} />
      <Route path="/ai-interview/blind-mode" element={<LazyPage><BlindModePage /></LazyPage>} />
      <Route path="/ai-interview/pair-programming" element={<LazyPage><PairProgrammingPage /></LazyPage>} />
    </Route>
    <Route
      path="/interview/:sessionId"
      element={
        <PrivateRoute>
          <ErrorBoundary>
            <Suspense fallback={<InterviewRoomFallback />}>
              <InterviewRoute />
            </Suspense>
          </ErrorBoundary>
        </PrivateRoute>
      }
    />
  </>
);
