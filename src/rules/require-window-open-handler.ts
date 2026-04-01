import { AST_NODE_TYPES, TSESLint, TSESTree } from '@typescript-eslint/utils';

import { getObjectProperty, getStaticStringValue } from '../utils/ast';
import { createRule } from '../utils/create-rule';
import { getMemberPropertyName } from '../utils/electron';
import { FunctionLike, resolveFunctionLike, walkFunctionBody } from '../utils/functions';
import { getRecommendationByRuleId } from '../recommendations';

const recommendation = getRecommendationByRuleId('require-window-open-handler');

function getReturnedActionObjects(
  functionNode: FunctionLike,
  sourceCode: Readonly<TSESLint.SourceCode>,
): TSESTree.ObjectExpression[] {
  const objects: TSESTree.ObjectExpression[] = [];

  if (
    functionNode.type === AST_NODE_TYPES.ArrowFunctionExpression &&
    functionNode.body.type === AST_NODE_TYPES.ObjectExpression
  ) {
    return [functionNode.body];
  }

  walkFunctionBody(sourceCode, functionNode, (candidate) => {
    if (candidate.type !== AST_NODE_TYPES.ReturnStatement || !candidate.argument) {
      return;
    }

    if (candidate.argument.type === AST_NODE_TYPES.ObjectExpression) {
      objects.push(candidate.argument);
    }
  });

  return objects;
}

function getActionValue(node: TSESTree.ObjectExpression): string | undefined {
  const property = getObjectProperty(node, 'action');
  return property ? getStaticStringValue(property.value) : undefined;
}

export default createRule({
  name: 'require-window-open-handler',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow setWindowOpenHandler callbacks that unconditionally return { action: "allow" }.',
    },
    messages: {
      unsafeWindowOpenHandler: `Electron recommendation ${recommendation.number} (${recommendation.title}) requires new-window handling to deny by default or apply an explicit allowlist.`,
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type !== AST_NODE_TYPES.MemberExpression ||
          getMemberPropertyName(node.callee) !== 'setWindowOpenHandler'
        ) {
          return;
        }

        const callbackArgument = node.arguments[0];

        if (!callbackArgument || callbackArgument.type === AST_NODE_TYPES.SpreadElement) {
          return;
        }

        const callback = resolveFunctionLike(context.sourceCode, callbackArgument);

        if (!callback) {
          return;
        }

        const returnedActions = getReturnedActionObjects(callback, context.sourceCode);

        if (returnedActions.length === 0) {
          return;
        }

        const actionValues = returnedActions.map(getActionValue);

        if (actionValues.every((value) => value === 'allow')) {
          context.report({
            node: returnedActions[0] ?? callbackArgument,
            messageId: 'unsafeWindowOpenHandler',
          });
        }
      },
    };
  },
});
