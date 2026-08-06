import { getRecommendationByRuleId } from '../recommendations';
import { createRule } from '../utils/create-rule';
import { createWindowOptionVisitor } from '../utils/window-option-rule';

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
    return createWindowOptionVisitor(context, {
      optionNames: ['allowRunningInsecureContent'],
      unsafeValue: true,
      messageId: 'insecureContent',
    });
  },
});
