import { AST_NODE_TYPES, TSESLint, TSESTree } from '@typescript-eslint/utils';

import { getStaticStringValue } from '../utils/ast';
import { createRule } from '../utils/create-rule';
import { getMemberPropertyName } from '../utils/electron';
import { FunctionLike, resolveFunctionLike, walkFunctionBody } from '../utils/functions';
import { getRecommendationByRuleId } from '../recommendations';

const recommendation = getRecommendationByRuleId('require-navigation-allowlist');
const LISTENER_METHODS = new Set(['addListener', 'on', 'once']);

function hasPreventDefault(
  functionNode: FunctionLike,
  eventParamName: string,
  sourceCode: Readonly<TSESLint.SourceCode>,
): boolean {
  let prevented = false;

  walkFunctionBody(sourceCode, functionNode, (candidate) => {
    if (prevented || candidate.type !== AST_NODE_TYPES.CallExpression) {
      return;
    }

    if (candidate.callee.type !== AST_NODE_TYPES.MemberExpression) {
      return;
    }

    if (
      candidate.callee.object.type === AST_NODE_TYPES.Identifier &&
      candidate.callee.object.name === eventParamName &&
      getMemberPropertyName(candidate.callee) === 'preventDefault'
    ) {
      prevented = true;
    }
  });

  return prevented;
}

export default createRule({
  name: 'require-navigation-allowlist',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require will-navigate handlers to actively block navigation with event.preventDefault().',
    },
    messages: {
      unsafeNavigationHandler: `Electron recommendation ${recommendation.number} (${recommendation.title}) requires will-navigate handlers to explicitly block navigation before allowlisting it.`,
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== AST_NODE_TYPES.MemberExpression) {
          return;
        }

        const listenerMethod = getMemberPropertyName(node.callee);
        const eventName = getStaticStringValue(node.arguments[0] ?? null);
        const callbackArgument = node.arguments[1];

        if (
          !listenerMethod ||
          !LISTENER_METHODS.has(listenerMethod) ||
          eventName !== 'will-navigate' ||
          !callbackArgument ||
          callbackArgument.type === AST_NODE_TYPES.SpreadElement
        ) {
          return;
        }

        const callback = resolveFunctionLike(context.sourceCode, callbackArgument);
        const eventParam = callback?.params[0];

        if (
          !callback ||
          !eventParam ||
          eventParam.type !== AST_NODE_TYPES.Identifier ||
          !hasPreventDefault(callback, eventParam.name, context.sourceCode)
        ) {
          context.report({
            node: callbackArgument,
            messageId: 'unsafeNavigationHandler',
          });
        }
      },
    };
  },
});
