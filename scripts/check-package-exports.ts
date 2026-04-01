import { createRequire } from 'node:module';

import { recommendedRuleIds, recommendedTypeCheckedRuleIds } from '../src/recommendations';

const require = createRequire(import.meta.url);
const exported = require('../dist/index.cjs');
const plugin = exported.default ?? exported;

if (!plugin || typeof plugin !== 'object') {
  throw new Error('dist/index.cjs did not export a plugin object.');
}

if (!plugin.rules || typeof plugin.rules !== 'object') {
  throw new Error('Plugin is missing rules export.');
}

if (!plugin.configs?.recommended) {
  throw new Error('Plugin is missing recommended config export.');
}

const exportedRuleIds = Object.keys(plugin.rules).sort();
const expectedRuleIds = [...recommendedRuleIds, ...recommendedTypeCheckedRuleIds].sort();

if (JSON.stringify(exportedRuleIds) !== JSON.stringify(expectedRuleIds)) {
  throw new Error(
    `Exported rule ids do not match metadata.\nExpected: ${expectedRuleIds.join(', ')}\nReceived: ${exportedRuleIds.join(', ')}`,
  );
}

const enabledRules = Object.keys(plugin.configs.recommended.rules ?? {}).sort();
const expectedEnabledRules = recommendedRuleIds.map((ruleId) => `electron-security/${ruleId}`).sort();

if (JSON.stringify(enabledRules) !== JSON.stringify(expectedEnabledRules)) {
  throw new Error(
    `Recommended config drift detected.\nExpected: ${expectedEnabledRules.join(', ')}\nReceived: ${enabledRules.join(', ')}`,
  );
}

const typeCheckedEnabledRules = Object.keys(plugin.configs['recommended-type-checked'].rules ?? {}).sort();
const expectedTypeCheckedRules = recommendedTypeCheckedRuleIds
  .map((ruleId) => `electron-security/${ruleId}`)
  .sort();

if (JSON.stringify(typeCheckedEnabledRules) !== JSON.stringify(expectedTypeCheckedRules)) {
  throw new Error(
    `Recommended type-checked config drift detected.\nExpected: ${expectedTypeCheckedRules.join(', ')}\nReceived: ${typeCheckedEnabledRules.join(', ')}`,
  );
}
