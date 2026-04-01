import { getRecommendationByRuleId } from '../recommendations';
import { createRule } from '../utils/create-rule';
import {
  findWindowOptionValue,
  getJsxAttribute,
  getStaticBooleanValue,
  getStaticJsxBooleanValue,
  isWebViewElement,
} from '../utils/ast';
import { collectElectronBindings, getWindowOptionsObject, isElectronWindowNewExpression } from '../utils/electron';

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
        const value = options ? findWindowOptionValue(options, 'webSecurity') : undefined;

        if (getStaticBooleanValue(value) === false) {
          context.report({
            node: value ?? node,
            messageId: 'disabledWebSecurity',
          });
        }
      },
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
