import React, { Suspense, lazy } from 'react';
import { Routes, Route } from "react-router-dom";
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
import Home from "./pages/Home";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Dashboard from './pages/Dashboard';
import PrivateRoute from './components/PrivateRoute';

const InterviewRoom = lazy(() => import('./pages/InterviewRoom'));

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
                  <InterviewRoom />
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