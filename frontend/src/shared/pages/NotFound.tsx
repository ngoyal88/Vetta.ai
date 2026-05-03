import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "shared/context/AuthContext";
import { Home, LayoutDashboard } from "lucide-react";

const NotFound: React.FC = () => {
  const { currentUser } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-base px-6 py-16 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--teal-1)]">Error 404</p>
      <h1 className="mt-2 text-2xl font-medium tracking-tight text-[var(--cream-0)]">Page not found</h1>
      <p className="mt-3 max-w-md text-sm text-[var(--cream-2)]">
        This path does not exist. Check the URL or return to a known page.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          className="btn-ghost inline-flex h-9 items-center gap-2 px-4 text-sm"
        >
          <Home className="h-4 w-4" aria-hidden />
          Home
        </Link>
        {currentUser ? (
          <Link
            to="/dashboard"
            className="btn-cyan inline-flex h-9 items-center gap-2 px-4 text-sm"
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden />
            Dashboard
          </Link>
        ) : (
          <Link
            to="/signin"
            className="btn-cyan inline-flex h-9 items-center gap-2 px-4 text-sm"
          >
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
};

export default NotFound;
