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
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-cyan-500 border-t-transparent" />
        <p className="text-gray-400">Loading interview...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <>
      <Toaster
        position="top-center"
        gutter={10}
        toastOptions={{
          duration: 3200,
          style: {
            background: '#0b1324',
            color: '#e5f6ff',
            border: '1px solid rgba(34, 211, 238, 0.28)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.35)'
          },
          success: { iconTheme: { primary: '#22d3ee', secondary: '#0b1324' } },
          error: { iconTheme: { primary: '#f43f5e', secondary: '#0b1324' } }
        }}
        containerStyle={{ marginTop: 68 }}
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