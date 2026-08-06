import { AST_NODE_TYPES, TSESLint, TSESTree } from '@typescript-eslint/utils';

import { getRecommendationByRuleId } from '../recommendations';
import { createRule } from '../utils/create-rule';
import {
  getJsxAttribute,
  getStaticJsxBooleanValue,
  getStaticJsxStringValue,
  getStaticStringValue,
  isWebViewElement,
} from '../utils/ast';
import { collectElectronBindings, isElectronWindowNewExpression } from '../utils/electron';
import { resolveWindowOptionBoolean, resolveWindowOptionsObject } from '../utils/resolve';
import { isRemoteUrl } from '../utils/url';

const recommendation = getRecommendationByRuleId('no-node-integration-for-remote-content');
const REMOTE_NODE_OPTIONS = [
  'nodeIntegration',
  'nodeIntegrationInSubFrames',
  'nodeIntegrationInWorker',
] as const;

function getUnsafeNodeIntegrationNode(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.NewExpression,
): TSESTree.Node | undefined {
  const options = resolveWindowOptionsObject(sourceCode, node);

  if (!options) {
    return undefined;
  }

  for (const optionName of REMOTE_NODE_OPTIONS) {
    const resolved = resolveWindowOptionBoolean(sourceCode, options, optionName);

    if (resolved?.value === true) {
      return resolved.node;
    }
  }

  return undefined;
}

function getTrackedUnsafeNode(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.Expression,
  trackedWindows: Map<string, TSESTree.Node>,
  bindings: ReturnType<typeof collectElectronBindings>,
): TSESTree.Node | undefined {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return trackedWindows.get(node.name);
  }

  if (node.type === AST_NODE_TYPES.NewExpression && isElectronWindowNewExpression(node, bindings)) {
    return getUnsafeNodeIntegrationNode(sourceCode, node);
  }

  if (
    node.type === AST_NODE_TYPES.MemberExpression &&
    !node.computed &&
    node.property.type === AST_NODE_TYPES.Identifier &&
    node.property.name === 'webContents'
  ) {
    const owner = node.object;
    if (owner.type === AST_NODE_TYPES.Identifier) {
      return trackedWindows.get(owner.name);
    }

    if (owner.type === AST_NODE_TYPES.NewExpression && isElectronWindowNewExpression(owner, bindings)) {
      return getUnsafeNodeIntegrationNode(sourceCode, owner);
    }
  }

  return undefined;
}

export default createRule({
  name: 'no-node-integration-for-remote-content',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow Node.js integration when the same file loads remote content.',
    },
    messages: {
      remoteNodeIntegration: `Electron recommendation ${recommendation.number} (${recommendation.title}) forbids enabling Node.js integration for remote content.`,
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    let bindings = collectElectronBindings(context.sourceCode.ast);
    const trackedWindows = new Map<string, TSESTree.Node>();
    const reportedNodes = new Set<TSESTree.Node>();

    return {
      Program(node) {
        bindings = collectElectronBindings(node);
      },
      VariableDeclarator(node) {
        if (
          node.id.type !== AST_NODE_TYPES.Identifier ||
          node.init?.type !== AST_NODE_TYPES.NewExpression ||
          !isElectronWindowNewExpression(node.init, bindings)
        ) {
          return;
        }

        const unsafeNode = getUnsafeNodeIntegrationNode(context.sourceCode, node.init);
        if (unsafeNode) {
          trackedWindows.set(node.id.name, unsafeNode);
        }
      },
      AssignmentExpression(node) {
        if (
          node.operator !== '=' ||
          node.left.type !== AST_NODE_TYPES.Identifier ||
          node.right.type !== AST_NODE_TYPES.NewExpression ||
          !isElectronWindowNewExpression(node.right, bindings)
        ) {
          return;
        }

        const unsafeNode = getUnsafeNodeIntegrationNode(context.sourceCode, node.right);
        if (unsafeNode) {
          trackedWindows.set(node.left.name, unsafeNode);
        }
      },
      CallExpression(node) {
        if (
          node.callee.type !== AST_NODE_TYPES.MemberExpression ||
          node.callee.computed ||
          node.callee.property.type !== AST_NODE_TYPES.Identifier ||
          node.callee.property.name !== 'loadURL'
        ) {
          return;
        }

        const url = getStaticStringValue(node.arguments[0] ?? null);
        if (!url || !isRemoteUrl(url)) {
          return;
        }

        const unsafeNode = getTrackedUnsafeNode(context.sourceCode, node.callee.object, trackedWindows, bindings);

        if (unsafeNode && !reportedNodes.has(unsafeNode)) {
          reportedNodes.add(unsafeNode);
          context.report({
            node: unsafeNode,
            messageId: 'remoteNodeIntegration',
          });
        }
      },
      JSXOpeningElement(node) {
        if (!isWebViewElement(node)) {
          return;
        }

        const src = getStaticJsxStringValue(getJsxAttribute(node, 'src'));
        const nodeIntegration = getStaticJsxBooleanValue(getJsxAttribute(node, 'nodeintegration'));

        if (src && isRemoteUrl(src) && nodeIntegration === true) {
          context.report({
            node: getJsxAttribute(node, 'nodeintegration') ?? node,
            messageId: 'remoteNodeIntegration',
          });
        }
      },
    };
  },
});
