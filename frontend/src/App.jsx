import React, { Suspense, lazy } from 'react';
import { Routes, Route, useSearchParams } from "react-router-dom";
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
import Home from "./pages/Home";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Dashboard from './pages/Dashboard';
import PrivateRoute from './components/PrivateRoute';
import { useBackendHealth } from './context/BackendHealthContext';

const InterviewRoom = lazy(() => import('./pages/InterviewRoom'));
const InterviewRoomLiveKit = lazy(() => import('./pages/InterviewRoomLiveKit'));

function useInterviewTransport() {
  const [searchParams] = useSearchParams();
  const { livekitAvailable, healthLoading } = useBackendHealth();
  const envForce = process.env.REACT_APP_USE_LIVEKIT;
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
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-500 border-t-transparent" />
        <p className="text-zinc-500 text-sm">Loading interview...</p>
      </div>
    </div>
  );
}

function InterviewRoute() {
  const useLiveKit = useInterviewTransport();
  return useLiveKit ? <InterviewRoomLiveKit /> : <InterviewRoom />;
}

function App() {
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

      <Navbar />

      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
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
        </Routes>
      </ErrorBoundary>
    </>
  );
}

export default App;