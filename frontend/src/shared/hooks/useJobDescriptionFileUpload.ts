import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import toast from 'react-hot-toast';

import { loadJobDescriptionFromFile } from 'shared/utils/jdInputUtils';

type UseJobDescriptionFileUploadOptions = {
  maxChars?: number;
  onTextLoaded: (text: string) => void;
};

export function useJobDescriptionFileUpload({
  maxChars = 8000,
  onTextLoaded,
}: UseJobDescriptionFileUploadOptions) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [jdUploading, setJdUploading] = useState(false);

  const handleUploadClick = useCallback(() => {
    if (jdUploading) return;
    fileInputRef.current?.click();
  }, [jdUploading]);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setJdUploading(true);
      try {
        const text = await loadJobDescriptionFromFile(file, maxChars);
        onTextLoaded(text);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not read that file');
      } finally {
        setJdUploading(false);
        event.target.value = '';
      }
    },
    [maxChars, onTextLoaded],
  );

  return {
    fileInputRef,
    jdUploading,
    handleUploadClick,
    handleFileChange,
  };
}
