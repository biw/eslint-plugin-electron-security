const INSECURE_LOAD_PROTOCOLS = new Set(['ftp:', 'http:', 'ws:']);
const REMOTE_PROTOCOLS = new Set(['http:', 'https:']);
const SAFE_EXTERNAL_PROTOCOLS = new Set(['https:', 'mailto:', 'tel:']);

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

export function isSafeExternalUrl(value: string): boolean {
  const protocol = getProtocol(value);
  return protocol ? SAFE_EXTERNAL_PROTOCOLS.has(protocol) : false;
}
