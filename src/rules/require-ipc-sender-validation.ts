import { AST_NODE_TYPES, TSESLint, TSESTree } from '@typescript-eslint/utils';

import { getRecommendationByRuleId } from '../recommendations';
import { createRule } from '../utils/create-rule';
import { collectElectronBindings, getMemberPropertyName, isIpcMainExpression } from '../utils/electron';
import { FunctionLike, resolveFunctionLike, unwrapExpression, walkFunctionBody, walkNodes } from '../utils/functions';
import { getTypeGuardKind, getTypeInfo, TypeInfo } from '../utils/types';

const recommendation = getRecommendationByRuleId('require-ipc-sender-validation');
const IPC_MAIN_METHODS = new Set(['handle', 'handleOnce', 'on', 'once']);
const SENDER_PROPERTIES = new Set(['frameId', 'processId', 'sender', 'senderFrame']);

/**
 * Names that read as a sender check when the IPC event is passed to them.
 *
 * This is a heuristic and deliberately wide: a false negative here is a missed
 * warning, whereas a false positive trains people to disable the rule. Projects
 * whose guard does not match can name it explicitly via the `senderGuards`
 * option.
 */
const DEFAULT_GUARD_PATTERN =
  /^(assert|authori[sz]e|can|check|ensure|guard|has|is|must|only|require|restrict|validate|verify)/i;

export interface SenderValidationOptions {
  senderGuards: string[];
}

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

/**
 * Detects a guard that cannot possibly inspect the sender because its body
 * never reads any of its own parameters.
 *
 * This only fires for functions declared in the same file. An imported guard is
 * unresolvable, and we give it the benefit of the doubt rather than reporting.
 */
function isVacuousGuard(
  sourceCode: Readonly<TSESLint.SourceCode>,
  callee: TSESTree.Expression,
): boolean {
  const declaration = resolveFunctionLike(sourceCode, callee);

  if (!declaration) {
    return false;
  }

  const parameterNames = new Set<string>();

  for (const parameter of declaration.params) {
    if (parameter.type === AST_NODE_TYPES.Identifier) {
      parameterNames.add(parameter.name);
    } else {
      // Destructured or rest parameters are hard to track; assume the guard
      // reads them so we do not invent a violation.
      return false;
    }
  }

  if (parameterNames.size === 0) {
    return true;
  }

  let readsParameter = false;

  walkNodes(sourceCode, declaration.body, (node) => {
    if (node.type === AST_NODE_TYPES.Identifier && parameterNames.has(node.name)) {
      readsParameter = true;
    }
  });

  return !readsParameter;
}

/**
 * True when a conditional actually gates the handler rather than merely
 * mentioning the sender.
 *
 * A guard qualifies if it bails out (`throw`/`return`) or if the remaining work
 * lives inside it. `if (event.senderFrame) { log() }` followed by the real work
 * is not a guard, and used to satisfy this rule.
 */
function conditionalGuardsHandler(
  sourceCode: Readonly<TSESLint.SourceCode>,
  statement: TSESTree.Node,
): boolean {
  let escapes = false;

  walkNodes(sourceCode, statement, (node) => {
    if (node.type === AST_NODE_TYPES.ThrowStatement || node.type === AST_NODE_TYPES.ReturnStatement) {
      escapes = true;
    }
  });

  if (escapes) {
    return true;
  }

  const parent = statement.parent;

  if (!parent || !('body' in parent) || !Array.isArray(parent.body)) {
    return false;
  }

  const siblings = parent.body as TSESTree.Node[];
  const index = siblings.indexOf(statement);

  // Nothing follows the guard, so all remaining work is inside it.
  return index !== -1 && index === siblings.length - 1;
}

function getCalleeName(callee: TSESTree.Node): string | undefined {
  if (callee.type === AST_NODE_TYPES.Identifier) {
    return callee.name;
  }

  if (callee.type === AST_NODE_TYPES.MemberExpression) {
    return getMemberPropertyName(callee);
  }

  return undefined;
}

function receivesSenderArgument(
  node: TSESTree.CallExpression,
  eventParamName: string,
): boolean {
  return node.arguments.some((argument) => {
    if (argument.type === AST_NODE_TYPES.SpreadElement) {
      return false;
    }

    if (argument.type === AST_NODE_TYPES.Identifier && argument.name === eventParamName) {
      return true;
    }

    return referencesSenderMetadata(argument, eventParamName);
  });
}

function statementTerminates(statement: TSESTree.Statement): boolean {
  if (
    statement.type === AST_NODE_TYPES.ReturnStatement ||
    statement.type === AST_NODE_TYPES.ThrowStatement
  ) {
    return true;
  }

  if (statement.type === AST_NODE_TYPES.BlockStatement) {
    const lastStatement = statement.body.at(-1);
    return lastStatement !== undefined && statementTerminates(lastStatement);
  }

  return (
    statement.type === AST_NODE_TYPES.IfStatement &&
    statement.alternate !== null &&
    statementTerminates(statement.consequent) &&
    statementTerminates(statement.alternate)
  );
}

function isLastStatement(statement: TSESTree.IfStatement): boolean {
  const parent = statement.parent;

  if (!parent || !('body' in parent) || !Array.isArray(parent.body)) {
    return false;
  }

  const siblings = parent.body as TSESTree.Node[];
  return siblings.at(-1) === statement;
}

/**
 * A type predicate narrows only inside the branch selected by its boolean
 * result. A bare call is therefore not a validation; it must guard a bail-out
 * path or contain all remaining work in its trusted branch.
 */
function typePredicateGatesHandler(
  statement: TSESTree.IfStatement,
  predicateCall: TSESTree.CallExpression,
): boolean {
  function polarity(test: TSESTree.Expression): boolean | undefined {
    const expression = unwrapExpression(test);

    if (expression === predicateCall) {
      return true;
    }

    if (expression.type === AST_NODE_TYPES.UnaryExpression && expression.operator === '!') {
      const nestedPolarity = polarity(expression.argument);
      return nestedPolarity === undefined ? undefined : !nestedPolarity;
    }

    return undefined;
  }

  const result = polarity(statement.test);

  if (result === undefined) {
    return false;
  }

  if (result === false && statementTerminates(statement.consequent)) {
    return true;
  }

  if (result === true && statement.alternate && statementTerminates(statement.alternate)) {
    return true;
  }

  // `if (isTrusted(event)) { work() }` as the final statement has no work
  // after the branch. The inverse form is safe only when its `else` owns that
  // final work.
  return (
    isLastStatement(statement) &&
    ((result === true && statement.alternate === null) ||
      (result === false && statement.alternate !== null))
  );
}

function hasTypePredicateInGatingConditional(
  sourceCode: Readonly<TSESLint.SourceCode>,
  statement: TSESTree.IfStatement | TSESTree.ConditionalExpression,
  eventParamName: string,
  typeInfo: TypeInfo | undefined,
): boolean {
  if (!typeInfo) {
    return false;
  }

  let found = false;

  walkNodes(sourceCode, statement.test, (node) => {
    if (found || node.type !== AST_NODE_TYPES.CallExpression) {
      return;
    }

    if (
      getTypeGuardKind(typeInfo, node.callee) === 'predicate' &&
      receivesSenderArgument(node, eventParamName) &&
      (statement.type === AST_NODE_TYPES.ConditionalExpression ||
        typePredicateGatesHandler(statement, node))
    ) {
      found = true;
    }
  });

  return found;
}

/**
 * Assertion signatures narrow only statements that execute after the call.
 * Require the assertion to be a standalone statement before any handler work;
 * otherwise a late assertion could bless payload processing that already ran.
 */
function assertionPrecedesHandlerWork(
  functionNode: FunctionLike,
  assertionCall: TSESTree.CallExpression,
): boolean {
  if (functionNode.body.type !== AST_NODE_TYPES.BlockStatement) {
    return false;
  }

  let statement: TSESTree.Node = assertionCall;

  while (statement.parent && statement.parent !== functionNode.body) {
    statement = statement.parent;
  }

  if (
    statement.parent !== functionNode.body ||
    statement.type !== AST_NODE_TYPES.ExpressionStatement ||
    statement.expression !== assertionCall
  ) {
    return false;
  }

  const index = functionNode.body.body.indexOf(statement);

  return (
    index >= 0 &&
    functionNode.body.body.slice(0, index).every(
      (candidate) =>
        candidate.type === AST_NODE_TYPES.ExpressionStatement &&
        candidate.expression.type === AST_NODE_TYPES.Literal &&
        typeof candidate.expression.value === 'string',
    )
  );
}

function hasVisibleSenderValidation(
  functionNode: FunctionLike,
  sourceCode: Readonly<TSESLint.SourceCode>,
  eventParamName: string,
  options: SenderValidationOptions,
  typeInfo: TypeInfo | undefined,
): boolean {
  let validated = false;

  walkFunctionBody(sourceCode, functionNode, (candidate) => {
    if (validated) {
      return;
    }

    if (candidate.type === AST_NODE_TYPES.CallExpression) {
      const calleeName = getCalleeName(candidate.callee);
      const isNamedGuard =
        calleeName !== undefined &&
        (options.senderGuards.includes(calleeName) || DEFAULT_GUARD_PATTERN.test(calleeName));

      // A declared type guard or assertion function is a fact about the
      // signature rather than a naming convention, and it resolves through
      // imports. When type information is available it beats the heuristic.
      const declaredGuardKind =
        typeInfo === undefined ? undefined : getTypeGuardKind(typeInfo, candidate.callee);

      if (
        // Assertions narrow after a standalone call. Ordinary type predicates
        // narrow only in a branch, and are handled below with their condition.
        (declaredGuardKind === 'assertion' ||
          (declaredGuardKind === undefined && isNamedGuard)) &&
        receivesSenderArgument(candidate, eventParamName) &&
        (declaredGuardKind === 'assertion'
          ? assertionPrecedesHandlerWork(functionNode, candidate)
          : !isVacuousGuard(sourceCode, candidate.callee as TSESTree.Expression))
      ) {
        validated = true;
        return;
      }
    }

    if (candidate.type === AST_NODE_TYPES.ConditionalExpression) {
      if (hasTypePredicateInGatingConditional(sourceCode, candidate, eventParamName, typeInfo)) {
        validated = true;
        return;
      }

      walkNodes(sourceCode, candidate.test, (testNode) => {
        if (!validated && referencesSenderMetadata(testNode, eventParamName)) {
          validated = true;
        }
      });
      return;
    }

    if (candidate.type === AST_NODE_TYPES.IfStatement || candidate.type === AST_NODE_TYPES.SwitchStatement) {
      if (
        candidate.type === AST_NODE_TYPES.IfStatement &&
        hasTypePredicateInGatingConditional(sourceCode, candidate, eventParamName, typeInfo)
      ) {
        validated = true;
        return;
      }

      const test =
        candidate.type === AST_NODE_TYPES.SwitchStatement ? candidate.discriminant : candidate.test;

      let referencesSender = false;

      walkNodes(sourceCode, test, (testNode) => {
        if (referencesSenderMetadata(testNode, eventParamName)) {
          referencesSender = true;
        }
      });

      if (referencesSender && conditionalGuardsHandler(sourceCode, candidate)) {
        validated = true;
      }
    }
  });

  return validated;
}

export default createRule<[Partial<SenderValidationOptions>?], 'missingSenderValidation'>({
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
    schema: [
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          senderGuards: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Function names that count as sender validation when the IPC event is passed to them. Use this when your guard does not match the default naming heuristic.',
          },
        },
      },
    ],
  },
  defaultOptions: [{ senderGuards: [] }],
  create(context, [rawOptions]) {
    const options: SenderValidationOptions = { senderGuards: rawOptions?.senderGuards ?? [] };
    const typeInfo = getTypeInfo(context);
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
          !hasVisibleSenderValidation(callback, context.sourceCode, eventParam.name, options, typeInfo)
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
