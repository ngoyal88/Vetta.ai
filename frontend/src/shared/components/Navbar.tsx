import React, { useState, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "shared/context/AuthContext";
import UserAccountMenu from "shared/components/UserAccountMenu";

/* Sidebar-style nav items — frontend.md §5 */
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded px-2 py-2 text-sm font-medium transition-[color,background-color] duration-[120ms] ease-out",
    isActive
      ? "bg-[var(--bg-2)] text-[var(--cream-0)]"
      : "text-[var(--cream-3)] hover:bg-[var(--bg-2)] hover:text-[var(--cream-1)]",
  ].join(" ");

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  if (location.pathname === "/" || location.pathname.includes("/interview")) {
    return null;
  }

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-[100] min-h-14 border-b border-[var(--border)] bg-[var(--bg-0)]/92 backdrop-blur-xl"
        aria-label="Main"
      >
        <div className="mx-auto flex h-14 min-h-14 max-w-7xl items-center gap-4 px-4 md:px-6">
          <Link
            to="/"
            className="flex shrink-0 items-center transition-colors duration-[120ms] ease-out text-[var(--cream-0)] hover:text-[var(--cream-2)]"
          >
            <img
              src="/vettalogo-removebg-preview.png"
              alt="Vetta.ai"
              className="h-8 w-auto"
            />
          </Link>

          <div className="hidden min-w-0 flex-1 items-center justify-center gap-3 md:flex lg:gap-4">
            {currentUser ? (
              <>
                <NavLink to="/dashboard" className={navLinkClass} end>
                  Dashboard
                </NavLink>
                <NavLink to="/modes" className={navLinkClass}>
                  Modes
                </NavLink>
                <NavLink to="/resume-vault" className={navLinkClass}>
                  Resume Vault
                </NavLink>
                <NavLink to="/analytics" className={navLinkClass}>
                  Analytics
                </NavLink>
              </>
            ) : null}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-3">
            {currentUser ? <UserAccountMenu user={currentUser} onLogout={logout} /> : null}
            <div className="hidden items-center gap-2 md:flex md:gap-3">
              {!currentUser ? (
                <>
                  <NavLink
                    to="/signin"
                    className={({ isActive }) =>
                      [
                        "text-sm font-medium transition-[color] duration-[120ms] ease-out",
                        isActive
                          ? "text-[var(--cream-0)]"
                          : "text-[var(--cream-3)] hover:text-[var(--cream-1)]",
                      ].join(" ")
                    }
                  >
                    Sign In
                  </NavLink>
                  <Link
                    to="/signup"
                    className="btn-cyan inline-flex h-9 items-center justify-center px-4 text-sm"
                  >
                    Sign Up
                  </Link>
                </>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="inline-flex h-10 w-10 items-center justify-center rounded text-[var(--cream-0)] transition-[background-color] duration-[120ms] ease-out hover:bg-[var(--bg-2)] md:hidden"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </nav>

      {mobileMenuOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[90] bg-[var(--bg-0)]/60 md:hidden"
            aria-label="Close menu"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            className="fixed right-0 top-14 z-[95] max-h-[min(100dvh,100vh)] w-[min(100%,16rem)] overflow-y-auto rounded-bl-lg border-b border-l border-[var(--border)] bg-[var(--bg-1)] py-3 pl-4 pr-4 md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
          >
            {!currentUser ? (
              <div className="flex flex-col gap-1">
                <NavLink
                  to="/signin"
                  className={navLinkClass}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign In
                </NavLink>
                <Link
                  to="/signup"
                  className="btn-cyan mt-2 inline-flex h-10 w-full items-center justify-center text-sm"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign Up
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <NavLink
                  to="/dashboard"
                  className={navLinkClass}
                  end
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/modes"
                  className={navLinkClass}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Modes
                </NavLink>
                <NavLink
                  to="/resume-vault"
                  className={navLinkClass}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Resume Vault
                </NavLink>
                <NavLink
                  to="/analytics"
                  className={navLinkClass}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Analytics
                </NavLink>
              </div>
            )}
          </div>
        </>
      ) : null}
    </>
  );
};

export default Navbar;
