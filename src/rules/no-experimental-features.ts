import { getRecommendationByRuleId } from '../recommendations';
import { createRule } from '../utils/create-rule';
import { createWindowOptionVisitor } from '../utils/window-option-rule';

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
    return createWindowOptionVisitor(context, {
      optionNames: ['experimentalFeatures'],
      unsafeValue: true,
      messageId: 'experimentalFeatures',
    });
  },
});
