import { recommendations } from '../src/recommendations';

function getRuleCell(ruleId?: string, docsPath?: string): string {
  if (!ruleId) {
    return '—';
  }

  if (!docsPath) {
    return `\`${ruleId}\``;
  }

  return `[\`${ruleId}\`](./${docsPath})`;
}

function escapeTableCell(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('|', '\\|');
}

export function renderRuleMatrix(): string {
  const implementedRecommendations = recommendations.filter((recommendation) => recommendation.docsPath);
  const header = [
    '| Rule | Covers | Config |',
    '| --- | --- | --- |',
  ];

  const rows = implementedRecommendations.map((recommendation) =>
    [
      getRuleCell(recommendation.ruleId, recommendation.docsPath),
      escapeTableCell(recommendation.title),
      recommendation.requiresTypeChecking ? '`recommended-type-checked`' : '`recommended`',
    ].join(' | '),
  );

  return [...header, ...rows.map((row) => `| ${row} |`)].join('\n');
}

export function injectGeneratedSection(readme: string, section: string): string {
  const startMarker = '<!-- GENERATED_RULE_MATRIX_START -->';
  const endMarker = '<!-- GENERATED_RULE_MATRIX_END -->';
  const startIndex = readme.indexOf(startMarker);
  const endIndex = readme.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error('README.md is missing generated section markers.');
  }

  const prefix = readme.slice(0, startIndex + startMarker.length);
  const suffix = readme.slice(endIndex);

  return `${prefix}\n${section}\n${suffix}`;
}
