/**
 * Returns true only if the URL uses the http: or https: protocol.
 * Rejects javascript:, data:, vbscript:, and any malformed strings.
 */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
