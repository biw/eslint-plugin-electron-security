import { getRecommendationByRuleId } from '../recommendations';
import { createRule } from '../utils/create-rule';
import { getJsxAttribute, getStaticJsxBooleanValue, isWebViewElement } from '../utils/ast';

const recommendation = getRecommendationByRuleId('no-webview-allowpopups');

export default createRule({
  name: 'no-webview-allowpopups',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow allowpopups on webview tags.',
    },
    messages: {
      allowpopups: `Electron recommendation ${recommendation.number} (${recommendation.title}) forbids allowpopups on <webview>.`,
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (!isWebViewElement(node)) {
          return;
        }

        const attribute = getJsxAttribute(node, 'allowpopups');

        if (getStaticJsxBooleanValue(attribute) === true) {
          context.report({
            node: attribute ?? node,
            messageId: 'allowpopups',
          });
        }
      },
    };
  },
});
