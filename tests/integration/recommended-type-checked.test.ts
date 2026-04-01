import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const exported = require('../../dist/index.cjs');
const plugin: typeof import('../../src/index').default = exported.default ?? exported;

async function lintFixture(relativePath: string) {
  const fixtureUrl = new URL(`../fixtures/${relativePath}`, import.meta.url);
  const code = await readFile(fixtureUrl, 'utf8');
  const eslint = new ESLint({
    overrideConfig: [plugin.configs.recommended, plugin.configs['recommended-type-checked']],
    overrideConfigFile: true,
  });

  return eslint.lintText(code, {
    filePath: fixtureUrl.pathname,
  });
}

describe('recommended-type-checked config adoption', () => {
  it('reports raw Electron API exposure in preload code', async () => {
    const [result] = await lintFixture('unsafe-preload.ts');
    const ruleIds = result.messages.map((message) => message.ruleId);

    expect(ruleIds).toContain('electron-security/no-raw-electron-api-exposure');
  });

  it('keeps safe preload wrappers silent', async () => {
    const [result] = await lintFixture('safe-preload.ts');
    expect(result.messages).toHaveLength(0);
  });
});
