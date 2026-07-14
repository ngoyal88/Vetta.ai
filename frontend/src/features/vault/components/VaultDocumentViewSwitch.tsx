import { Eye, FileText } from 'lucide-react';

import { VAULT_VERSION_DETAIL_COPY } from '../constants/versionDetailContent';

export type VaultDocumentViewMode = 'pdf' | 'parsed';

type VaultDocumentViewSwitchProps = {
  mode: VaultDocumentViewMode;
  onChange: (mode: VaultDocumentViewMode) => void;
  fullWidth?: boolean;
};

export default function VaultDocumentViewSwitch({
  mode,
  onChange,
  fullWidth = false,
}: VaultDocumentViewSwitchProps) {
  const copy = VAULT_VERSION_DETAIL_COPY;

  return (
    <div
      className={['vault-document-view-switch', fullWidth ? 'vault-document-view-switch--full' : ''].join(' ')}
      role="tablist"
      aria-label="Document preview mode"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'pdf'}
        className={[
          'vault-document-view-switch__btn',
          mode === 'pdf' ? 'vault-document-view-switch__btn--active' : '',
        ].join(' ')}
        onClick={() => onChange('pdf')}
      >
        <FileText className="h-4 w-4" aria-hidden />
        {copy.viewOriginalPdf}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'parsed'}
        className={[
          'vault-document-view-switch__btn',
          mode === 'parsed' ? 'vault-document-view-switch__btn--active' : '',
        ].join(' ')}
        onClick={() => onChange('parsed')}
      >
        <Eye className="h-4 w-4" aria-hidden />
        {copy.viewParsedResume}
      </button>
    </div>
  );
}
