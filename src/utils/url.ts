const INSECURE_LOAD_PROTOCOLS = new Set(['ftp:', 'http:', 'ws:']);
const REMOTE_PROTOCOLS = new Set(['http:', 'https:']);
export const DEFAULT_SAFE_EXTERNAL_PROTOCOLS = ['https:', 'mailto:', 'tel:'] as const;


function getProtocol(value: string): string | undefined {
  try {
    return new URL(value).protocol;
  } catch {
    return undefined;
  }
}

export function isInsecureLoadUrl(value: string): boolean {
  const protocol = getProtocol(value);
  return protocol ? INSECURE_LOAD_PROTOCOLS.has(protocol) : false;
}

export function isRemoteUrl(value: string): boolean {
  const protocol = getProtocol(value);
  return protocol ? REMOTE_PROTOCOLS.has(protocol) : false;
}

/**
 * Checks a URL against a caller-supplied protocol allowlist.
 *
 * Entries may be written with or without the trailing colon so that
 * `['https', 'tel']` and `['https:', 'tel:']` both behave as expected.
 */
export function hasAllowedProtocol(value: string, allowedProtocols: readonly string[]): boolean {
  const protocol = getProtocol(value);

  if (!protocol) {
    return false;
  }

  return allowedProtocols.some((allowed) => {
    const normalized = allowed.endsWith(':') ? allowed : `${allowed}:`;
    return normalized.toLowerCase() === protocol.toLowerCase();
  });
}
