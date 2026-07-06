import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type TemplatePreviewModalProps = {
  open: boolean;
  templateName: string;
  previewUrl: string | null;
  onClose: () => void;
};

export default function TemplatePreviewModal({
  open,
  templateName,
  previewUrl,
  onClose,
}: TemplatePreviewModalProps) {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || !previewUrl) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${templateName} template preview`}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center text-white/90 transition-colors hover:text-white"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>

      <img
        src={previewUrl}
        alt={`${templateName} template`}
        className="max-h-[90vh] max-w-[min(640px,calc(100vw-3rem))] object-contain"
        onClick={(event) => event.stopPropagation()}
      />
    </div>,
    document.body,
  );
}
