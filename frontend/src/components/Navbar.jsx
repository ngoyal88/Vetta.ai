import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();

  // Don't show navbar on interview room or home page
  if (location.pathname === '/' || location.pathname.includes('/interview')) {
    return null;
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-lg border-b border-cyan-600/20">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-3 text-white hover:text-cyan-400 transition">
          <img
            src="/vettalogo-removebg-preview.png"
            alt="Vetta.ai logo"
            className="h-8 w-auto"
          />
        </Link>

        <div className="flex gap-6 items-center">
          {!currentUser ? (
            <>
              <Link to="/signin">
                <button className="text-white hover:text-cyan-400 font-medium transition">
                  Sign In
                </button>
              </Link>
              <Link to="/signup">
                <button className="btn-cyan">
                  Sign Up
                </button>
              </Link>
            </>
          ) : (
            <>
              <Link to="/dashboard">
                <button className="text-white hover:text-cyan-400 font-medium transition">
                  Dashboard
                </button>
              </Link>
              <button 
                onClick={logout}
                className="text-white hover:text-red-400 font-medium transition"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;