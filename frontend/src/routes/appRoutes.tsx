import { Suspense, lazy, type ReactNode } from 'react';
import { Route, useSearchParams } from 'react-router-dom';

import AiInterviewPage from 'features/modes/pages/AiInterviewPage';
import BlindModePage from 'features/modes/blind-mode/pages/BlindModePage';
import PairProgrammingPage from 'features/modes/pair-programming/pages/PairProgrammingPage';
import PressureModePage from 'features/modes/pressure-mode/pages/PressureModePage';
import ResumeDeepDivePage from 'features/modes/resume-deep-dive/pages/ResumeDeepDivePage';
import RoleTargetedPage from 'features/modes/role-targeted/pages/RoleTargetedPage';
import AnalyticsPage from 'features/dashboard/pages/AnalyticsPage';
import Dashboard from 'features/dashboard/pages/Dashboard';
import HistoryPage from 'features/dashboard/pages/HistoryPage';
import SettingsPage from 'features/dashboard/pages/SettingsPage';
import SignalIntelligencePage from 'features/signal/pages/SignalIntelligencePage';
import VaultLayout from 'features/vault/layout/VaultLayout';
import VaultComparePage from 'features/vault/pages/VaultComparePage';
import VaultCompareResultPage from 'features/vault/pages/VaultCompareResultPage';
import VaultHubPage from 'features/vault/pages/VaultHubPage';
import VaultLibraryPage from 'features/vault/pages/VaultLibraryPage';
import VaultVersionDetailPage from 'features/vault/pages/VaultVersionDetailPage';
import VaultVersionsPage from 'features/vault/pages/VaultVersionsPage';
import AppShell from 'shared/layout/AppShell';
import PrivateRoute from 'shared/components/PrivateRoute';
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
  } catch {
    /* ignore */
  }
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

function privateShell(children: ReactNode) {
  return (
    <PrivateRoute>
      <AppShell>{children}</AppShell>
    </PrivateRoute>
  );
}

export const appRoutes = (
  <>
    <Route path="/dashboard" element={privateShell(<Dashboard />)} />
    <Route path="/resume-vault" element={privateShell(<VaultLayout />)}>
      <Route index element={<VaultHubPage />} />
      <Route path="compare" element={<VaultComparePage />} />
      <Route path="compare/result" element={<VaultCompareResultPage />} />
      <Route path="library" element={<VaultLibraryPage />} />
      <Route path="r/:resumeId" element={<VaultVersionsPage />} />
      <Route path="r/:resumeId/:versionId" element={<VaultVersionDetailPage />} />
    </Route>
    <Route path="/profile" element={privateShell(<SettingsPage />)} />
    <Route path="/analytics" element={privateShell(<AnalyticsPage />)} />
    <Route path="/signal-intelligence" element={privateShell(<SignalIntelligencePage />)} />
    <Route path="/ai-interview/history" element={privateShell(<HistoryPage />)} />
    <Route path="/ai-interview" element={privateShell(<AiInterviewPage />)} />
    <Route path="/ai-interview/role-targeted" element={privateShell(<RoleTargetedPage />)} />
    <Route path="/ai-interview/pressure-mode" element={privateShell(<PressureModePage />)} />
    <Route path="/ai-interview/resume-deep-dive" element={privateShell(<ResumeDeepDivePage />)} />
    <Route path="/ai-interview/blind-mode" element={privateShell(<BlindModePage />)} />
    <Route path="/ai-interview/pair-programming" element={privateShell(<PairProgrammingPage />)} />
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
  </>
);
