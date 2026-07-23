import { MoreHorizontal } from 'lucide-react';
import { useEffect, useRef } from 'react';

type BuilderDraftRowMenuProps = {
  draftId: string;
  isOpen: boolean;
  onToggle: (draftId: string) => void;
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export default function BuilderDraftRowMenu({
  draftId,
  isOpen,
  onToggle,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: BuilderDraftRowMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onToggle(draftId);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [draftId, isOpen, onToggle]);

  return (
    <div ref={menuRef} className="relative flex justify-end">
      <button
        type="button"
        aria-label="Draft actions"
        aria-expanded={isOpen}
        onClick={(event) => {
          event.stopPropagation();
          onToggle(draftId);
        }}
        className="rb-draft-row__menu-btn"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>

      {isOpen ? (
        <div role="menu" className="rb-draft-row__menu" onClick={(event) => event.stopPropagation()}>
          <button type="button" role="menuitem" className="rb-draft-row__menu-item" onClick={onOpen}>
            Open
          </button>
          <button type="button" role="menuitem" className="rb-draft-row__menu-item" onClick={onRename}>
            Rename
          </button>
          <button type="button" role="menuitem" className="rb-draft-row__menu-item" onClick={onDuplicate}>
            Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            className="rb-draft-row__menu-item rb-draft-row__menu-item--danger"
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}
