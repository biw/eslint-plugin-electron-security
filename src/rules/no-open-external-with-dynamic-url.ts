import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';

import { getRecommendationByRuleId } from '../recommendations';
import { createRule } from '../utils/create-rule';
import { getStaticStringValue } from '../utils/ast';
import { collectElectronBindings, isShellOpenExternalExpression } from '../utils/electron';
import { getDeclarationNode, unwrapExpression } from '../utils/functions';
import { isSafeExternalUrl } from '../utils/url';

const recommendation = getRecommendationByRuleId('no-open-external-with-dynamic-url');

export default createRule({
  name: 'no-open-external-with-dynamic-url',
  meta: {
    type: 'problem',
    docs: {
      description: 'Require explicit allowlisted literal protocols for shell.openExternal.',
    },
    messages: {
      unsafeOpenExternal: `Electron recommendation ${recommendation.number} (${recommendation.title}) requires shell.openExternal URLs to be explicit literals with allowlisted protocols.`,
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    let bindings = collectElectronBindings(context.sourceCode.ast);

    function getPatternPropertyName(node: TSESTree.Property['key']): string | undefined {
      if (node.type === AST_NODE_TYPES.Identifier) {
        return node.name;
      }

      if (
        node.type === AST_NODE_TYPES.Literal &&
        typeof node.value === 'string'
      ) {
        return node.value;
      }

      return undefined;
    }

    function isShellExpression(
      node: TSESTree.Expression,
      seenDeclarations = new Set<TSESTree.Node>(),
    ): boolean {
      const expression = unwrapExpression(node);

      if (
        expression.type === AST_NODE_TYPES.Identifier &&
        bindings.shell.has(expression.name)
      ) {
        return true;
      }

      if (
        expression.type === AST_NODE_TYPES.MemberExpression &&
        !expression.computed &&
        expression.object.type === AST_NODE_TYPES.Identifier &&
        bindings.namespaces.has(expression.object.name) &&
        expression.property.type === AST_NODE_TYPES.Identifier &&
        expression.property.name === 'shell'
      ) {
        return true;
      }

      if (expression.type !== AST_NODE_TYPES.Identifier) {
        return false;
      }

      const declaration = getDeclarationNode(context.sourceCode, expression);

      if (
        !declaration ||
        seenDeclarations.has(declaration) ||
        declaration.type !== AST_NODE_TYPES.VariableDeclarator ||
        !declaration.init
      ) {
        return false;
      }

      const nextSeen = new Set(seenDeclarations);
      nextSeen.add(declaration);

      return isShellExpression(declaration.init, nextSeen);
    }

    function isOpenExternalCallee(
      node: TSESTree.Expression,
      seenDeclarations = new Set<TSESTree.Node>(),
    ): boolean {
      const expression = unwrapExpression(node);

      if (isShellOpenExternalExpression(expression, bindings)) {
        return true;
      }

      if (expression.type === AST_NODE_TYPES.CallExpression) {
        return (
          expression.callee.type === AST_NODE_TYPES.MemberExpression &&
          !expression.callee.computed &&
          expression.callee.property.type === AST_NODE_TYPES.Identifier &&
          expression.callee.property.name === 'bind' &&
          isOpenExternalCallee(expression.callee.object, seenDeclarations)
        );
      }

      if (expression.type !== AST_NODE_TYPES.Identifier) {
        return false;
      }

      const declaration = getDeclarationNode(context.sourceCode, expression);

      if (
        !declaration ||
        seenDeclarations.has(declaration) ||
        declaration.type !== AST_NODE_TYPES.VariableDeclarator ||
        !declaration.init
      ) {
        return false;
      }

      const nextSeen = new Set(seenDeclarations);
      nextSeen.add(declaration);

      if (
        declaration.id.type === AST_NODE_TYPES.ObjectPattern &&
        isShellExpression(declaration.init, nextSeen)
      ) {
        for (const property of declaration.id.properties) {
          if (
            property.type !== AST_NODE_TYPES.Property ||
            property.kind !== 'init' ||
            property.computed
          ) {
            continue;
          }

          const localName =
            property.value.type === AST_NODE_TYPES.Identifier
              ? property.value.name
              : property.value.type === AST_NODE_TYPES.AssignmentPattern &&
                  property.value.left.type === AST_NODE_TYPES.Identifier
                ? property.value.left.name
                : undefined;

          if (
            localName === expression.name &&
            getPatternPropertyName(property.key) === 'openExternal'
          ) {
            return true;
          }
        }
      }

      return isOpenExternalCallee(declaration.init, nextSeen);
    }

    return {
      Program(node) {
        bindings = collectElectronBindings(node);
      },
      CallExpression(node) {
        if (!isOpenExternalCallee(node.callee)) {
          return;
        }

        const url = getStaticStringValue(node.arguments[0] ?? null);

        if (!url || !isSafeExternalUrl(url)) {
          context.report({
            node: node.arguments[0] ?? node,
            messageId: 'unsafeOpenExternal',
          });
        }
      },
    };
  },
});
