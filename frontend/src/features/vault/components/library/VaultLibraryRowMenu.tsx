import React, { useEffect, useRef } from 'react';
import { MoreHorizontal } from 'lucide-react';

import { VAULT_LIBRARY_COPY } from 'features/vault/constants/libraryContent';

type VaultLibraryRowMenuProps = {
  resumeId: string;
  isActive: boolean;
  isOpen: boolean;
  pendingAction: string | null;
  onToggle: (resumeId: string) => void;
  onOpen: (resumeId: string) => void;
  onSetActive: (resumeId: string) => void;
  onDelete: (resumeId: string) => void;
};

export default function VaultLibraryRowMenu({
  resumeId,
  isActive,
  isOpen,
  pendingAction,
  onToggle,
  onOpen,
  onSetActive,
  onDelete,
}: VaultLibraryRowMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const isPending = pendingAction === `active-${resumeId}` || pendingAction === `delete-${resumeId}`;
  const copy = VAULT_LIBRARY_COPY.rowMenu;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onToggle(resumeId);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen, onToggle, resumeId]);

  return (
    <div ref={menuRef} className="relative flex justify-end">
      <button
        type="button"
        aria-label="Resume actions"
        aria-expanded={isOpen}
        disabled={isPending}
        onClick={(event) => {
          event.stopPropagation();
          onToggle(resumeId);
        }}
        className="vault-library-row__menu-btn"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="vault-library-row__menu"
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" role="menuitem" className="vault-library-row__menu-item" onClick={() => onOpen(resumeId)}>
            {copy.open}
          </button>
          {!isActive ? (
            <button
              type="button"
              role="menuitem"
              className="vault-library-row__menu-item"
              onClick={() => void onSetActive(resumeId)}
            >
              {copy.setActive}
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="vault-library-row__menu-item vault-library-row__menu-item--danger"
            onClick={() => void onDelete(resumeId)}
          >
            {copy.delete}
          </button>
        </div>
      ) : null}
    </div>
  );
}
