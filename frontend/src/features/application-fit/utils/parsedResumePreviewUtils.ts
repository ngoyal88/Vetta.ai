/** Light formatters for parsed resume preview — backend owns cleanup in `resume_postprocess.py`. */

import type { ResumeProfile } from 'features/vault/types';

export type LinkItem = { label: string; href: string; text: string };

export type EducationPreviewRow = {
  degree: string;
  field: string;
  minor: string;
  institution: string;
  dates: string;
  cgpa: string;
  location: string;
};

export type AchievementPreviewRow = { title: string; description: string; date: string };

export type ProjectPreviewRow = {
  name: string;
  description: string;
  link: string;
  role: string;
  scale: string;
  techStack: string[];
};

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  intern: 'Intern',
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  freelance: 'Freelance',
  co_op: 'Co-op',
  temporary: 'Temporary',
  volunteer: 'Volunteer',
  other: 'Other',
};

type ContactLinks = NonNullable<NonNullable<ResumeProfile['contact']>['links']>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isUrlLike(value: string): boolean {
  const text = value.trim().toLowerCase();
  return (
    text.startsWith('http://') ||
    text.startsWith('https://') ||
    text.startsWith('www.') ||
    text.includes('mailto:') ||
    text.includes('.com/')
  );
}

export function getResumeDisplayName(name: ResumeProfile['name']): string {
  if (typeof name === 'string') return name;
  if (name && typeof name === 'object' && typeof name.raw === 'string') return name.raw;
  return 'Resume';
}

export function formatEmploymentTypeLabel(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  return EMPLOYMENT_TYPE_LABELS[value] ?? value.replace(/_/g, ' ');
}

function linkLabelFromUrl(value: string): string {
  const lower = value.toLowerCase();
  if (lower.includes('linkedin.com')) return 'LinkedIn';
  if (lower.includes('github.com')) return 'GitHub';
  if (lower.includes('leetcode.com')) return 'LeetCode';
  if (lower.includes('codeforces.com')) return 'Codeforces';
  if (lower.includes('codechef.com')) return 'CodeChef';
  if (lower.startsWith('mailto:')) return 'Email';
  return 'Link';
}

function formatLinkDisplay(value: string): string {
  if (value.startsWith('mailto:')) return value.replace(/^mailto:/i, '');
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`);
    const host = url.hostname.replace(/^www\./, '');
    const path = url.pathname === '/' ? '' : url.pathname;
    const compact = `${host}${path}`;
    return compact.length > 44 ? `${compact.slice(0, 41)}…` : compact;
  } catch {
    return value.length > 44 ? `${value.slice(0, 41)}…` : value;
  }
}

function toHref(value: string): string {
  if (value.startsWith('mailto:')) return value;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `https://${value}`;
}

export function normalizeLinkItems(links: ContactLinks): LinkItem[] {
  const items: LinkItem[] = [];
  const pushLink = (label: string, raw: unknown) => {
    const value = asString(raw);
    if (!value) return;
    items.push({ label, href: toHref(value), text: formatLinkDisplay(value) });
  };

  pushLink('LinkedIn', links.linkedin);
  pushLink('GitHub', links.github);
  pushLink('Portfolio', links.portfolio);
  for (const item of links.other ?? []) {
    const value = asString(item);
    if (value) pushLink(linkLabelFromUrl(value), value);
  }
  return items;
}

function joinDateRange(start: string, end: string, dates: string): string {
  if (start && end) return `${start} – ${end}`;
  if (dates) return dates.replace(/\s*-\s*/g, ' – ');
  return start || end;
}

export function normalizeEducation(value: unknown): EducationPreviewRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = isRecord(item) ? item : {};
      const dates = joinDateRange(asString(record.start_date), asString(record.end_date), asString(record.dates));
      return {
        degree: asString(record.degree),
        field: asString(record.field),
        minor: asString(record.minor),
        institution: asString(record.institution),
        dates,
        cgpa: asString(record.cgpa),
        location: asString(record.location),
      };
    })
    .filter((row) => row.degree || row.field || row.minor || row.institution || row.dates || row.cgpa || row.location);
}

export function formatEducationDisplay(row: EducationPreviewRow): {
  degree: string;
  major: string;
  minor: string;
  metaLine: string;
} {
  return {
    degree: row.degree,
    major: row.field,
    minor: row.minor,
    metaLine: [row.dates, row.location, row.cgpa].filter(Boolean).join(' · '),
  };
}

export function normalizeProjects(value: unknown): ProjectPreviewRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = isRecord(item) ? item : {};
      const techStack = Array.isArray(record.tech_stack)
        ? record.tech_stack.filter((tech): tech is string => typeof tech === 'string' && tech.trim().length > 0)
        : Array.isArray(record.technologies)
          ? record.technologies.filter((tech): tech is string => typeof tech === 'string' && tech.trim().length > 0)
          : [];
      return {
        name: asString(record.name) || asString(record.title),
        description: asString(record.description) || asString(record.summary),
        link: asString(record.link),
        role: asString(record.role),
        scale: asString(record.scale),
        techStack,
      };
    })
    .filter((item) => item.name || item.description || item.link || item.techStack.length > 0);
}

export function fallbackProjectDescription(name: string, rawText: string | null | undefined): string {
  if (!name || !rawText) return '';
  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const namePattern = new RegExp(escapeRegExp(name.split(' - ')[0].trim()), 'i');
  const startIndex = lines.findIndex((line) => namePattern.test(line));
  if (startIndex < 0) return '';

  const collected: string[] = [];
  for (let index = startIndex + 1; index < lines.length && collected.length < 3; index += 1) {
    const line = lines[index];
    if (/^(education|projects|achievements|technical skills|skills|work experience)$/i.test(line)) break;
    if (line.length < 4) continue;
    if (!line.startsWith('•') && !line.startsWith('-') && collected.length > 0) break;
    collected.push(line.replace(/^[•-]\s*/, '').trim());
  }
  return collected.join(' ');
}

export function normalizeAchievements(value: unknown): AchievementPreviewRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return { title: item.trim(), description: '', date: '' };
      const record = isRecord(item) ? item : {};
      return {
        title: asString(record.title) || asString(record.name),
        description: asString(record.description),
        date: asString(record.date),
      };
    })
    .filter((item) => {
      if (!item.title && !item.description) return false;
      const title = item.title.toLowerCase();
      if (title.startsWith('[link') || title === 'links' || title === 'link') return false;
      const urlCount =
        (item.title.match(/https?:\/\//g) ?? []).length + (item.description.match(/https?:\/\//g) ?? []).length;
      return urlCount < 2;
    });
}
