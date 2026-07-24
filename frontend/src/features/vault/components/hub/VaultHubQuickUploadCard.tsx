import { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { CloudUpload } from 'lucide-react';

import { VAULT_HUB_COPY } from 'features/vault/constants/hubContent';
import { getErrorMessage, validateResumeFile } from 'features/vault/utils/vaultUtils';

type VaultHubQuickUploadCardProps = {
  uploading: boolean;
  onUpload: (file: File, name: string) => Promise<void>;
};

function nameFromFile(file: File): string {
  const base = file.name.replace(/\.[^.]+$/, '').trim();
  return base || 'Uploaded resume';
}

export default function VaultHubQuickUploadCard({ uploading, onUpload }: VaultHubQuickUploadCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      const validationError = validateResumeFile(file);
      if (validationError) {
        toast.error(validationError);
        return;
      }

      try {
        await onUpload(file, nameFromFile(file));
      } catch (error) {
        toast.error(getErrorMessage(error, 'Upload failed'));
      }
    },
    [onUpload],
  );

  return (
    <section className="vault-hub-quick-upload glass-panel">
      <div
        className={['vault-hub-quick-upload__dropzone', isDragOver ? 'vault-hub-quick-upload__dropzone--active' : '']
          .filter(Boolean)
          .join(' ')}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragOver(false);
          void handleFile(event.dataTransfer.files?.[0] ?? null);
        }}
      >
        <div className="vault-hub-quick-upload__icon" aria-hidden>
          <CloudUpload className="h-7 w-7" />
        </div>
        <h2 className="vault-hub-quick-upload__title">{VAULT_HUB_COPY.quickUpload.title}</h2>
        <p className="vault-hub-quick-upload__hint">{VAULT_HUB_COPY.quickUpload.hint}</p>
        <button
          type="button"
          className="vault-hub-quick-upload__browse"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? 'Uploading…' : VAULT_HUB_COPY.quickUpload.browse}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="sr-only"
          onChange={(event) => {
            void handleFile(event.target.files?.[0] ?? null);
            event.target.value = '';
          }}
        />
      </div>
    </section>
  );
}
