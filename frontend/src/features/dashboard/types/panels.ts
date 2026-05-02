import type { User } from "firebase/auth";
import type { InterviewHistoryItem } from "shared/services/api";

export type InterviewTypeOption = {
  value: string;
  label: string;
};

export type StartPanelProps = {
  currentUser: User | null;
  interviewTypes: InterviewTypeOption[];
  interviewType: string;
  setInterviewType: (value: string) => void;
  customRole: string;
  setCustomRole: (value: string) => void;
  difficulty: string;
  setDifficulty: (value: string) => void;
  yearsExperience: string;
  setYearsExperience: (value: string) => void;
  handleStartInterview: () => void;
};

export type HistoryPanelProps = {
  loadingInterviews: boolean;
  previousInterviews: InterviewHistoryItem[];
  expandedInterviewId: string | null;
  deletingInterviewId: string | null;
  fetchHistory: () => void | Promise<void>;
  handleToggleDetails: (id: string) => void;
  handleDeleteInterview: (id: string) => void | Promise<void>;
  formatDate: (value?: string | null) => string;
  setActiveTab: (tab: string) => void;
};

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
