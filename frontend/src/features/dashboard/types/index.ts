export type DashboardTab = "dashboard" | "resume-vault";

export type DashboardSidebarProps = {
  active: DashboardTab;
};

export type QuickMode = {
  id: string;
  label: string;
};

export type ReplaySignal = "LEAN HIRE" | "FLAGGED" | "NEUTRAL";

export type ReplayItem = {
  session: string;
  signal: ReplaySignal;
  decisiveFactor: string;
};
