import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';

import { getRecommendationByRuleId } from '../recommendations';
import { createRule } from '../utils/create-rule';
import {
  collectElectronBindings,
  isElectronApiExpression,
  getMemberPropertyName,
  isContextBridgeExposeCall,
  isIpcRendererExpression,
} from '../utils/electron';
import {
  FunctionLike,
  getDeclarationNode,
  isFunctionLike,
  resolveFunctionLike,
  unwrapExpression,
  walkNodes,
} from '../utils/functions';

const recommendation = getRecommendationByRuleId('no-raw-electron-api-exposure');
const IPC_RENDERER_EVENT_METHODS = new Set(['addListener', 'on', 'once']);

type UnsafeExposureNode = TSESTree.Expression | FunctionLike;

export default createRule({
  name: 'no-raw-electron-api-exposure',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow exposing raw Electron renderer APIs or IPC event objects through contextBridge.',
    },
    messages: {
      rawElectronApi: `Electron recommendation ${recommendation.number} (${recommendation.title}) forbids exposing raw Electron APIs to renderer code.`,
      rawIpcEvent: `Electron recommendation ${recommendation.number} (${recommendation.title}) forbids passing the raw IPC event object through preload wrappers.`,
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    let bindings = collectElectronBindings(context.sourceCode.ast);

    function innerCallbackLeaksRawEvent(
      callbackNode: FunctionLike,
      callbackParamNames: Set<string>,
    ): boolean {
      const eventParam = callbackNode.params[0];

      if (!eventParam || eventParam.type !== AST_NODE_TYPES.Identifier) {
        return false;
      }

      let leaked = false;

      walkNodes(context.sourceCode, callbackNode.body, (candidate) => {
        if (leaked || candidate.type !== AST_NODE_TYPES.CallExpression) {
          return;
        }

        if (
          candidate.callee.type === AST_NODE_TYPES.Identifier &&
          callbackParamNames.has(candidate.callee.name) &&
          candidate.arguments[0]?.type === AST_NODE_TYPES.Identifier &&
          candidate.arguments[0].name === eventParam.name
        ) {
          leaked = true;
        }
      });

      return leaked;
    }

    function functionLeaksRawEvent(node: FunctionLike): boolean {
      const callbackParamNames = new Set(
        node.params
          .filter((param): param is TSESTree.Identifier => param.type === AST_NODE_TYPES.Identifier)
          .map((param) => param.name),
      );

      if (callbackParamNames.size === 0) {
        return false;
      }

      let leaked = false;

      walkNodes(context.sourceCode, node.body, (candidate) => {
        if (leaked || candidate.type !== AST_NODE_TYPES.CallExpression) {
          return;
        }

        if (candidate.callee.type !== AST_NODE_TYPES.MemberExpression) {
          return;
        }

        const methodName = getMemberPropertyName(candidate.callee);

        if (
          !methodName ||
          !IPC_RENDERER_EVENT_METHODS.has(methodName) ||
          !isIpcRendererExposure(candidate.callee.object) ||
          candidate.arguments.length < 2
        ) {
          return;
        }

        const callbackNode = resolveFunctionLike(context.sourceCode, candidate.arguments[1] as TSESTree.Expression);

        if (callbackNode && innerCallbackLeaksRawEvent(callbackNode, callbackParamNames)) {
          leaked = true;
        }
      });

      return leaked;
    }

    function isIpcRendererExposure(node: TSESTree.Expression): boolean {
      return collectUnsafeExposureNodes(node).length > 0;
    }

    function collectUnsafeExposureNodes(
      node: TSESTree.Expression,
      seenDeclarations = new Set<TSESTree.Node>(),
    ): UnsafeExposureNode[] {
      const expression = unwrapExpression(node);

      if (isElectronApiExpression(expression, bindings)) {
        return [expression];
      }

      switch (expression.type) {
        case AST_NODE_TYPES.Identifier: {
          const declaration = getDeclarationNode(context.sourceCode, expression);

          if (!declaration || seenDeclarations.has(declaration)) {
            return [];
          }

          const nextSeen = new Set(seenDeclarations);
          nextSeen.add(declaration);

          if (
            declaration.type === AST_NODE_TYPES.VariableDeclarator &&
            declaration.init
          ) {
            return collectUnsafeExposureNodes(declaration.init, nextSeen);
          }

          if (isFunctionLike(declaration)) {
            return functionLeaksRawEvent(declaration) ? [expression] : [];
          }

          return [];
        }

        case AST_NODE_TYPES.MemberExpression:
          return collectUnsafeExposureNodes(expression.object, seenDeclarations).length > 0
            ? [expression]
            : [];

        case AST_NODE_TYPES.CallExpression: {
          if (
            expression.callee.type === AST_NODE_TYPES.MemberExpression &&
            getMemberPropertyName(expression.callee) === 'bind' &&
            collectUnsafeExposureNodes(expression.callee.object, seenDeclarations).length > 0
          ) {
            return [expression];
          }

          return [];
        }

        case AST_NODE_TYPES.ObjectExpression: {
          const findings: UnsafeExposureNode[] = [];

          for (const property of expression.properties) {
            if (
              property.type !== AST_NODE_TYPES.Property ||
              property.kind !== 'init' ||
              property.computed ||
              property.value.type === AST_NODE_TYPES.AssignmentPattern ||
              property.value.type === AST_NODE_TYPES.TSEmptyBodyFunctionExpression
            ) {
              continue;
            }

            const nestedFindings = collectUnsafeExposureNodes(property.value, seenDeclarations);

            if (nestedFindings.length > 0) {
              const functionFindings = nestedFindings.filter(isFunctionLike);

              if (functionFindings.length > 0) {
                findings.push(...functionFindings);
              } else {
                findings.push(property.value);
              }
            }
          }

          return findings;
        }

        case AST_NODE_TYPES.ArrowFunctionExpression:
        case AST_NODE_TYPES.FunctionExpression:
          return functionLeaksRawEvent(expression) ? [expression] : [];

        default:
          return [];
      }
    }

    return {
      Program(node) {
        bindings = collectElectronBindings(node);
      },
      CallExpression(node) {
        if (!isContextBridgeExposeCall(node, bindings)) {
          return;
        }

        const exposedValue = node.arguments[1];

        if (!exposedValue || exposedValue.type === AST_NODE_TYPES.SpreadElement) {
          return;
        }
        const findings = collectUnsafeExposureNodes(exposedValue);

        for (const finding of findings) {
          const messageId = isFunctionLike(finding) ? 'rawIpcEvent' : 'rawElectronApi';

          context.report({
            node: finding,
            messageId,
          });
        }
      },
    };
  },
});
