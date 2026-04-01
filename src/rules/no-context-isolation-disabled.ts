import { getRecommendationByRuleId } from '../recommendations';
import { createRule } from '../utils/create-rule';
import { findWindowOptionValue, getStaticBooleanValue } from '../utils/ast';
import { collectElectronBindings, getWindowOptionsObject, isElectronWindowNewExpression } from '../utils/electron';

const recommendation = getRecommendationByRuleId('no-context-isolation-disabled');

export default createRule({
  name: 'no-context-isolation-disabled',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow contextIsolation: false in Electron window option bags.',
    },
    messages: {
      disabledContextIsolation: `Electron recommendation ${recommendation.number} (${recommendation.title}) forbids "contextIsolation: false".`,
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
        const value = options ? findWindowOptionValue(options, 'contextIsolation') : undefined;

        if (getStaticBooleanValue(value) === false) {
          context.report({
            node: value ?? node,
            messageId: 'disabledContextIsolation',
          });
        }
      },
    };
  },
});
