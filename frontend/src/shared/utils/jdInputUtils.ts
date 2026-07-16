import { jdTextApi } from 'shared/services/jdTextApi';

export const JD_FILE_MAX_BYTES = 2 * 1024 * 1024;
export const JD_FILE_ACCEPT = '.txt,.md,.pdf,.docx';

const JD_ROLE_MAX_LEN = 160;
const JD_COMPANY_MAX_LEN = 120;
const HINT_SCAN_LINES = 40;

export type JdTargetHints = {
  role?: string;
  company?: string;
};

const ROLE_LABEL_RE =
  /^(?:job\s*title|position|role|title)\s*[:#-]\s*(.+)$/i;
const COMPANY_LABEL_RE =
  /^(?:company|employer|organization|organisation)\s*[:#-]\s*(.+)$/i;
const ABOUT_COMPANY_RE = /^about\s+(?!the\s+role\b|this\s+role\b|us\b)(.+)$/i;
const TITLE_AT_COMPANY_RE =
  /^(.+?)\s+at\s+([A-Za-z0-9][A-Za-z0-9&.,'()/\s-]{1,80})$/i;
const TITLE_SPLIT_RE = /^(.{3,80}?)\s*[|/]\s*(.{2,60})$/;

const LOCATION_SUFFIX_RE =
  /\s*\((?:remote|hybrid|on[- ]?site|full[- ]?time|part[- ]?time)\)\s*$/i;
const JOB_ID_SUFFIX_RE = /\s*(?:#|req\.?|id:?)\s*[A-Za-z0-9-]+\s*$/i;

const ROLE_SIGNAL_RE =
  /\b(?:engineer|developer|architect|designer|manager|analyst|scientist|intern|consultant|director|specialist|administrator|recruiter|coordinator|associate|tester|devops|sre|swe|sde|programmer|writer|researcher)\b/i;

const PROSE_ROLE_PATTERNS: RegExp[] = [
  /\b(?:looking for|seeking)\s+(?:a|an)\s+(.{3,100}?)\s+to\s+(?:join|help|work|build|support|lead|drive|own)\b/i,
  /\b(?:we(?:'re| are)\s+)?hiring\s+(?:a|an)\s+(.{3,100}?)(?:\s+who|\s+to\b|[.,])/i,
  /\bjoin\s+(?:us|our\s+team)\b(?:\s+as)?\s+(?:a|an)?\s*(.{3,100}?)(?:\s+who|\s+to\b|[.,])/i,
];

const HIRING_EMAIL_RE =
  /(?:hiring|careers|jobs|recruiting|talent|hr)@([a-z0-9][-a-z0-9]*)\.[a-z]{2,}/i;

const DOMAIN_IN_TEXT_RE =
  /(?:https?:\/\/)?(?:www\.)?([a-z0-9][-a-z0-9]{1,62})\.(?:com|io|co|ai|org|net|dev)\b/gi;

const GENERIC_DOMAIN_BLOCKLIST = new Set([
  'gmail',
  'google',
  'linkedin',
  'github',
  'gitlab',
  'bitbucket',
  'next',
  'react',
  'mozilla',
  'w3',
  'schema',
  'example',
  'localhost',
]);

const METADATA_TERM_RE =
  /^(?:remote|hybrid|on[- ]?site|full[- ]?time|part[- ]?time|contract|permanent|freelance|internship|india|usa|uk|canada|delhi|bangalore|bengaluru|mumbai|hyderabad|pune|chennai|ncr|emea|apac|amer|europe|asia|stack|full|time)$/i;

const METADATA_LINE_RE =
  /^(?:full\s+stack|remote|hybrid|on[- ]?site|full[- ]?time|part[- ]?time)(?:\s*[•|·/,-–—]\s*(?:remote|hybrid|on[- ]?site|full[- ]?time|part[- ]?time|\([^)]+\)|india|usa|uk))*$/i;

function cleanHint(value: string, maxLen: number): string | undefined {
  let text = value.replace(/\s+/g, ' ').trim();
  text = text.replace(LOCATION_SUFFIX_RE, '').replace(JOB_ID_SUFFIX_RE, '').trim();
  text = text.replace(/\s*[•|·]\s*.*$/, '').trim();
  if (!text) return undefined;
  return text.slice(0, maxLen);
}

function isMetadataToken(value: string): boolean {
  const token = value.trim().toLowerCase();
  if (!token) return true;
  if (METADATA_TERM_RE.test(token)) return true;
  if (/^\(.*\)$/.test(token)) return true;
  return false;
}

function isMetadataLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (METADATA_LINE_RE.test(trimmed)) return true;
  if (/^[•|·/\-–—\s]+$/.test(trimmed)) return true;
  if (trimmed.length <= 2 && !/\d/.test(trimmed)) return true;
  return false;
}

function hasRoleSignal(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (ROLE_SIGNAL_RE.test(text)) return true;
  if (/\b(?:senior|junior|staff|principal|lead|head|chief|vp|svp|avp)\s+\w+/i.test(text)) {
    return true;
  }
  if (/\b(?:software|full[- ]?stack|front[- ]?end|back[- ]?end|mobile|data|product|platform|cloud|security|qa|ml|ai)\s+\w+/i.test(text)) {
    return true;
  }
  if (/\bengineer\s+(?:i{1,3}|iv|v|vi{0,3})\b/i.test(text)) return true;
  return false;
}

function looksLikeCompany(value: string): boolean {
  const text = value.trim();
  if (!text || text.length > JD_COMPANY_MAX_LEN || text.length < 2) return false;
  if (/^(?:the|a|an)\s+/i.test(text)) return false;
  if (isMetadataToken(text)) return false;
  if (!/[A-Za-z]/.test(text)) return false;
  const words = text.split(/\s+/);
  if (words.length === 1 && words[0].length < 3) return false;
  if (words.every((word) => isMetadataToken(word))) return false;
  return true;
}

function looksLikeRole(value: string): boolean {
  const text = value.trim();
  if (!text || text.length > JD_ROLE_MAX_LEN || text.length < 3) return false;
  const lower = text.toLowerCase();
  if (
    lower === 'job description' ||
    lower === 'about the role' ||
    lower === 'about us' ||
    lower === 'the role'
  ) {
    return false;
  }
  if (isMetadataToken(text)) return false;
  if (!hasRoleSignal(text) && text.split(/\s+/).length < 2) return false;
  return /[A-Za-z]/.test(text);
}

function titleCaseDomain(domain: string): string {
  const token = domain.trim().toLowerCase();
  if (!token) return '';
  return token.charAt(0).toUpperCase() + token.slice(1);
}

function companyFromEmail(text: string): string | undefined {
  const match = text.match(HIRING_EMAIL_RE);
  if (!match?.[1]) return undefined;
  const domain = match[1].toLowerCase();
  if (GENERIC_DOMAIN_BLOCKLIST.has(domain)) return undefined;
  return titleCaseDomain(domain);
}

function companyFromDomains(text: string): string | undefined {
  const matches = [...text.matchAll(DOMAIN_IN_TEXT_RE)];
  for (const match of matches) {
    const domain = (match[1] || '').toLowerCase();
    if (!domain || GENERIC_DOMAIN_BLOCKLIST.has(domain)) continue;
    if (domain.length < 3) continue;
    return titleCaseDomain(domain);
  }
  return undefined;
}

function roleFromProse(text: string): string | undefined {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  for (const pattern of PROSE_ROLE_PATTERNS) {
    const match = collapsed.match(pattern);
    if (!match?.[1]) continue;
    const role = cleanHint(match[1], JD_ROLE_MAX_LEN);
    if (role && looksLikeRole(role)) return role;
  }
  return undefined;
}

function parseTitleCompanyLine(line: string): JdTargetHints {
  if (isMetadataLine(line) || line.length > 100) return {};

  const atMatch = line.match(TITLE_AT_COMPANY_RE);
  if (atMatch) {
    const role = cleanHint(atMatch[1], JD_ROLE_MAX_LEN);
    const company = cleanHint(atMatch[2], JD_COMPANY_MAX_LEN);
    return {
      role: role && looksLikeRole(role) ? role : undefined,
      company: company && looksLikeCompany(company) ? company : undefined,
    };
  }

  const splitMatch = line.match(TITLE_SPLIT_RE);
  if (!splitMatch) return {};

  const left = cleanHint(splitMatch[1], JD_ROLE_MAX_LEN);
  const right = cleanHint(splitMatch[2], JD_COMPANY_MAX_LEN);
  if (!left || !right || !looksLikeRole(left) || !looksLikeCompany(right)) {
    return {};
  }
  if (!hasRoleSignal(left)) return {};
  return { role: left, company: right };
}

export function extractJdTargetHints(text: string): JdTargetHints {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, HINT_SCAN_LINES);

  const hints: JdTargetHints = {};

  for (const line of lines) {
    if (isMetadataLine(line)) continue;

    const roleLabel = line.match(ROLE_LABEL_RE);
    if (roleLabel && !hints.role) {
      const role = cleanHint(roleLabel[1], JD_ROLE_MAX_LEN);
      if (role && looksLikeRole(role)) hints.role = role;
    }

    const companyLabel = line.match(COMPANY_LABEL_RE);
    if (companyLabel && !hints.company) {
      const company = cleanHint(companyLabel[1], JD_COMPANY_MAX_LEN);
      if (company && looksLikeCompany(company)) hints.company = company;
    }

    if (!hints.company) {
      const aboutMatch = line.match(ABOUT_COMPANY_RE);
      if (aboutMatch) {
        const company = cleanHint(aboutMatch[1], JD_COMPANY_MAX_LEN);
        if (company && looksLikeCompany(company)) hints.company = company;
      }
    }
  }

  if (!hints.role) {
    const proseRole = roleFromProse(text);
    if (proseRole) hints.role = proseRole;
  }

  if (!hints.role || !hints.company) {
    for (const line of lines) {
      if (isMetadataLine(line) || line.length > 100) continue;
      const parsed = parseTitleCompanyLine(line);
      if (!hints.role && parsed.role) hints.role = parsed.role;
      if (!hints.company && parsed.company) hints.company = parsed.company;
      if (hints.role && hints.company) break;
    }
  }

  if (!hints.company) {
    const emailCompany = companyFromEmail(text);
    if (emailCompany) hints.company = emailCompany;
  }

  if (!hints.company) {
    const domainCompany = companyFromDomains(text);
    if (domainCompany) hints.company = domainCompany;
  }

  return hints;
}

export function applyJdTargetHints(
  hints: JdTargetHints,
  current: { role: string; company: string },
  setters: { setRole: (value: string) => void; setCompany: (value: string) => void },
): void {
  if (!current.role.trim() && hints.role) {
    setters.setRole(hints.role);
  }
  if (!current.company.trim() && hints.company) {
    setters.setCompany(hints.company);
  }
}

/** Collapse all whitespace to single spaces — best token efficiency for JD compute. */
export function normalizeJobDescriptionText(raw: string, maxChars = 8000): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (!collapsed) return '';
  return collapsed.slice(0, maxChars);
}

function extensionForFile(file: File): string {
  const name = file.name.toLowerCase().trim();
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot) : '';
}

function isPlainTextExtension(ext: string): boolean {
  return ext === '.txt' || ext === '.md';
}

function isServerExtractExtension(ext: string): boolean {
  return ext === '.pdf' || ext === '.docx';
}

function validateJobDescriptionFile(file: File): void {
  const ext = extensionForFile(file);
  if (!isPlainTextExtension(ext) && !isServerExtractExtension(ext)) {
    throw new Error('Unsupported file type. Use TXT, MD, PDF, or DOCX.');
  }
  if (file.size > JD_FILE_MAX_BYTES) {
    throw new Error('File too large. Max size 2 MB.');
  }
  if (file.size === 0) {
    throw new Error('File is empty.');
  }
}

function readPlainTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      resolve(text);
    };
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.readAsText(file);
  });
}

export async function loadJobDescriptionFromFile(file: File, maxChars = 8000): Promise<string> {
  validateJobDescriptionFile(file);
  const ext = extensionForFile(file);

  const raw = isPlainTextExtension(ext)
    ? await readPlainTextFile(file)
    : await jdTextApi.extractJdTextFromFile(file);

  const normalized = normalizeJobDescriptionText(raw, maxChars);
  if (!normalized) {
    throw new Error('Could not extract text from file');
  }
  return normalized;
}
