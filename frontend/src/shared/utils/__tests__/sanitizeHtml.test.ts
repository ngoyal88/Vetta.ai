import { describe, expect, it } from 'vitest';

import { sanitizeProblemHtml } from '../sanitizeHtml';

describe('sanitizeProblemHtml', () => {
  it('returns empty string for non-string input', () => {
    expect(sanitizeProblemHtml(null)).toBe('');
    expect(sanitizeProblemHtml(undefined)).toBe('');
    expect(sanitizeProblemHtml(42)).toBe('');
  });

  it('strips script tags', () => {
    const result = sanitizeProblemHtml('<p>Hello</p><script>alert(1)</script>');
    expect(result).not.toContain('<script');
    expect(result).toContain('Hello');
  });

  it('preserves safe formatting tags', () => {
    const input = '<p>Text</p><code>const x = 1;</code>';
    const result = sanitizeProblemHtml(input);
    expect(result).toContain('<p>');
    expect(result).toContain('<code>');
    expect(result).toContain('const x = 1;');
  });

  it('strips event handlers and javascript URLs', () => {
    const result = sanitizeProblemHtml(
      '<img src=x onerror="alert(1)"><a href="javascript:alert(1)">link</a>',
    );
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('javascript:');
  });
});
