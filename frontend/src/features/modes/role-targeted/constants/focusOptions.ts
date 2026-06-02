import { Brain, BriefcaseBusiness, Code2, Server } from 'lucide-react';

export const FOCUS_OPTIONS = [
  { value: 'technical', label: 'Technical / Coding', icon: Code2 },
  { value: 'behavioral', label: 'Behavioral (STAR)', icon: Brain },
  { value: 'system_design', label: 'System Design', icon: Server },
  { value: 'domain', label: 'Domain Knowledge', icon: BriefcaseBusiness },
] as const;

export const SECTION_ICON_CLASS =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border';
