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

  const desktopLinks = (
    <div className="hidden md:flex gap-6 items-center">
      {!currentUser ? (
        <>
          <Link to="/signin">
            <button className="text-white hover:text-cyan-400 font-medium transition focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black rounded">
              Sign In
            </button>
          </Link>
          <Link to="/signup">
            <button className="btn-cyan focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black rounded">
              Sign Up
            </button>
          </Link>
        </>
      ) : (
        <>
          <Link to="/dashboard">
            <button className="text-white hover:text-cyan-400 font-medium transition focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black rounded">
              Dashboard
            </button>
          </Link>
          <button
            onClick={logout}
            className="text-white hover:text-red-400 font-medium transition focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-black rounded"
          >
            Logout
          </button>
        </>
      )}
    </div>
  );

  const mobileMenuButton = (
    <button
      type="button"
      onClick={() => setMobileMenuOpen((o) => !o)}
      className="md:hidden p-2 text-white hover:text-cyan-400 rounded focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black"
      aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
    >
      {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
    </button>
  );

  const slideOutPanel = (
    <div
      className={`fixed top-0 right-0 z-40 h-full w-64 max-w-[85vw] bg-gray-900/98 backdrop-blur-lg border-l border-cyan-600/20 shadow-xl md:hidden transition-transform duration-200 ease-out ${
        mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
      aria-hidden={!mobileMenuOpen}
    >
      <div className="flex flex-col gap-4 pt-20 px-6">
        {!currentUser ? (
          <>
            <Link to="/signin">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="block w-full text-left py-3 text-white hover:text-cyan-400 font-medium transition focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black rounded"
              >
                Sign In
              </button>
            </Link>
            <Link to="/signup">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="block w-full text-left py-3 btn-cyan rounded focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black"
              >
                Sign Up
              </button>
            </Link>
          </>
        ) : (
          <>
            <Link to="/dashboard">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="block w-full text-left py-3 text-white hover:text-cyan-400 font-medium transition focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black rounded"
              >
                Dashboard
              </button>
            </Link>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                logout();
              }}
              className="block w-full text-left py-3 text-white hover:text-red-400 font-medium transition focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-black rounded"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-lg border-b border-cyan-600/20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-3 text-white hover:text-cyan-400 transition">
            <img
              src="/vettalogo-removebg-preview.png"
              alt="Vetta.ai logo"
              className="h-8 w-auto"
            />
          </Link>
          {desktopLinks}
          {mobileMenuButton}
        </div>
      </nav>
      {slideOutPanel}
      {mobileMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </>
  );
};

export default Navbar;