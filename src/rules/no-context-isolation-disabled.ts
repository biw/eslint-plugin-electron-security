import { getRecommendationByRuleId } from '../recommendations';
import { createRule } from '../utils/create-rule';
import { createWindowOptionVisitor } from '../utils/window-option-rule';

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
    return createWindowOptionVisitor(context, {
      optionNames: ['contextIsolation'],
      unsafeValue: false,
      messageId: 'disabledContextIsolation',
    });
  },
});
