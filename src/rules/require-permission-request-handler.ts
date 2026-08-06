import { AST_NODE_TYPES, TSESLint, TSESTree } from '@typescript-eslint/utils';

import { getRecommendationByRuleId } from '../recommendations';
import { getNestedObjectExpression, getObjectProperty, getStaticStringValue } from '../utils/ast';
import { createRule } from '../utils/create-rule';
import {
  ElectronBindings,
  collectElectronBindings,
  getMemberPropertyName,
  isElectronNamedApiExpression,
  isElectronSessionExpression,
  isElectronSessionModuleExpression,
} from '../utils/electron';
import { FunctionLike, resolveFunctionLike, walkFunctionBody } from '../utils/functions';
import { isRemoteUrl } from '../utils/url';

const recommendation = getRecommendationByRuleId('require-permission-request-handler');

const HANDLER_METHOD = 'setPermissionRequestHandler';
const SESSION_FACTORY_METHODS = new Set(['fromPartition', 'fromPath']);
const SESSION_WEB_PREFERENCES = new Set(['partition', 'session']);
const LOAD_URL_METHODS = new Set(['loadURL']);

/**
 * Node types that mean the handler body branches.
 *
 * Any of these makes the grant conditional as far as this rule is concerned.
 * The rule only reports a callback whose body is a straight line to
 * `callback(true)`, so anything that could gate the grant buys silence.
 */
const GATING_NODE_TYPES = new Set<AST_NODE_TYPES>([
  AST_NODE_TYPES.ConditionalExpression,
  AST_NODE_TYPES.DoWhileStatement,
  AST_NODE_TYPES.ForInStatement,
  AST_NODE_TYPES.ForOfStatement,
  AST_NODE_TYPES.ForStatement,
  AST_NODE_TYPES.IfStatement,
  AST_NODE_TYPES.LogicalExpression,
  AST_NODE_TYPES.SwitchStatement,
  AST_NODE_TYPES.TryStatement,
  AST_NODE_TYPES.WhileStatement,
]);

export interface PermissionRequestHandlerOptions {
  requireHandler: boolean;
}

/**
 * True for the `session` module itself: either `session` imported from
 * `electron`, or `<namespace>.session`.
 *
 * This includes aliases such as `import { session as ses } from 'electron'`.
 */
function isSessionModuleExpression(
  node: TSESTree.Expression,
  bindings: ElectronBindings,
): boolean {
  return isElectronSessionModuleExpression(node, bindings);
}

/** `session.defaultSession` */
function isDefaultSessionExpression(
  node: TSESTree.MemberExpression,
  bindings: ElectronBindings,
): boolean {
  return (
    getMemberPropertyName(node) === 'defaultSession' && isSessionModuleExpression(node.object, bindings)
  );
}

/** `session.fromPartition(...)` / `session.fromPath(...)` */
function isSessionFactoryCall(node: TSESTree.CallExpression, bindings: ElectronBindings): boolean {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) {
    return false;
  }

  const methodName = getMemberPropertyName(node.callee);

  return (
    methodName !== undefined &&
    SESSION_FACTORY_METHODS.has(methodName) &&
    isSessionModuleExpression(node.callee.object, bindings)
  );
}

/** A `loadURL('https://...')` call with a literal remote destination. */
function isRemoteLoadUrlCall(node: TSESTree.CallExpression): boolean {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) {
    return false;
  }

  const methodName = getMemberPropertyName(node.callee);

  if (!methodName || !LOAD_URL_METHODS.has(methodName)) {
    return false;
  }

  const url = getStaticStringValue(node.arguments[0] ?? null);

  return url !== undefined && isRemoteUrl(url);
}

/**
 * A privileged custom scheme registration.
 *
 * Electron recommends serving renderer content over a custom protocol rather
 * than `http(s)://`, so keying "loads content" purely off remote URLs makes this
 * rule silent on exactly the apps that followed that advice. A privileged scheme
 * is explicitly granted powerful capabilities, and content served over it can
 * request permissions just like a remote page.
 */
function isPrivilegedSchemeRegistration(
  node: TSESTree.CallExpression,
  bindings: ElectronBindings,
): boolean {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) {
    return false;
  }

  const methodName = getMemberPropertyName(node.callee);

  return (
    methodName === 'registerSchemesAsPrivileged' &&
    node.callee.object.type !== AST_NODE_TYPES.Super &&
    isElectronNamedApiExpression(node.callee.object, 'protocol', bindings)
  );
}

/**
 * Detects a handler callback that hands out every permission.
 *
 * The bar is deliberately high: a single call to the third parameter, passing a
 * literal `true`, with no branching anywhere in the body. Anything else — a
 * computed argument, several call sites, a nested closure, any conditional — is
 * treated as gated and left alone.
 */
function grantsUnconditionally(
  sourceCode: Readonly<TSESLint.SourceCode>,
  callback: FunctionLike,
): boolean {
  const callbackParam = callback.params[2];

  if (!callbackParam || callbackParam.type !== AST_NODE_TYPES.Identifier) {
    return false;
  }

  const callbackParamName = callbackParam.name;
  const invocations: TSESTree.CallExpression[] = [];
  let gated = false;

  walkFunctionBody(sourceCode, callback, (candidate) => {
    if (GATING_NODE_TYPES.has(candidate.type)) {
      gated = true;
      return;
    }

    if (
      candidate.type === AST_NODE_TYPES.CallExpression &&
      candidate.callee.type === AST_NODE_TYPES.Identifier &&
      candidate.callee.name === callbackParamName
    ) {
      invocations.push(candidate);
    }
  });

  // `walkFunctionBody` does not descend into nested functions, so a callback
  // invoked from a `.then()` closure produces zero invocations and stays quiet.
  if (gated || invocations.length !== 1) {
    return false;
  }

  const grantArgument = invocations[0]?.arguments[0];

  return (
    grantArgument !== undefined &&
    grantArgument.type === AST_NODE_TYPES.Literal &&
    grantArgument.value === true
  );
}

export default createRule<
  [Partial<PermissionRequestHandlerOptions>?],
  'missingPermissionHandler' | 'unconditionalPermissionGrant'
>({
  name: 'require-permission-request-handler',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require sessions that load remote content to install a permission request handler that does not blanket-approve requests.',
    },
    messages: {
      missingPermissionHandler: `Electron recommendation ${recommendation.number} (${recommendation.title}) requires sessions that load remote content to install ses.setPermissionRequestHandler().`,
      unconditionalPermissionGrant: `Electron recommendation ${recommendation.number} (${recommendation.title}) requires permission request handlers to gate the request instead of unconditionally granting it.`,
    },
    schema: [
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          requireHandler: {
            type: 'boolean',
            description:
              'Report sessions that load remote content but never call setPermissionRequestHandler. Set to false to keep only the unconditional-grant check, for example when the handler is installed in another file. Defaults to true.',
          },
        },
      },
    ],
  },
  defaultOptions: [{ requireHandler: true }],
  create(context, [rawOptions]) {
    const options: PermissionRequestHandlerOptions = {
      requireHandler: rawOptions?.requireHandler ?? true,
    };

    let bindings = collectElectronBindings(context.sourceCode.ast);
    let sessionEvidence: TSESTree.Node | undefined;
    let remoteContentEvidence: TSESTree.Node | undefined;
    let hasPermissionHandler = false;

    function recordSessionEvidence(node: TSESTree.Node): void {
      sessionEvidence ??= node;
    }

    return {
      Program(node) {
        bindings = collectElectronBindings(node);
      },
      MemberExpression(node) {
        if (
          isDefaultSessionExpression(node, bindings) ||
          (node.object.type !== AST_NODE_TYPES.Super &&
            isElectronSessionExpression(context.sourceCode, node, bindings))
        ) {
          recordSessionEvidence(node);
        }
      },
      ObjectExpression(node) {
        const webPreferences = getNestedObjectExpression(node, 'webPreferences');

        if (!webPreferences) {
          return;
        }

        for (const propertyName of SESSION_WEB_PREFERENCES) {
          const property = getObjectProperty(webPreferences, propertyName);

          if (property) {
            recordSessionEvidence(property);
            return;
          }
        }
      },
      CallExpression(node) {
        if (isSessionFactoryCall(node, bindings)) {
          recordSessionEvidence(node);
        }

        if (isRemoteLoadUrlCall(node) || isPrivilegedSchemeRegistration(node, bindings)) {
          remoteContentEvidence ??= node;
        }

        if (
          node.callee.type !== AST_NODE_TYPES.MemberExpression ||
          getMemberPropertyName(node.callee) !== HANDLER_METHOD ||
          node.callee.object.type === AST_NODE_TYPES.Super ||
          !isElectronSessionExpression(context.sourceCode, node.callee.object, bindings)
        ) {
          return;
        }

        // Any call counts as installing a handler, including `null` (which
        // clears it). Guessing at intent there would trade a real class of
        // false positives for very little signal.
        hasPermissionHandler = true;

        const callbackArgument = node.arguments[0];

        if (!callbackArgument || callbackArgument.type === AST_NODE_TYPES.SpreadElement) {
          return;
        }

        const callback = resolveFunctionLike(context.sourceCode, callbackArgument);

        if (!callback || !grantsUnconditionally(context.sourceCode, callback)) {
          return;
        }

        context.report({
          node: callbackArgument,
          messageId: 'unconditionalPermissionGrant',
        });
      },
      'Program:exit'() {
        if (
          !options.requireHandler ||
          hasPermissionHandler ||
          !sessionEvidence ||
          !remoteContentEvidence
        ) {
          return;
        }

        context.report({
          node: sessionEvidence,
          messageId: 'missingPermissionHandler',
        });
      },
    };
  },
});
