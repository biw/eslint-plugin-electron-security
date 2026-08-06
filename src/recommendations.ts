export type EnforcementClass =
  | 'syntax-only'
  | 'typed single-file'
  | 'cross-file/project analysis'
  | 'not lintable here';

export type RecommendationTarget =
  | 'v0'
  | 'v0.1'
  | 'v0.2'
  | 'v0.3'
  | 'future'
  | 'docs-only'
  | 'external tooling';

/**
 * How a rule can be wrong.
 *
 * `provable` rules report the presence of an unsafe literal. When they fire
 * they are right, so they ship as errors.
 *
 * `inferred` rules report the *absence* of a recognised mitigation. Any valid
 * pattern the rule does not recognise is a false positive, so they ship as
 * warnings in `recommended` and are promoted to errors in `strict`.
 */
export type RuleConfidence = 'provable' | 'inferred';

export interface RecommendationRecord {
  class: EnforcementClass;
  confidence?: RuleConfidence;
  docsPath?: string;
  /** Absent for structural rules that do not map to a numbered checklist item. */
  number?: number;
  requiresTypeChecking?: boolean;
  ruleId?: string;
  target: RecommendationTarget;
  title: string;
}

export const recommendations: RecommendationRecord[] = [
  {
    number: 1,
    title: 'Only load secure content',
    ruleId: 'no-insecure-load-url',
    confidence: 'provable',
    class: 'syntax-only',
    target: 'v0',
    docsPath: 'docs/rules/no-insecure-load-url.md',
  },
  {
    number: 2,
    title: 'Do not enable Node.js integration for remote content',
    ruleId: 'no-node-integration-for-remote-content',
    confidence: 'provable',
    class: 'syntax-only',
    target: 'v0',
    docsPath: 'docs/rules/no-node-integration-for-remote-content.md',
  },
  {
    number: 3,
    title: 'Enable context isolation in all renderers',
    ruleId: 'no-context-isolation-disabled',
    confidence: 'provable',
    class: 'syntax-only',
    target: 'v0',
    docsPath: 'docs/rules/no-context-isolation-disabled.md',
  },
  {
    number: 4,
    title: 'Enable process sandboxing',
    ruleId: 'no-sandbox-disabled',
    confidence: 'provable',
    class: 'syntax-only',
    target: 'v0',
    docsPath: 'docs/rules/no-sandbox-disabled.md',
  },
  {
    number: 5,
    title: 'Use ses.setPermissionRequestHandler() in sessions that load remote content',
    ruleId: 'require-permission-request-handler',
    confidence: 'inferred',
    class: 'syntax-only',
    target: 'v0.3',
    docsPath: 'docs/rules/require-permission-request-handler.md',
  },
  {
    number: 6,
    title: 'Do not disable webSecurity',
    ruleId: 'no-web-security-disabled',
    confidence: 'provable',
    class: 'syntax-only',
    target: 'v0',
    docsPath: 'docs/rules/no-web-security-disabled.md',
  },
  {
    number: 7,
    title: 'Define a Content Security Policy',
    ruleId: 'require-csp',
    confidence: 'inferred',
    class: 'syntax-only',
    target: 'v0.3',
    docsPath: 'docs/rules/require-csp.md',
  },
  {
    number: 8,
    title: 'Do not enable allowRunningInsecureContent',
    ruleId: 'no-allow-running-insecure-content',
    confidence: 'provable',
    class: 'syntax-only',
    target: 'v0',
    docsPath: 'docs/rules/no-allow-running-insecure-content.md',
  },
  {
    number: 9,
    title: 'Do not enable experimental features',
    ruleId: 'no-experimental-features',
    confidence: 'provable',
    class: 'syntax-only',
    target: 'v0',
    docsPath: 'docs/rules/no-experimental-features.md',
  },
  {
    number: 10,
    title: 'Do not use enableBlinkFeatures',
    ruleId: 'no-enable-blink-features',
    confidence: 'provable',
    class: 'syntax-only',
    target: 'v0',
    docsPath: 'docs/rules/no-enable-blink-features.md',
  },
  {
    number: 11,
    title: '<webview>: do not use allowpopups',
    ruleId: 'no-webview-allowpopups',
    confidence: 'provable',
    class: 'syntax-only',
    target: 'v0.1',
    docsPath: 'docs/rules/no-webview-allowpopups.md',
  },
  {
    number: 12,
    title: '<webview>: verify options and params',
    ruleId: 'require-safe-webview-attachment',
    confidence: 'inferred',
    class: 'syntax-only',
    target: 'v0.2',
    docsPath: 'docs/rules/require-safe-webview-attachment.md',
  },
  {
    number: 13,
    title: 'Disable or limit navigation',
    ruleId: 'require-navigation-allowlist',
    confidence: 'inferred',
    class: 'syntax-only',
    target: 'v0.2',
    docsPath: 'docs/rules/require-navigation-allowlist.md',
  },
  {
    number: 14,
    title: 'Disable or limit creation of new windows',
    ruleId: 'require-window-open-handler',
    confidence: 'inferred',
    class: 'syntax-only',
    target: 'v0.2',
    docsPath: 'docs/rules/require-window-open-handler.md',
  },
  {
    number: 15,
    title: 'Do not use shell.openExternal with untrusted content',
    ruleId: 'no-open-external-with-dynamic-url',
    confidence: 'inferred',
    class: 'syntax-only',
    target: 'v0',
    docsPath: 'docs/rules/no-open-external-with-dynamic-url.md',
  },
  {
    number: 16,
    title: 'Use a current version of Electron',
    ruleId: 'check-electron-version',
    class: 'not lintable here',
    target: 'external tooling',
  },
  {
    number: 17,
    title: 'Validate the sender of all IPC messages',
    ruleId: 'require-ipc-sender-validation',
    confidence: 'inferred',
    class: 'syntax-only',
    target: 'v0.2',
    docsPath: 'docs/rules/require-ipc-sender-validation.md',
  },
  {
    number: 18,
    title: 'Avoid file:// and prefer custom protocols',
    ruleId: 'no-file-protocol-load-url',
    confidence: 'provable',
    class: 'syntax-only',
    target: 'v0.1',
    docsPath: 'docs/rules/no-file-protocol-load-url.md',
  },
  {
    number: 19,
    title: 'Check which fuses you can change',
    ruleId: 'require-secure-fuses',
    confidence: 'provable',
    // Fuses are usually configured in electron-builder / Electron Forge config,
    // which is ordinary TypeScript and therefore lintable.
    class: 'syntax-only',
    target: 'v0.3',
    docsPath: 'docs/rules/require-secure-fuses.md',
  },
  {
    number: 20,
    title: 'Do not expose Electron APIs to untrusted web content',
    ruleId: 'no-raw-electron-api-exposure',
    confidence: 'provable',
    class: 'typed single-file',
    target: 'v0.1',
    docsPath: 'docs/rules/no-raw-electron-api-exposure.md',
    requiresTypeChecking: true,
  },
  {
    title: 'Route Electron APIs through a single audited factory',
    ruleId: 'require-factory',
    confidence: 'provable',
    class: 'syntax-only',
    target: 'v0.3',
    docsPath: 'docs/rules/require-factory.md',
  },
];

const SHIPPED_TARGETS = new Set<RecommendationTarget>(['v0', 'v0.1', 'v0.2', 'v0.3']);

function ruleIdsWhere(predicate: (record: RecommendationRecord) => boolean): string[] {
  return recommendations
    .filter((record) => SHIPPED_TARGETS.has(record.target) && !record.requiresTypeChecking)
    .filter(predicate)
    .map((record) => record.ruleId)
    .filter((ruleId): ruleId is string => Boolean(ruleId));
}

/** Rules that report an unsafe literal. Shipped as errors. */
export const provableRuleIds = ruleIdsWhere((record) => record.confidence === 'provable');

/** Rules that infer a missing mitigation. Warnings in `recommended`, errors in `strict`. */
export const inferredRuleIds = ruleIdsWhere((record) => record.confidence === 'inferred');

export const recommendedRuleIds = [...provableRuleIds, ...inferredRuleIds];

export const recommendedTypeCheckedRuleIds = recommendations
  .filter((recommendation) => recommendation.requiresTypeChecking)
  .map((recommendation) => recommendation.ruleId)
  .filter((ruleId): ruleId is string => Boolean(ruleId));

export function getRecommendationByRuleId(ruleId: string): RecommendationRecord {
  const recommendation = recommendations.find((candidate) => candidate.ruleId === ruleId);

  if (!recommendation) {
    throw new Error(`Unknown recommendation for rule "${ruleId}".`);
  }

  return recommendation;
}
