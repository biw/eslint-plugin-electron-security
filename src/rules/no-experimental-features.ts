import { getRecommendationByRuleId } from '../recommendations';
import { createRule } from '../utils/create-rule';
import { findWindowOptionValue, getStaticBooleanValue } from '../utils/ast';
import { collectElectronBindings, getWindowOptionsObject, isElectronWindowNewExpression } from '../utils/electron';

const recommendation = getRecommendationByRuleId('no-experimental-features');

export default createRule({
  name: 'no-experimental-features',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow experimentalFeatures: true in Electron window option bags.',
    },
    messages: {
      experimentalFeatures: `Electron recommendation ${recommendation.number} (${recommendation.title}) forbids "experimentalFeatures: true".`,
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
        const value = options ? findWindowOptionValue(options, 'experimentalFeatures') : undefined;

        if (getStaticBooleanValue(value) === true) {
          context.report({
            node: value ?? node,
            messageId: 'experimentalFeatures',
          });
        }
      },
    };
  },
});
