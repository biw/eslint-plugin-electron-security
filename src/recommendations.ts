export type EnforcementClass =
  | 'syntax-only'
  | 'typed single-file'
  | 'cross-file/project analysis'
  | 'not lintable here';

export type RecommendationTarget =
  | 'v0'
  | 'v0.1'
  | 'v0.2'
  | 'future'
  | 'docs-only'
  | 'external tooling';

export interface RecommendationRecord {
  class: EnforcementClass;
  docsPath?: string;
  number: number;
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
    class: 'syntax-only',
    target: 'v0',
    docsPath: 'docs/rules/no-insecure-load-url.md',
  },
  {
    number: 2,
    title: 'Do not enable Node.js integration for remote content',
    ruleId: 'no-node-integration-for-remote-content',
    class: 'syntax-only',
    target: 'v0',
    docsPath: 'docs/rules/no-node-integration-for-remote-content.md',
  },
  {
    number: 3,
    title: 'Enable context isolation in all renderers',
    ruleId: 'no-context-isolation-disabled',
    class: 'syntax-only',
    target: 'v0',
    docsPath: 'docs/rules/no-context-isolation-disabled.md',
  },
  {
    number: 4,
    title: 'Enable process sandboxing',
    ruleId: 'no-sandbox-disabled',
    class: 'syntax-only',
    target: 'v0',
    docsPath: 'docs/rules/no-sandbox-disabled.md',
  },
  {
    number: 5,
    title: 'Use ses.setPermissionRequestHandler() in sessions that load remote content',
    ruleId: 'require-permission-request-handler',
    class: 'cross-file/project analysis',
    target: 'future',
  },
  {
    number: 6,
    title: 'Do not disable webSecurity',
    ruleId: 'no-web-security-disabled',
    class: 'syntax-only',
    target: 'v0',
    docsPath: 'docs/rules/no-web-security-disabled.md',
  },
  {
    number: 7,
    title: 'Define a Content Security Policy',
    ruleId: 'require-csp',
    class: 'cross-file/project analysis',
    target: 'future',
  },
  {
    number: 8,
    title: 'Do not enable allowRunningInsecureContent',
    ruleId: 'no-allow-running-insecure-content',
    class: 'syntax-only',
    target: 'v0',
    docsPath: 'docs/rules/no-allow-running-insecure-content.md',
  },
  {
    number: 9,
    title: 'Do not enable experimental features',
    ruleId: 'no-experimental-features',
    class: 'syntax-only',
    target: 'v0',
    docsPath: 'docs/rules/no-experimental-features.md',
  },
  {
    number: 10,
    title: 'Do not use enableBlinkFeatures',
    ruleId: 'no-enable-blink-features',
    class: 'syntax-only',
    target: 'v0',
    docsPath: 'docs/rules/no-enable-blink-features.md',
  },
  {
    number: 11,
    title: '<webview>: do not use allowpopups',
    ruleId: 'no-webview-allowpopups',
    class: 'syntax-only',
    target: 'v0.1',
    docsPath: 'docs/rules/no-webview-allowpopups.md',
  },
  {
    number: 12,
    title: '<webview>: verify options and params',
    ruleId: 'require-safe-webview-attachment',
    class: 'syntax-only',
    target: 'v0.2',
    docsPath: 'docs/rules/require-safe-webview-attachment.md',
  },
  {
    number: 13,
    title: 'Disable or limit navigation',
    ruleId: 'require-navigation-allowlist',
    class: 'syntax-only',
    target: 'v0.2',
    docsPath: 'docs/rules/require-navigation-allowlist.md',
  },
  {
    number: 14,
    title: 'Disable or limit creation of new windows',
    ruleId: 'require-window-open-handler',
    class: 'syntax-only',
    target: 'v0.2',
    docsPath: 'docs/rules/require-window-open-handler.md',
  },
  {
    number: 15,
    title: 'Do not use shell.openExternal with untrusted content',
    ruleId: 'no-open-external-with-dynamic-url',
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
    class: 'syntax-only',
    target: 'v0.2',
    docsPath: 'docs/rules/require-ipc-sender-validation.md',
  },
  {
    number: 18,
    title: 'Avoid file:// and prefer custom protocols',
    ruleId: 'no-file-protocol-load-url',
    class: 'syntax-only',
    target: 'v0.1',
    docsPath: 'docs/rules/no-file-protocol-load-url.md',
  },
  {
    number: 19,
    title: 'Check which fuses you can change',
    ruleId: 'audit-electron-fuses',
    class: 'not lintable here',
    target: 'external tooling',
  },
  {
    number: 20,
    title: 'Do not expose Electron APIs to untrusted web content',
    ruleId: 'no-raw-electron-api-exposure',
    class: 'typed single-file',
    target: 'v0.1',
    docsPath: 'docs/rules/no-raw-electron-api-exposure.md',
    requiresTypeChecking: true,
  },
];

export const recommendedRuleIds = recommendations
  .filter(
    (recommendation) =>
      recommendation.class === 'syntax-only' &&
      (recommendation.target === 'v0' ||
        recommendation.target === 'v0.1' ||
        recommendation.target === 'v0.2'),
  )
  .map((recommendation) => recommendation.ruleId)
  .filter((ruleId): ruleId is string => Boolean(ruleId));

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
