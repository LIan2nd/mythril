import { describe, expect, it } from 'vitest';
import { sanitizeNext } from '@/lib/sanitize-next';

describe('sanitizeNext', () => {
  it('returns fallback /dashboard for empty, null, or undefined values', () => {
    expect(sanitizeNext(null)).toBe('/dashboard');
    expect(sanitizeNext(undefined)).toBe('/dashboard');
    expect(sanitizeNext('')).toBe('/dashboard');
    expect(sanitizeNext('   ')).toBe('/dashboard');
  });

  it('preserves valid same-origin paths and query parameters', () => {
    expect(sanitizeNext('/')).toBe('/');
    expect(sanitizeNext('/admin')).toBe('/admin');
    expect(sanitizeNext('/profile')).toBe('/profile');
    expect(sanitizeNext('/dashboard')).toBe('/dashboard');
    expect(sanitizeNext('/admin?tab=projects')).toBe('/admin?tab=projects');
    expect(sanitizeNext('/?view=grid#active')).toBe('/?view=grid#active');
  });

  it('rejects protocol-relative URLs', () => {
    expect(sanitizeNext('//evil.com')).toBe('/dashboard');
    expect(sanitizeNext('///evil.com')).toBe('/dashboard');
  });

  it('rejects external absolute URLs and schemes', () => {
    expect(sanitizeNext('https://evil.com')).toBe('/dashboard');
    expect(sanitizeNext('http://evil.com/admin')).toBe('/dashboard');
    expect(sanitizeNext('javascript:alert(1)')).toBe('/dashboard');
    expect(sanitizeNext('data:text/html,evil')).toBe('/dashboard');
  });

  it('rejects paths containing backslashes', () => {
    expect(sanitizeNext('/\\evil.com')).toBe('/dashboard');
    expect(sanitizeNext('/path\\to\\somewhere')).toBe('/dashboard');
  });

  it('rejects scheme injection before path query', () => {
    expect(sanitizeNext('/http://evil.com')).toBe('/dashboard');
  });
});
