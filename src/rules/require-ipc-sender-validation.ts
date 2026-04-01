import { AST_NODE_TYPES, TSESLint, TSESTree } from '@typescript-eslint/utils';

import { getRecommendationByRuleId } from '../recommendations';
import { createRule } from '../utils/create-rule';
import { collectElectronBindings, getMemberPropertyName, isIpcMainExpression } from '../utils/electron';
import { FunctionLike, resolveFunctionLike, walkFunctionBody, walkNodes } from '../utils/functions';

const recommendation = getRecommendationByRuleId('require-ipc-sender-validation');
const IPC_MAIN_METHODS = new Set(['handle', 'handleOnce', 'on', 'once']);
const VALIDATION_CALLEE_RE = /^(assert|authorize|check|ensure|guard|validate|verify)/i;
const SENDER_PROPERTIES = new Set(['frameId', 'processId', 'sender', 'senderFrame']);

function referencesSenderMetadata(node: TSESTree.Node, eventParamName: string): boolean {
  if (node.type === AST_NODE_TYPES.MemberExpression) {
    const propertyName = getMemberPropertyName(node);

    if (
      propertyName &&
      SENDER_PROPERTIES.has(propertyName) &&
      node.object.type === AST_NODE_TYPES.Identifier &&
      node.object.name === eventParamName
    ) {
      return true;
    }

    return referencesSenderMetadata(node.object, eventParamName);
  }

  if (node.type === AST_NODE_TYPES.ChainExpression) {
    return referencesSenderMetadata(node.expression, eventParamName);
  }

  return false;
}

function hasVisibleSenderValidation(
  functionNode: FunctionLike,
  sourceCode: Readonly<TSESLint.SourceCode>,
  eventParamName: string,
): boolean {
  let validated = false;

  walkFunctionBody(sourceCode, functionNode, (candidate) => {
    if (validated) {
      return;
    }

    if (candidate.type === AST_NODE_TYPES.CallExpression) {
      const calleeName =
        candidate.callee.type === AST_NODE_TYPES.Identifier
          ? candidate.callee.name
          : candidate.callee.type === AST_NODE_TYPES.MemberExpression
            ? getMemberPropertyName(candidate.callee)
            : undefined;

      if (calleeName && VALIDATION_CALLEE_RE.test(calleeName)) {
        for (const argument of candidate.arguments) {
          if (argument.type === AST_NODE_TYPES.SpreadElement) {
            continue;
          }

          if (
            (argument.type === AST_NODE_TYPES.Identifier && argument.name === eventParamName) ||
            (argument.type === AST_NODE_TYPES.MemberExpression &&
              argument.object.type === AST_NODE_TYPES.Identifier &&
              argument.object.name === eventParamName &&
              SENDER_PROPERTIES.has(getMemberPropertyName(argument) ?? ''))
          ) {
            validated = true;
            return;
          }
        }
      }
    }

    if (
      candidate.type === AST_NODE_TYPES.IfStatement ||
      candidate.type === AST_NODE_TYPES.ConditionalExpression ||
      candidate.type === AST_NODE_TYPES.SwitchStatement
    ) {
      const test = candidate.type === AST_NODE_TYPES.SwitchStatement ? candidate.discriminant : candidate.test;

      walkNodes(sourceCode, test, (testNode) => {
        if (!validated && referencesSenderMetadata(testNode, eventParamName)) {
          validated = true;
        }
      });
    }

  });

  return validated;
}

export default createRule({
  name: 'require-ipc-sender-validation',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require ipcMain handlers to visibly validate the sender before processing messages.',
    },
    messages: {
      missingSenderValidation: `Electron recommendation ${recommendation.number} (${recommendation.title}) requires ipcMain handlers to validate the sender before handling messages.`,
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
      CallExpression(node) {
        if (node.callee.type !== AST_NODE_TYPES.MemberExpression) {
          return;
        }

        const methodName = getMemberPropertyName(node.callee);
        const callbackArgument = node.arguments[1];

        if (
          !methodName ||
          !IPC_MAIN_METHODS.has(methodName) ||
          !isIpcMainExpression(node.callee.object, bindings) ||
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
          !hasVisibleSenderValidation(callback, context.sourceCode, eventParam.name)
        ) {
          context.report({
            node: callbackArgument,
            messageId: 'missingSenderValidation',
          });
        }
      },
    };
  },
});
