import { getRecommendationByRuleId } from '../recommendations';
import { createRule } from '../utils/create-rule';
import { getJsxAttribute, getStaticJsxBooleanValue, isWebViewElement } from '../utils/ast';
import { createWindowOptionVisitor } from '../utils/window-option-rule';

const recommendation = getRecommendationByRuleId('no-web-security-disabled');

export default createRule({
  name: 'no-web-security-disabled',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow webSecurity: false and disablewebsecurity on webview tags.',
    },
    messages: {
      disabledWebSecurity: `Electron recommendation ${recommendation.number} (${recommendation.title}) forbids disabling web security.`,
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      ...createWindowOptionVisitor(context, {
        optionNames: ['webSecurity'],
        unsafeValue: false,
        messageId: 'disabledWebSecurity',
      }),
      JSXOpeningElement(node) {
        if (!isWebViewElement(node)) {
          return;
        }

        const attribute = getJsxAttribute(node, 'disablewebsecurity');
        if (getStaticJsxBooleanValue(attribute) === true) {
          context.report({
            node: attribute ?? node,
            messageId: 'disabledWebSecurity',
          });
        }
      },
    };
  },
});
