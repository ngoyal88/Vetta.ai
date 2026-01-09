import React from 'react';
import { Routes, Route } from "react-router-dom";
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from "./pages/Home";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Dashboard from './pages/Dashboard';
import PrivateRoute from './components/PrivateRoute';
import InterviewRoom from './pages/InterviewRoom';

function App() {
  return (
    <AuthProvider>
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
      
      {/* Navbar only shows on certain routes */}
      <Navbar />
      
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
              <InterviewRoom />
            </PrivateRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;