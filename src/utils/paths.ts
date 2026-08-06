/**
 * Minimal glob matching for file allowlists.
 *
 * Deliberately dependency-free and limited to the three forms that matter for
 * "this API may only be used here": `*` (within a segment), `**` (across
 * segments) and a bare suffix such as `src/security/ipc.ts`.
 */
function globToRegExp(pattern: string): RegExp {
  let source = '';

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];

    if (character === '*') {
      if (pattern[index + 1] === '*') {
        // `**/` should also match zero directories.
        if (pattern[index + 2] === '/') {
          source += '(?:.*/)?';
          index += 2;
          continue;
        }

        source += '.*';
        index += 1;
        continue;
      }

      source += '[^/]*';
      continue;
    }

    if (character === '?') {
      source += '[^/]';
      continue;
    }

    source += character.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }

  return new RegExp(`^${source}$`);
}

/**
 * True when `filename` matches an allowlist entry.
 *
 * Entries without a glob character are treated as path suffixes, so
 * `src/security/ipc.ts` matches regardless of where the project root sits.
 */
export function matchesAnyPath(filename: string, patterns: readonly string[]): boolean {
  const normalized = filename.replaceAll('\\', '/');

  return patterns.some((pattern) => {
    const normalizedPattern = pattern.replaceAll('\\', '/');

    if (!/[*?]/.test(normalizedPattern)) {
      return (
        normalized === normalizedPattern ||
        normalized.endsWith(`/${normalizedPattern}`)
      );
    }

    const expression = globToRegExp(normalizedPattern);

    if (expression.test(normalized)) {
      return true;
    }

    // Allow project-relative patterns to match absolute filenames.
    const segments = normalized.split('/');

    for (let index = 1; index < segments.length; index += 1) {
      if (expression.test(segments.slice(index).join('/'))) {
        return true;
      }
    }

    return false;
  });
}
