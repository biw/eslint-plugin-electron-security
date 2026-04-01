import { AST_NODE_TYPES, TSESLint, TSESTree } from '@typescript-eslint/utils';

import { getStaticStringValue } from '../utils/ast';
import { createRule } from '../utils/create-rule';
import { getMemberPropertyName } from '../utils/electron';
import { FunctionLike, resolveFunctionLike, walkFunctionBody, walkNodes } from '../utils/functions';
import { getRecommendationByRuleId } from '../recommendations';

const recommendation = getRecommendationByRuleId('require-safe-webview-attachment');
const LISTENER_METHODS = new Set(['addListener', 'on', 'once']);
const VALIDATION_CALLEE_RE = /^(assert|check|guard|sanitize|validate|verify)/i;

function isLiteralBoolean(
  node: TSESTree.Expression,
  expected: boolean,
): boolean {
  return node.type === AST_NODE_TYPES.Literal && node.value === expected;
}

function isIdentifierNamed(node: TSESTree.Node, name: string): node is TSESTree.Identifier {
  return node.type === AST_NODE_TYPES.Identifier && node.name === name;
}

function isGuardLikeCallName(name: string | undefined): boolean {
  return Boolean(name && VALIDATION_CALLEE_RE.test(name));
}

function referencesParamsSrc(
  node: TSESTree.Node,
  paramsParamName: string,
): boolean {
  if (node.type === AST_NODE_TYPES.MemberExpression) {
    if (
      isIdentifierNamed(node.object, paramsParamName) &&
      getMemberPropertyName(node) === 'src'
    ) {
      return true;
    }

    return referencesParamsSrc(node.object, paramsParamName);
  }

  if (node.type === AST_NODE_TYPES.ChainExpression) {
    return referencesParamsSrc(node.expression, paramsParamName);
  }

  return false;
}

function hasAttachBlockOrSanitization(
  functionNode: FunctionLike,
  sourceCode: Readonly<TSESLint.SourceCode>,
  eventParamName: string | undefined,
  webPreferencesParamName: string | undefined,
  paramsParamName: string | undefined,
): boolean {
  let blocksAttach = false;
  let sanitizesPreferences = false;
  let validatesSrc = false;

  walkFunctionBody(sourceCode, functionNode, (candidate) => {
    if (blocksAttach || (sanitizesPreferences && validatesSrc)) {
      return;
    }

    if (
      eventParamName &&
      candidate.type === AST_NODE_TYPES.CallExpression &&
      candidate.callee.type === AST_NODE_TYPES.MemberExpression &&
      isIdentifierNamed(candidate.callee.object, eventParamName) &&
      getMemberPropertyName(candidate.callee) === 'preventDefault'
    ) {
      blocksAttach = true;
      return;
    }

    if (
      candidate.type === AST_NODE_TYPES.CallExpression &&
      isGuardLikeCallName(
        candidate.callee.type === AST_NODE_TYPES.Identifier
          ? candidate.callee.name
          : candidate.callee.type === AST_NODE_TYPES.MemberExpression
            ? getMemberPropertyName(candidate.callee)
            : undefined,
      )
    ) {
      for (const argument of candidate.arguments) {
        if (argument.type === AST_NODE_TYPES.SpreadElement) {
          continue;
        }

        if (
          webPreferencesParamName &&
          argument.type === AST_NODE_TYPES.Identifier &&
          argument.name === webPreferencesParamName
        ) {
          sanitizesPreferences = true;
        }

        if (
          paramsParamName &&
          argument.type === AST_NODE_TYPES.Identifier &&
          argument.name === paramsParamName
        ) {
          validatesSrc = true;
        }
      }
    }

    if (
      webPreferencesParamName &&
      candidate.type === AST_NODE_TYPES.AssignmentExpression &&
      candidate.left.type === AST_NODE_TYPES.MemberExpression &&
      isIdentifierNamed(candidate.left.object, webPreferencesParamName)
    ) {
      const propertyName = getMemberPropertyName(candidate.left);
      if (
        (propertyName === 'nodeIntegration' ||
          propertyName === 'nodeIntegrationInSubFrames' ||
          propertyName === 'nodeIntegrationInWorker' ||
          propertyName === 'allowRunningInsecureContent' ||
          propertyName === 'allowpopups') &&
        isLiteralBoolean(candidate.right, false)
      ) {
        sanitizesPreferences = true;
        return;
      }

      if (
        (propertyName === 'contextIsolation' ||
          propertyName === 'sandbox' ||
          propertyName === 'webSecurity') &&
        isLiteralBoolean(candidate.right, true)
      ) {
        sanitizesPreferences = true;
        return;
      }

      return;
    }

    if (
      paramsParamName &&
      candidate.type === AST_NODE_TYPES.AssignmentExpression &&
      candidate.left.type === AST_NODE_TYPES.MemberExpression &&
      isIdentifierNamed(candidate.left.object, paramsParamName) &&
      getMemberPropertyName(candidate.left) === 'src' &&
      getStaticStringValue(candidate.right) !== undefined
    ) {
      validatesSrc = true;
      return;
    }

    if (
      paramsParamName &&
      (candidate.type === AST_NODE_TYPES.IfStatement ||
        candidate.type === AST_NODE_TYPES.ConditionalExpression ||
        candidate.type === AST_NODE_TYPES.SwitchStatement)
    ) {
      const test =
        candidate.type === AST_NODE_TYPES.SwitchStatement
          ? candidate.discriminant
          : candidate.test;

      walkNodes(sourceCode, test, (testNode) => {
        if (!validatesSrc && referencesParamsSrc(testNode, paramsParamName)) {
          validatesSrc = true;
        }
      });
      return;
    }

    if (
      webPreferencesParamName &&
      candidate.type === AST_NODE_TYPES.UnaryExpression &&
      candidate.operator === 'delete' &&
      candidate.argument.type === AST_NODE_TYPES.MemberExpression &&
      isIdentifierNamed(candidate.argument.object, webPreferencesParamName) &&
      getMemberPropertyName(candidate.argument) === 'preload'
    ) {
      return;
    }
  });

  return blocksAttach || (sanitizesPreferences && validatesSrc);
}

export default createRule({
  name: 'require-safe-webview-attachment',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require will-attach-webview handlers to block the attach or sanitize webPreferences / src before allowing it.',
    },
    messages: {
      unsafeWebviewAttachment: `Electron recommendation ${recommendation.number} (${recommendation.title}) requires will-attach-webview handlers to block unsafe attachments or sanitize the incoming options.`,
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
        const staticEventName =
          node.arguments[0] && node.arguments[0].type !== AST_NODE_TYPES.SpreadElement
            ? getStaticStringValue(node.arguments[0])
            : undefined;
        const callbackArgument = node.arguments[1];

        if (
          !listenerMethod ||
          !LISTENER_METHODS.has(listenerMethod) ||
          staticEventName !== 'will-attach-webview' ||
          !callbackArgument ||
          callbackArgument.type === AST_NODE_TYPES.SpreadElement
        ) {
          return;
        }

        const callback = resolveFunctionLike(context.sourceCode, callbackArgument);

        if (!callback) {
          return;
        }

        const eventParam = callback.params[0];
        const webPreferencesParam = callback.params[1];
        const paramsParam = callback.params[2];

        const eventParamName = eventParam?.type === AST_NODE_TYPES.Identifier ? eventParam.name : undefined;
        const webPreferencesParamName =
          webPreferencesParam?.type === AST_NODE_TYPES.Identifier ? webPreferencesParam.name : undefined;
        const paramsParamName = paramsParam?.type === AST_NODE_TYPES.Identifier ? paramsParam.name : undefined;

        if (
          !hasAttachBlockOrSanitization(
            callback,
            context.sourceCode,
            eventParamName,
            webPreferencesParamName,
            paramsParamName,
          )
        ) {
          context.report({
            node: callbackArgument,
            messageId: 'unsafeWebviewAttachment',
          });
        }
      },
    };
  },
});
