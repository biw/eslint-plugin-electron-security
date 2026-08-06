import { TSESTree } from '@typescript-eslint/utils';

import { getRecommendationByRuleId } from '../recommendations';
import { createRule } from '../utils/create-rule';
import { collectElectronBindings, isElectronWindowNewExpression } from '../utils/electron';
import { resolveWindowOption, resolveWindowOptionsObject } from '../utils/resolve';

const recommendation = getRecommendationByRuleId('no-enable-blink-features');

export default createRule({
  name: 'no-enable-blink-features',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow enableBlinkFeatures in Electron window option bags.',
    },
    messages: {
      blinkFeatures: `Electron recommendation ${recommendation.number} (${recommendation.title}) forbids "enableBlinkFeatures".`,
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    let bindings = collectElectronBindings(context.sourceCode.ast);
    const reported = new Set<TSESTree.Node>();

    return {
      Program(node) {
        bindings = collectElectronBindings(node);
      },
      NewExpression(node) {
        if (!isElectronWindowNewExpression(node, bindings)) {
          return;
        }

        const options = resolveWindowOptionsObject(context.sourceCode, node);

        if (!options) {
          return;
        }

        const resolution = resolveWindowOption(context.sourceCode, options, 'enableBlinkFeatures');

        if (resolution.kind === 'found' && !reported.has(resolution.node)) {
          reported.add(resolution.node);
          context.report({
            node: resolution.node,
            messageId: 'blinkFeatures',
          });
        }
      },
    };
  },
});
