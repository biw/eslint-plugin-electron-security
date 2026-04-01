import parser from '@typescript-eslint/parser';

import { recommendedRuleIds, recommendedTypeCheckedRuleIds } from './recommendations';
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
import requireIpcSenderValidation from './rules/require-ipc-sender-validation';
import requireNavigationAllowlist from './rules/require-navigation-allowlist';
import requireSafeWebviewAttachment from './rules/require-safe-webview-attachment';
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
  'require-ipc-sender-validation': requireIpcSenderValidation,
  'require-navigation-allowlist': requireNavigationAllowlist,
  'require-safe-webview-attachment': requireSafeWebviewAttachment,
  'require-window-open-handler': requireWindowOpenHandler,
};

const recommendedRules = Object.fromEntries(
  recommendedRuleIds.map((ruleId) => [`electron-security/${ruleId}`, 'error'] as const),
);

const recommendedTypeCheckedRules = Object.fromEntries(
  recommendedTypeCheckedRuleIds.map((ruleId) => [`electron-security/${ruleId}`, 'error'] as const),
);

const plugin: any = {
  meta: {
    name: 'eslint-plugin-electron-security',
    version: '0.2.0',
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
