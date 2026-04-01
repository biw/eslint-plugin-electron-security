import { getRecommendationByRuleId } from '../recommendations';
import { createRule } from '../utils/create-rule';
import { findWindowOptionValue } from '../utils/ast';
import { collectElectronBindings, getWindowOptionsObject, isElectronWindowNewExpression } from '../utils/electron';

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

    return {
      Program(node) {
        bindings = collectElectronBindings(node);
      },
      NewExpression(node) {
        if (!isElectronWindowNewExpression(node, bindings)) {
          return;
        }

        const options = getWindowOptionsObject(node);
        const value = options ? findWindowOptionValue(options, 'enableBlinkFeatures') : undefined;

        if (value) {
          context.report({
            node: value,
            messageId: 'blinkFeatures',
          });
        }
      },
    };
  },
});
