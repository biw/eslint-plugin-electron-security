import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';

import { getRecommendationByRuleId } from '../recommendations';
import { createRule } from '../utils/create-rule';
import {
  getJsxAttribute,
  getStaticJsxStringValue,
  getStaticStringValue,
  isWebViewElement,
} from '../utils/ast';
import { collectElectronBindings, isElectronWindowNewExpression } from '../utils/electron';

const recommendation = getRecommendationByRuleId('no-file-protocol-load-url');

function isFileProtocol(value: string): boolean {
  try {
    return new URL(value).protocol === 'file:';
  } catch {
    return false;
  }
}

function isTrackedLoadUrlCall(
  node: TSESTree.CallExpression,
  trackedWindows: Set<string>,
  bindings: ReturnType<typeof collectElectronBindings>,
): boolean {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) {
    return false;
  }

  const property =
    !node.callee.computed && node.callee.property.type === AST_NODE_TYPES.Identifier
      ? node.callee.property.name
      : undefined;

  if (property !== 'loadURL') {
    return false;
  }

  const target = node.callee.object;

  if (target.type === AST_NODE_TYPES.Identifier) {
    return trackedWindows.has(target.name);
  }

  if (target.type === AST_NODE_TYPES.NewExpression) {
    return isElectronWindowNewExpression(target, bindings);
  }

  if (
    target.type === AST_NODE_TYPES.MemberExpression &&
    !target.computed &&
    target.property.type === AST_NODE_TYPES.Identifier &&
    target.property.name === 'webContents'
  ) {
    const owner = target.object;

    if (owner.type === AST_NODE_TYPES.Identifier) {
      return trackedWindows.has(owner.name);
    }

    if (owner.type === AST_NODE_TYPES.NewExpression) {
      return isElectronWindowNewExpression(owner, bindings);
    }
  }

  return false;
}

export default createRule({
  name: 'no-file-protocol-load-url',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow file:// literals in Electron loading APIs and webview src attributes.',
    },
    messages: {
      fileProtocol: `Electron recommendation ${recommendation.number} (${recommendation.title}) discourages file:// URLs. Prefer a custom protocol instead.`,
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    let bindings = collectElectronBindings(context.sourceCode.ast);
    const trackedWindows = new Set<string>();

    return {
      Program(node) {
        bindings = collectElectronBindings(node);
      },
      VariableDeclarator(node) {
        if (
          node.id.type === AST_NODE_TYPES.Identifier &&
          node.init?.type === AST_NODE_TYPES.NewExpression &&
          isElectronWindowNewExpression(node.init, bindings)
        ) {
          trackedWindows.add(node.id.name);
        }
      },
      AssignmentExpression(node) {
        if (
          node.operator === '=' &&
          node.left.type === AST_NODE_TYPES.Identifier &&
          node.right.type === AST_NODE_TYPES.NewExpression &&
          isElectronWindowNewExpression(node.right, bindings)
        ) {
          trackedWindows.add(node.left.name);
        }
      },
      CallExpression(node) {
        if (!isTrackedLoadUrlCall(node, trackedWindows, bindings)) {
          return;
        }

        const url = getStaticStringValue(node.arguments[0] ?? null);

        if (url && isFileProtocol(url)) {
          context.report({
            node: node.arguments[0] ?? node,
            messageId: 'fileProtocol',
          });
        }
      },
      JSXOpeningElement(node) {
        if (!isWebViewElement(node)) {
          return;
        }

        const srcAttribute = getJsxAttribute(node, 'src');
        const src = getStaticJsxStringValue(srcAttribute);

        if (src && isFileProtocol(src)) {
          context.report({
            node: srcAttribute ?? node,
            messageId: 'fileProtocol',
          });
        }
      },
    };
  },
});
