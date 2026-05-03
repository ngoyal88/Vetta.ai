import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { User } from "firebase/auth";
import { ChevronDown } from "lucide-react";

function initialsFromUser(user: User): string {
  const name = user.displayName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  const local = user.email?.split("@")[0] ?? "?";
  return local.slice(0, 2).toUpperCase();
}

export type UserAccountMenuProps = {
  user: User;
  onLogout: () => void | Promise<void>;
  onNavigate?: () => void;
};

const UserAccountMenu = ({ user, onLogout, onNavigate }: UserAccountMenuProps) => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    setPhotoFailed(false);
  }, [user.photoURL, user.uid]);

  const photo = user.photoURL && !photoFailed ? user.photoURL : null;
  const initials = initialsFromUser(user);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={`${menuId}-trigger`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${menuId}-menu`}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-1 rounded border border-transparent p-0 transition-[border-color,background-color] duration-[120ms] ease-out hover:border-[var(--border)] hover:bg-[var(--bg-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal-2)]"
      >
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--bg-2)] font-mono text-xs font-medium text-[var(--cream-0)]">
          {photo ? (
            <img
              src={photo}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            initials
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--cream-2)] transition-transform duration-[120ms] ease-out motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={`${menuId}-menu`}
          role="menu"
          aria-labelledby={`${menuId}-trigger`}
          className="absolute right-0 top-full z-[70] mt-2 min-w-[12rem] rounded border border-[var(--border)] bg-[var(--bg-1)] py-1"
        >
          <Link
            role="menuitem"
            to="/profile"
            className="block px-3 py-2 text-sm font-medium text-[var(--cream-0)] transition-colors duration-[120ms] ease-out hover:bg-[var(--bg-2)]"
            onClick={() => {
              close();
              onNavigate?.();
            }}
          >
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm font-medium text-[var(--cream-2)] transition-colors duration-[120ms] ease-out hover:bg-[var(--bg-2)] hover:text-[var(--red-1)]"
            onClick={() => {
              close();
              onNavigate?.();
              void onLogout();
            }}
          >
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default UserAccountMenu;
