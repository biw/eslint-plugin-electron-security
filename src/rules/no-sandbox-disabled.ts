import { getRecommendationByRuleId } from '../recommendations';
import { createRule } from '../utils/create-rule';
import { createWindowOptionVisitor } from '../utils/window-option-rule';

const recommendation = getRecommendationByRuleId('no-sandbox-disabled');

export default createRule({
  name: 'no-sandbox-disabled',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow sandbox: false in Electron window option bags.',
    },
    messages: {
      disabledSandbox: `Electron recommendation ${recommendation.number} (${recommendation.title}) forbids "sandbox: false".`,
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return createWindowOptionVisitor(context, {
      optionNames: ['sandbox'],
      unsafeValue: false,
      messageId: 'disabledSandbox',
    });
  },
});
