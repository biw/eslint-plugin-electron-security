import { readFile, writeFile } from 'node:fs/promises';

import { injectGeneratedSection, renderRuleMatrix } from './render-generated';

async function main(): Promise<void> {
  const readmePath = new URL('../README.md', import.meta.url);
  const current = await readFile(readmePath, 'utf8');
  const next = injectGeneratedSection(current, renderRuleMatrix());

  if (next !== current) {
    await writeFile(readmePath, next);
  }
}

await main();
