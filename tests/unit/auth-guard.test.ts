import { describe, expect, it } from 'vitest';
import { sanitizeNext } from '@/lib/sanitize-next';

describe('sanitizeNext', () => {
  it('returns fallback / for empty, null, or undefined values', () => {
    expect(sanitizeNext(null)).toBe('/');
    expect(sanitizeNext(undefined)).toBe('/');
    expect(sanitizeNext('')).toBe('/');
    expect(sanitizeNext('   ')).toBe('/');
  });

  it('preserves valid same-origin paths and query parameters', () => {
    expect(sanitizeNext('/')).toBe('/');
    expect(sanitizeNext('/admin')).toBe('/admin');
    expect(sanitizeNext('/profile')).toBe('/profile');
    expect(sanitizeNext('/admin?tab=projects')).toBe('/admin?tab=projects');
    expect(sanitizeNext('/?view=grid#active')).toBe('/?view=grid#active');
  });

  it('rejects protocol-relative URLs', () => {
    expect(sanitizeNext('//evil.com')).toBe('/');
    expect(sanitizeNext('///evil.com')).toBe('/');
  });

  it('rejects external absolute URLs and schemes', () => {
    expect(sanitizeNext('https://evil.com')).toBe('/');
    expect(sanitizeNext('http://evil.com/admin')).toBe('/');
    expect(sanitizeNext('javascript:alert(1)')).toBe('/');
    expect(sanitizeNext('data:text/html,evil')).toBe('/');
  });

  it('rejects paths containing backslashes', () => {
    expect(sanitizeNext('/\\evil.com')).toBe('/');
    expect(sanitizeNext('/path\\to\\somewhere')).toBe('/');
  });

  it('rejects scheme injection before path query', () => {
    expect(sanitizeNext('/http://evil.com')).toBe('/');
  });
});
