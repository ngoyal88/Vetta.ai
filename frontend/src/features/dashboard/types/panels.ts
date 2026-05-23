import type { User } from "firebase/auth";

export type AccountPanelProps = {
  currentUser: User | null;
  profileName: string;
  setProfileName: (value: string) => void;
  profilePhoto: string;
  setProfilePhoto: (value: string) => void;
  savingProfile: boolean;
  setSavingProfile: (value: boolean) => void;
  sendVerification: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfileInfo: (input: { displayName?: string | null; photoURL?: string | null }) => Promise<void>;
  refreshUser: () => Promise<User | null>;
  deletingAccountState: boolean;
  setDeletingAccountState: (value: boolean) => void;
  api: {
    deleteAccountData: () => Promise<Record<string, unknown>>;
  };
  deleteAccount: () => Promise<void>;
  navigate: (to: string) => void;
};
