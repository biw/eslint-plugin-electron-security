import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { injectGeneratedSection, renderRuleMatrix } from '../../scripts/render-generated';
import { recommendations, recommendedRuleIds, recommendedTypeCheckedRuleIds } from '../../src/recommendations';

describe('recommendation metadata', () => {
  it('keeps recommended rule ids aligned with implemented docs', () => {
    const ruleIdsWithDocs = recommendations
      .filter(
        (recommendation) =>
          recommendation.docsPath &&
          recommendation.class === 'syntax-only' &&
          (recommendation.target === 'v0' ||
            recommendation.target === 'v0.1' ||
            recommendation.target === 'v0.2'),
      )
      .map((recommendation) => recommendation.docsPath && recommendation.ruleId)
      .filter((ruleId): ruleId is string => Boolean(ruleId))
      .sort();

    expect([...recommendedRuleIds].sort()).toEqual(ruleIdsWithDocs);
  });

  it('tracks type-checked recommendations separately', () => {
    expect(recommendedTypeCheckedRuleIds).toEqual(['no-raw-electron-api-exposure']);
  });

  it('renders the README rule matrix without drift', async () => {
    const readme = await readFile(new URL('../../README.md', import.meta.url), 'utf8');
    expect(readme).toEqual(injectGeneratedSection(readme, renderRuleMatrix()));
  });
});
