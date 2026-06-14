import DOMPurify from 'dompurify';

const PROBLEM_HTML_ALLOWED_TAGS = [
  'p',
  'br',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'code',
  'pre',
  'blockquote',
  'span',
  'div',
  'sub',
  'sup',
  'h1',
  'h2',
  'h3',
  'h4',
] as const;

const PROBLEM_HTML_CONFIG = {
  ALLOWED_TAGS: [...PROBLEM_HTML_ALLOWED_TAGS],
  ALLOWED_ATTR: ['class', 'href', 'title', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
};

/**
 * Sanitize LeetCode-style problem HTML before rendering with dangerouslySetInnerHTML.
 */
export function sanitizeProblemHtml(html: unknown): string {
  if (typeof html !== 'string' || !html.trim()) {
    return '';
  }
  return DOMPurify.sanitize(html, PROBLEM_HTML_CONFIG);
}
