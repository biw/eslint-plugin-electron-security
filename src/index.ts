import parser from '@typescript-eslint/parser';

import {
  inferredRuleIds,
  provableRuleIds,
  recommendedTypeCheckedRuleIds,
} from './recommendations';
import noAllowRunningInsecureContent from './rules/no-allow-running-insecure-content';
import noContextIsolationDisabled from './rules/no-context-isolation-disabled';
import noEnableBlinkFeatures from './rules/no-enable-blink-features';
import noExperimentalFeatures from './rules/no-experimental-features';
import noFileProtocolLoadUrl from './rules/no-file-protocol-load-url';
import noInsecureLoadUrl from './rules/no-insecure-load-url';
import noNodeIntegrationForRemoteContent from './rules/no-node-integration-for-remote-content';
import noOpenExternalWithDynamicUrl from './rules/no-open-external-with-dynamic-url';
import noRawElectronApiExposure from './rules/no-raw-electron-api-exposure';
import noSandboxDisabled from './rules/no-sandbox-disabled';
import noWebviewAllowpopups from './rules/no-webview-allowpopups';
import noWebSecurityDisabled from './rules/no-web-security-disabled';
import requireCsp from './rules/require-csp';
import requireFactory from './rules/require-factory';
import requireIpcSenderValidation from './rules/require-ipc-sender-validation';
import requireNavigationAllowlist from './rules/require-navigation-allowlist';
import requirePermissionRequestHandler from './rules/require-permission-request-handler';
import requireSafeWebviewAttachment from './rules/require-safe-webview-attachment';
import requireSecureFuses from './rules/require-secure-fuses';
import requireWindowOpenHandler from './rules/require-window-open-handler';
import { recommendations } from './recommendations';

const rules = {
  'no-allow-running-insecure-content': noAllowRunningInsecureContent,
  'no-context-isolation-disabled': noContextIsolationDisabled,
  'no-enable-blink-features': noEnableBlinkFeatures,
  'no-experimental-features': noExperimentalFeatures,
  'no-file-protocol-load-url': noFileProtocolLoadUrl,
  'no-insecure-load-url': noInsecureLoadUrl,
  'no-node-integration-for-remote-content': noNodeIntegrationForRemoteContent,
  'no-open-external-with-dynamic-url': noOpenExternalWithDynamicUrl,
  'no-raw-electron-api-exposure': noRawElectronApiExposure,
  'no-sandbox-disabled': noSandboxDisabled,
  'no-webview-allowpopups': noWebviewAllowpopups,
  'no-web-security-disabled': noWebSecurityDisabled,
  'require-csp': requireCsp,
  'require-factory': requireFactory,
  'require-ipc-sender-validation': requireIpcSenderValidation,
  'require-navigation-allowlist': requireNavigationAllowlist,
  'require-permission-request-handler': requirePermissionRequestHandler,
  'require-safe-webview-attachment': requireSafeWebviewAttachment,
  'require-secure-fuses': requireSecureFuses,
  'require-window-open-handler': requireWindowOpenHandler,
};

const ruleEntries = (ruleIds: string[], severity: 'error' | 'warn') =>
  ruleIds.map((ruleId) => [`electron-security/${ruleId}`, severity] as const);

/**
 * `recommended` ships provable rules as errors and inferred rules as warnings.
 *
 * A provable rule reports an unsafe literal it can see, so it is always right.
 * An inferred rule reports the absence of a mitigation it recognises, so an
 * unfamiliar-but-valid pattern reads as a violation. Shipping those as warnings
 * means adopting the plugin never turns CI red on a heuristic, while the
 * findings stay visible.
 */
const recommendedRules = Object.fromEntries([
  ...ruleEntries(provableRuleIds, 'error'),
  ...ruleEntries(inferredRuleIds, 'warn'),
]);

/** Everything at error, for projects that have tuned the inferred rules. */
const strictRules = Object.fromEntries([
  ...ruleEntries(provableRuleIds, 'error'),
  ...ruleEntries(inferredRuleIds, 'error'),
]);

const recommendedTypeCheckedRules = Object.fromEntries(
  recommendedTypeCheckedRuleIds.map((ruleId) => [`electron-security/${ruleId}`, 'error'] as const),
);

const plugin: any = {
  meta: {
    name: 'eslint-plugin-electron-security',
    // Keep in step with package.json. tests/unit/plugin-meta.test.ts fails if
    // these drift apart; importing package.json here would inline the whole
    // manifest, including devDependencies, into the published bundle.
    version: '1.0.0',
  },
  rules,
  configs: {},
  recommendations,
};

plugin.configs.recommended = {
  name: 'electron-security/recommended',
  files: ['**/*.{cjs,cts,js,jsx,mjs,mts,ts,tsx}'],
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
  plugins: {
    'electron-security': plugin,
  },
  rules: recommendedRules,
};

plugin.configs.strict = {
  name: 'electron-security/strict',
  files: ['**/*.{cjs,cts,js,jsx,mjs,mts,ts,tsx}'],
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
  plugins: {
    'electron-security': plugin,
  },
  rules: strictRules,
};

plugin.configs['recommended-type-checked'] = {
  name: 'electron-security/recommended-type-checked',
  files: ['**/*.{cts,mts,ts,tsx}'],
  languageOptions: {
    parser,
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
      projectService: true,
    },
  },
  plugins: {
    'electron-security': plugin,
  },
  rules: recommendedTypeCheckedRules,
};

export default plugin;
export { rules, recommendations };
