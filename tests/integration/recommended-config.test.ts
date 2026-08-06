import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const exported = require('../../dist/index.cjs');
const plugin: typeof import('../../src/index').default = exported.default ?? exported;

async function lintFixture(relativePath: string, configName: 'recommended' | 'strict' = 'recommended') {
  const code = await readFile(new URL(`../fixtures/${relativePath}`, import.meta.url), 'utf8');
  const eslint = new ESLint({
    overrideConfig: [plugin.configs[configName]],
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

  it('grades provable rules as errors and inferred rules as warnings', async () => {
    const [result] = await lintFixture('unsafe-main.ts');

    const severityByRule = new Map(
      result.messages.map((message) => [message.ruleId, message.severity]),
    );

    // Provable: an unsafe literal is right there in the source.
    expect(severityByRule.get('electron-security/no-sandbox-disabled')).toBe(2);
    expect(severityByRule.get('electron-security/no-context-isolation-disabled')).toBe(2);

    // Inferred: reported because a mitigation was not recognised.
    expect(severityByRule.get('electron-security/require-ipc-sender-validation')).toBe(1);
    expect(severityByRule.get('electron-security/require-navigation-allowlist')).toBe(1);

    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.warningCount).toBeGreaterThan(0);
  });

  it('promotes every rule to an error under strict', async () => {
    const [result] = await lintFixture('unsafe-main.ts', 'strict');

    expect(result.warningCount).toBe(0);
    expect(result.messages.every((message) => message.severity === 2)).toBe(true);
  });

  it('keeps strict and recommended reporting the same findings', async () => {
    const [recommended] = await lintFixture('unsafe-main.ts');
    const [strict] = await lintFixture('unsafe-main.ts', 'strict');

    expect(strict.messages.map((message) => message.ruleId).sort()).toEqual(
      recommended.messages.map((message) => message.ruleId).sort(),
    );
  });

  it('stays silent on the safe fixture under strict too', async () => {
    const [result] = await lintFixture('safe-main.ts', 'strict');
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
