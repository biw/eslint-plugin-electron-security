import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import plugin from '../../src/index';

/**
 * The plugin reports its own version through `meta.version`, which ESLint
 * surfaces in diagnostics and config inspection. It drifted from package.json
 * once already, so it is asserted rather than trusted.
 */
describe('plugin metadata', () => {
  it('reports the same version as package.json', async () => {
    const manifest = JSON.parse(
      await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as { name: string; version: string };

    expect(plugin.meta.version).toBe(manifest.version);
    expect(plugin.meta.name).toBe(manifest.name);
  });

  it('exposes every rule referenced by a config', () => {
    const ruleNames = new Set(Object.keys(plugin.rules));

    for (const [configName, config] of Object.entries(plugin.configs)) {
      for (const ruleId of Object.keys((config as { rules: object }).rules)) {
        const bareName = ruleId.replace('electron-security/', '');

        expect(ruleNames.has(bareName), `${configName} references missing rule ${ruleId}`).toBe(
          true,
        );
      }
    }
  });

  it('gives every rule a docs url and a schema', () => {
    for (const [ruleName, rule] of Object.entries(plugin.rules)) {
      const meta = (rule as { meta: { docs?: { url?: string }; schema?: unknown } }).meta;

      expect(meta.docs?.url, `${ruleName} is missing a docs url`).toBeTruthy();
      expect(meta.schema, `${ruleName} is missing a schema`).toBeDefined();
    }
  });
});
