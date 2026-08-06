import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';

import { getRecommendationByRuleId } from '../recommendations';
import { createRule } from '../utils/create-rule';
import { getStaticStringValue } from '../utils/ast';
import { collectElectronBindings, isShellOpenExternalExpression } from '../utils/electron';
import {
  getDeclarationNode,
  getLatestBindingValue,
  hasBindingWriteBetween,
  isFunctionLike,
  unwrapExpression,
} from '../utils/functions';
import { getTypeInfo, hasBrandedType } from '../utils/types';
import { DEFAULT_SAFE_EXTERNAL_PROTOCOLS, hasAllowedProtocol } from '../utils/url';

const recommendation = getRecommendationByRuleId('no-open-external-with-dynamic-url');

export interface OpenExternalOptions {
  allowedProtocols: string[];
  /**
   * Name of a branded type that marks a URL as validated. When the project is
   * type-aware this is checked by the compiler across file boundaries, which is
   * the only sound taint signal available to a lint rule.
   */
  trustedUrlType?: string;
  urlValidators: string[];
}

export default createRule<[Partial<OpenExternalOptions>?], 'unsafeOpenExternal'>({
  name: 'no-open-external-with-dynamic-url',
  meta: {
    type: 'problem',
    docs: {
      description: 'Require explicit allowlisted literal protocols for shell.openExternal.',
    },
    messages: {
      unsafeOpenExternal: `Electron recommendation ${recommendation.number} (${recommendation.title}) requires shell.openExternal URLs to be explicit literals with allowlisted protocols.`,
    },
    schema: [
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          allowedProtocols: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Protocols accepted for literal URLs. Defaults to https:, mailto: and tel:.',
          },
          trustedUrlType: {
            type: 'string',
            description:
              'Name of a branded type marking a URL as validated, for example "ValidatedUrl". Requires a type-aware parser; enforced by the compiler across files.',
          },
          urlValidators: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Functions that return a validated URL. A value derived from one of these calls is treated as safe, so a validated dynamic URL no longer needs an eslint-disable comment.',
          },
        },
      },
    ],
  },
  defaultOptions: [{}],
  create(context, [rawOptions]) {
    const options: OpenExternalOptions = {
      allowedProtocols: rawOptions?.allowedProtocols ?? [...DEFAULT_SAFE_EXTERNAL_PROTOCOLS],
      urlValidators: rawOptions?.urlValidators ?? [],
      ...(rawOptions?.trustedUrlType === undefined
        ? {}
        : { trustedUrlType: rawOptions.trustedUrlType }),
    };
    const typeInfo = getTypeInfo(context);
    let bindings = collectElectronBindings(context.sourceCode.ast);

    /**
     * Walks back from the argument to the identifier it is derived from, so
     * `parsed.toString()`, `parsed.href` and `parsed` all resolve to `parsed`.
     */
    function getRootIdentifier(node: TSESTree.Expression): TSESTree.Identifier | undefined {
      const expression = unwrapExpression(node);

      if (expression.type === AST_NODE_TYPES.Identifier) {
        return expression;
      }

      if (expression.type === AST_NODE_TYPES.MemberExpression) {
        return getRootIdentifier(expression.object);
      }

      if (expression.type === AST_NODE_TYPES.CallExpression) {
        return getRootIdentifier(expression.callee);
      }

      return undefined;
    }

    function getValidatorCallName(node: TSESTree.Expression): string | undefined {
      if (node.type !== AST_NODE_TYPES.CallExpression) {
        return undefined;
      }

      if (node.callee.type === AST_NODE_TYPES.Identifier) {
        return node.callee.name;
      }

      if (
        node.callee.type === AST_NODE_TYPES.MemberExpression &&
        node.callee.property.type === AST_NODE_TYPES.Identifier
      ) {
        return node.callee.property.name;
      }

      return undefined;
    }

    /**
     * Recognises the guard-then-use shape:
     *
     *   if (!isHttpUrl(url)) throw new Error(...)
     *   await shell.openExternal(url)
     *
     * The value is not reassigned by the guard, so tracing the declaration
     * alone cannot see it. We accept only a preceding, top-level bail-out
     * conditional whose failure branch exits the enclosing function. Looking
     * anywhere in the function would accept a validation that happens too late
     * or the inverse guard (`if (valid(url)) return`).
     */
    function isGuardedByValidator(
      root: TSESTree.Identifier,
      usage: TSESTree.Expression,
    ): boolean {
      let scope: TSESTree.Node | undefined = root.parent;

      while (scope && !isFunctionLike(scope)) {
        scope = scope.parent;
      }

      if (!scope) {
        return false;
      }

      if (scope.body.type !== AST_NODE_TYPES.BlockStatement) {
        return false;
      }

      function terminates(statement: TSESTree.Statement): boolean {
        if (
          statement.type === AST_NODE_TYPES.ReturnStatement ||
          statement.type === AST_NODE_TYPES.ThrowStatement
        ) {
          return true;
        }

        if (statement.type === AST_NODE_TYPES.BlockStatement) {
          const lastStatement = statement.body.at(-1);
          return lastStatement !== undefined && terminates(lastStatement);
        }

        return (
          statement.type === AST_NODE_TYPES.IfStatement &&
          statement.alternate !== null &&
          terminates(statement.consequent) &&
          terminates(statement.alternate)
        );
      }

      function validatorPolarity(test: TSESTree.Expression): boolean | undefined {
        const expression = unwrapExpression(test);

        if (expression.type === AST_NODE_TYPES.UnaryExpression && expression.operator === '!') {
          const nestedPolarity = validatorPolarity(expression.argument);
          return nestedPolarity === undefined ? undefined : !nestedPolarity;
        }

        if (expression.type !== AST_NODE_TYPES.CallExpression) {
          return undefined;
        }

        const calleeName = getValidatorCallName(expression);

        if (calleeName === undefined || !options.urlValidators.includes(calleeName)) {
          return undefined;
        }

        return expression.arguments.some(
          (argument) => argument.type === AST_NODE_TYPES.Identifier && argument.name === root.name,
        )
          ? true
          : undefined;
      }

      return scope.body.body.some(
        (statement) =>
          statement.type === AST_NODE_TYPES.IfStatement &&
          statement.range[1] <= usage.range[0] &&
          !hasBindingWriteBetween(
            context.sourceCode,
            root,
            statement.range[1],
            usage.range[0],
          ) &&
          (() => {
            const polarity = validatorPolarity(statement.test);

            return (
              (polarity === false && terminates(statement.consequent)) ||
              (polarity === true &&
                statement.alternate !== null &&
                terminates(statement.alternate))
            );
          })(),
      );
    }

    /**
     * True when the URL provably came out of, or was gated by, a configured
     * validator.
     */
    function isValidatedUrlExpression(node: TSESTree.Expression): boolean {
      if (options.urlValidators.length === 0) {
        return false;
      }

      // The direct shape is the most literal use of `urlValidators`:
      // `shell.openExternal(parseOpenableExternalUrl(raw))`. Check it before
      // tracing a root identifier, because the call's callee is not the URL
      // value that came out of the validator.
      const expression = unwrapExpression(node);
      const inlineValidatorName = getValidatorCallName(expression);

      if (
        expression.type === AST_NODE_TYPES.CallExpression &&
        inlineValidatorName !== undefined &&
        options.urlValidators.includes(inlineValidatorName)
      ) {
        return true;
      }

      const root = getRootIdentifier(node);

      if (!root) {
        return false;
      }

      if (isGuardedByValidator(root, node)) {
        return true;
      }

      const declaration = getDeclarationNode(context.sourceCode, root);

      if (
        !declaration ||
        declaration.type !== AST_NODE_TYPES.VariableDeclarator ||
        !declaration.init
      ) {
        return false;
      }

      const latestValue = getLatestBindingValue(context.sourceCode, root) ?? declaration.init;
      const init = unwrapExpression(latestValue);

      if (init.type !== AST_NODE_TYPES.CallExpression) {
        return false;
      }

      const calleeName =
        init.callee.type === AST_NODE_TYPES.Identifier
          ? init.callee.name
          : init.callee.type === AST_NODE_TYPES.MemberExpression &&
              init.callee.property.type === AST_NODE_TYPES.Identifier
            ? init.callee.property.name
            : undefined;

      return calleeName !== undefined && options.urlValidators.includes(calleeName);
    }

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

        const argument = node.arguments[0];
        const url = getStaticStringValue(argument ?? null);

        if (url !== undefined && hasAllowedProtocol(url, options.allowedProtocols)) {
          return;
        }

        if (argument && argument.type !== AST_NODE_TYPES.SpreadElement) {
          // A branded type is the strongest signal available: the compiler has
          // already proven the value came through validation.
          if (
            typeInfo &&
            options.trustedUrlType &&
            hasBrandedType(typeInfo, argument, options.trustedUrlType)
          ) {
            return;
          }

          if (isValidatedUrlExpression(argument)) {
            return;
          }
        }

        context.report({
          node: argument ?? node,
          messageId: 'unsafeOpenExternal',
        });
      },
    };
  },
});
