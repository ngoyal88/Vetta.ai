export type InterviewDefaults = {
  targetRole?: string;
  yearsExperience?: number;
};

export type UserSettingsDoc = {
  name?: string;
  email?: string;
  photoURL?: string;
  defaults?: InterviewDefaults;
};
