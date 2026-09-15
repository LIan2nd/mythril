/**
 * Sanitizes a redirect destination to ensure it is a safe same-origin path.
 *
 * Rules:
 * - Must start with a single '/'
 * - Must not start with '//' (protocol-relative URL)
 * - Must not contain '\'
 * - Must not contain a protocol/scheme (e.g. 'https:', 'javascript:')
 * - Falls back to '/' if invalid or empty
 */
export function sanitizeNext(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '/';
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return '/';
  }

  // Check if there is a colon before the query string or hash (scheme injection attempt)
  const pathPart = trimmed.split(/[?#]/, 1)[0];
  if (pathPart.includes(':')) {
    return '/';
  }

  return trimmed;
}
