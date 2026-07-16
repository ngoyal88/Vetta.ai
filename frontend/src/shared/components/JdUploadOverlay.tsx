import { Loader2 } from 'lucide-react';

type JdUploadOverlayProps = {
  uploading: boolean;
};

export function JdUploadOverlay({ uploading }: JdUploadOverlayProps) {
  if (!uploading) return null;

  return (
    <div
      className="jd-upload-overlay absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 rounded-[inherit] bg-[color-mix(in_srgb,var(--color-surface-container-low)_90%,transparent)] backdrop-blur-[1px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-6 w-6 animate-spin text-[var(--color-primary)]" aria-hidden />
      <p className="type-label-sm text-[var(--color-on-surface)]">Reading job description…</p>
      <p className="type-label-sm text-[var(--color-on-surface-variant)]">Extracting text from file</p>
    </div>
  );
}
