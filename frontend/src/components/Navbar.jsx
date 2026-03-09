import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  if (location.pathname === '/' || location.pathname.includes('/interview')) {
    return null;
  }

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 h-12 bg-base/90 backdrop-blur-xl border-b border-[var(--border-subtle)]">
        <div className="max-w-7xl mx-auto h-full px-6 flex justify-between items-center">
          <Link to="/" className="flex items-center text-white hover:text-cyan-400 transition-colors duration-150">
            <img src="/vettalogo-removebg-preview.png" alt="Vetta.ai" className="h-8 w-auto" />
          </Link>
          <div className="hidden md:flex gap-4 items-center">
            {!currentUser ? (
              <>
                <Link to="/signin" className="text-sm text-zinc-400 hover:text-white transition-colors">Sign In</Link>
                <Link to="/signup">
                  <button className="btn-cyan h-10 text-sm px-4">Sign Up</button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/dashboard" className="text-sm text-zinc-400 hover:text-white transition-colors">Dashboard</Link>
                <button onClick={logout} className="text-sm text-zinc-400 hover:text-red-400 transition-colors">Logout</button>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="md:hidden p-2 text-white rounded"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden" aria-hidden>
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute top-12 right-0 w-56 bg-raised border-l border-b border-[var(--border-subtle)] rounded-bl-lg shadow-xl py-4 px-4">
            {!currentUser ? (
              <>
                <Link to="/signin" className="block py-2 text-sm text-zinc-400 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
                <Link to="/signup" className="block py-2" onClick={() => setMobileMenuOpen(false)}>
                  <button className="btn-cyan w-full h-10 text-sm">Sign Up</button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/dashboard" className="block py-2 text-sm text-zinc-400 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
                <button onClick={() => { setMobileMenuOpen(false); logout(); }} className="block w-full text-left py-2 text-sm text-zinc-400 hover:text-red-400">Logout</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
