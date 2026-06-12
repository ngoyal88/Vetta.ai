export type VaultUploadMode = 'new' | 'version';

export type VaultUploadPayload = {
  mode: VaultUploadMode;
  file: File;
  name: string;
  tags: string;
  resumeId?: string;
  userNote?: string;
};
