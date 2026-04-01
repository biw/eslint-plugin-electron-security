import { getRecommendationByRuleId } from '../recommendations';
import { createRule } from '../utils/create-rule';
import { findWindowOptionValue, getStaticBooleanValue } from '../utils/ast';
import { collectElectronBindings, getWindowOptionsObject, isElectronWindowNewExpression } from '../utils/electron';

const recommendation = getRecommendationByRuleId('no-allow-running-insecure-content');

export default createRule({
  name: 'no-allow-running-insecure-content',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow allowRunningInsecureContent: true in Electron window option bags.',
    },
    messages: {
      insecureContent: `Electron recommendation ${recommendation.number} (${recommendation.title}) forbids "allowRunningInsecureContent: true".`,
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    let bindings = collectElectronBindings(context.sourceCode.ast);

    return {
      Program(node) {
        bindings = collectElectronBindings(node);
      },
      NewExpression(node) {
        if (!isElectronWindowNewExpression(node, bindings)) {
          return;
        }

        const options = getWindowOptionsObject(node);
        const value = options ? findWindowOptionValue(options, 'allowRunningInsecureContent') : undefined;

        if (getStaticBooleanValue(value) === true) {
          context.report({
            node: value ?? node,
            messageId: 'insecureContent',
          });
        }
      },
    };
  },
});
