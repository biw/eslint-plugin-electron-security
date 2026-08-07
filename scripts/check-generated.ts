import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

import { injectGeneratedSection, renderRuleMatrix } from './render-generated';
import { recommendations, recommendedRuleIds } from '../src/recommendations';

async function ensureDocsExist(): Promise<void> {
  await Promise.all(
    recommendations
      .filter((recommendation) => recommendation.docsPath)
      .map(async (recommendation) => {
        await access(new URL(`../${recommendation.docsPath}`, import.meta.url), constants.R_OK);
      }),
  );
}

async function ensureReadmeIsFresh(): Promise<void> {
  const readmePath = new URL('../README.md', import.meta.url);
  const current = await readFile(readmePath, 'utf8');
  const expected = injectGeneratedSection(current, renderRuleMatrix());

  if (current !== expected) {
    throw new Error('README.md is out of date. Run "npm run generate:readme".');
  }
}

async function ensureRuleCoverageIsConsistent(): Promise<void> {
  const duplicates = new Set<string>();
  const seenRuleIds = new Set<string>();
  const seenRecommendationNumbers = new Set<number>();

  for (const recommendation of recommendations) {
    // Structural rules are not tied to a numbered checklist item.
    if (recommendation.number !== undefined) {
      if (seenRecommendationNumbers.has(recommendation.number)) {
        throw new Error(`Duplicate recommendation number ${recommendation.number}.`);
      }

      seenRecommendationNumbers.add(recommendation.number);
    }

    if (!recommendation.ruleId) {
      continue;
    }

    if (seenRuleIds.has(recommendation.ruleId)) {
      duplicates.add(recommendation.ruleId);
    }

    seenRuleIds.add(recommendation.ruleId);
  }

  if (duplicates.size > 0) {
    throw new Error(`Duplicate rule ids found: ${Array.from(duplicates).join(', ')}`);
  }

  if (recommendedRuleIds.length === 0) {
    throw new Error('Expected at least one recommended rule.');
  }
}

await Promise.all([ensureDocsExist(), ensureReadmeIsFresh(), ensureRuleCoverageIsConsistent()]);
