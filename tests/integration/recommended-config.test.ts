import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const exported = require('../../dist/index.cjs');
const plugin: typeof import('../../src/index').default = exported.default ?? exported;

async function lintFixture(relativePath: string) {
  const code = await readFile(new URL(`../fixtures/${relativePath}`, import.meta.url), 'utf8');
  const eslint = new ESLint({
    overrideConfig: [plugin.configs.recommended],
    overrideConfigFile: true,
  });

  return eslint.lintText(code, {
    filePath: relativePath,
  });
}

describe('recommended config adoption', () => {
  it('reports the expected v0 rules on an unsafe sample file', async () => {
    const [result] = await lintFixture('unsafe-main.ts');
    const ruleIds = result.messages.map((message) => message.ruleId).sort();

    expect(ruleIds).toEqual([
      'electron-security/no-allow-running-insecure-content',
      'electron-security/no-context-isolation-disabled',
      'electron-security/no-enable-blink-features',
      'electron-security/no-experimental-features',
      'electron-security/no-insecure-load-url',
      'electron-security/no-node-integration-for-remote-content',
      'electron-security/no-open-external-with-dynamic-url',
      'electron-security/no-sandbox-disabled',
      'electron-security/no-web-security-disabled',
      'electron-security/require-ipc-sender-validation',
      'electron-security/require-navigation-allowlist',
      'electron-security/require-safe-webview-attachment',
      'electron-security/require-window-open-handler',
    ]);
  });

  it('stays silent on a safe sample file', async () => {
    const [result] = await lintFixture('safe-main.ts');
    expect(result.messages).toHaveLength(0);
  });

  it('ignores deliberately out-of-scope dynamic cases', async () => {
    const [result] = await lintFixture('dynamic-main.ts');
    expect(result.messages).toHaveLength(0);
  });

  it('reports file protocol and allowpopups in renderer fixtures', async () => {
    const [result] = await lintFixture('unsafe-renderer.tsx');
    const ruleIds = result.messages.map((message) => message.ruleId).sort();

    expect(ruleIds).toEqual([
      'electron-security/no-file-protocol-load-url',
      'electron-security/no-webview-allowpopups',
    ]);
  });
});
