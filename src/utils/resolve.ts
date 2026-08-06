import { AST_NODE_TYPES, TSESLint, TSESTree } from '@typescript-eslint/utils';

import { getPropertyName } from './ast';
import { getDeclarationNode, unwrapExpression, walkNodes } from './functions';

/**
 * Resolution of an option value inside an Electron option bag.
 *
 * `found` carries a statically known value. `absent` means the option is
 * provably not set. `unresolved` means a spread or dynamic key could still
 * define or override the option, so callers must not report a violation.
 */
export type OptionResolution =
  | { kind: 'found'; node: TSESTree.Expression }
  | { kind: 'absent' }
  | { kind: 'unresolved' };

const MAX_RESOLUTION_DEPTH = 8;
// AST nodes are shared by every rule linting a file, so this cache also avoids
// repeating the full-program mutation scan across window-option rules.
const mutableObjectWriteCache = new WeakMap<TSESTree.VariableDeclarator, boolean>();

function getMutationRoot(node: TSESTree.Expression): TSESTree.Identifier | undefined {
  const expression = unwrapExpression(node);

  if (expression.type === AST_NODE_TYPES.Identifier) {
    return expression;
  }

  if (
    expression.type === AST_NODE_TYPES.MemberExpression &&
    expression.object.type !== AST_NODE_TYPES.Super
  ) {
    return getMutationRoot(expression.object);
  }

  return undefined;
}

/** True when `identifier` is the binding being resolved, or a const alias of it. */
function isBindingOrAlias(
  sourceCode: Readonly<TSESLint.SourceCode>,
  identifier: TSESTree.Identifier,
  target: TSESTree.VariableDeclarator,
  seenDeclarations = new Set<TSESTree.Node>(),
): boolean {
  const declaration = getDeclarationNode(sourceCode, identifier);

  if (declaration === target) {
    return true;
  }

  if (
    !declaration ||
    seenDeclarations.has(declaration) ||
    declaration.type !== AST_NODE_TYPES.VariableDeclarator ||
    !declaration.init ||
    declaration.parent?.type !== AST_NODE_TYPES.VariableDeclaration ||
    declaration.parent.kind !== 'const'
  ) {
    return false;
  }

  const init = unwrapExpression(declaration.init);

  if (init.type !== AST_NODE_TYPES.Identifier) {
    return false;
  }

  const nextSeen = new Set(seenDeclarations);
  nextSeen.add(declaration);

  return isBindingOrAlias(sourceCode, init, target, nextSeen);
}

/**
 * A const protects the variable binding, not the object it points at. Once an
 * object (or a local const alias) is written to or passed to unknown code, its
 * literal initializer no longer proves the values seen at a later construction
 * site. We deliberately stay silent for the entire file instead of trying to
 * model control flow.
 */
function hasMutableObjectWrite(
  sourceCode: Readonly<TSESLint.SourceCode>,
  declaration: TSESTree.VariableDeclarator,
  ignoredConsumer?: TSESTree.CallExpression,
): boolean {
  const cached = ignoredConsumer ? undefined : mutableObjectWriteCache.get(declaration);

  if (cached !== undefined) {
    return cached;
  }

  let mutated = false;

  const writesToBinding = (node: TSESTree.Expression): boolean => {
    const root = getMutationRoot(node);

    return root !== undefined && isBindingOrAlias(sourceCode, root, declaration);
  };

  walkNodes(sourceCode, sourceCode.ast, (candidate) => {
    if (mutated) {
      return;
    }

    if (
      candidate.type === AST_NODE_TYPES.AssignmentExpression &&
      writesToBinding(candidate.left)
    ) {
      mutated = true;
      return;
    }

    if (
      candidate.type === AST_NODE_TYPES.UpdateExpression &&
      writesToBinding(candidate.argument)
    ) {
      mutated = true;
      return;
    }

    if (
      candidate.type === AST_NODE_TYPES.UnaryExpression &&
      candidate.operator === 'delete' &&
      writesToBinding(candidate.argument)
    ) {
      mutated = true;
      return;
    }

    if (candidate.type !== AST_NODE_TYPES.CallExpression) {
      return;
    }

    if (candidate === ignoredConsumer) {
      return;
    }

    // Passing the object (or one of its nested values) to unknown code lets
    // that code retain and mutate it. A proof-oriented resolver must stop at
    // this escape boundary instead of trusting the original literal forever.
    if (
      candidate.arguments.some((argument) => {
        const value =
          argument.type === AST_NODE_TYPES.SpreadElement ? argument.argument : argument;
        return writesToBinding(value);
      }) ||
      (candidate.callee.type === AST_NODE_TYPES.MemberExpression &&
        candidate.callee.object.type !== AST_NODE_TYPES.Super &&
        writesToBinding(candidate.callee.object))
    ) {
      mutated = true;
      return;
    }

    const firstArgument = candidate.arguments[0];

    if (!firstArgument || firstArgument.type === AST_NODE_TYPES.SpreadElement) {
      return;
    }

    if (
      candidate.callee.type === AST_NODE_TYPES.MemberExpression &&
      candidate.callee.object.type === AST_NODE_TYPES.Identifier &&
      candidate.callee.object.name === 'Object' &&
      candidate.callee.property.type === AST_NODE_TYPES.Identifier &&
      ['assign', 'defineProperty', 'defineProperties', 'setPrototypeOf'].includes(
        candidate.callee.property.name,
      ) &&
      writesToBinding(firstArgument)
    ) {
      mutated = true;
    }
  });

  if (!ignoredConsumer) {
    mutableObjectWriteCache.set(declaration, mutated);
  }
  return mutated;
}

/**
 * Resolves an expression to an object literal, following locally unmodified
 * `const` bindings within the same file.
 *
 * Only `const` declarations without a visible object write are followed. A
 * `let`/`var` binding can be reassigned, and a const object's properties can
 * be mutated, so either case makes its initializer non-authoritative.
 */
export function resolveObjectExpression(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.Expression,
  depth = 0,
  ignoredConsumer?: TSESTree.CallExpression,
): TSESTree.ObjectExpression | undefined {
  if (depth > MAX_RESOLUTION_DEPTH) {
    return undefined;
  }

  const expression = unwrapExpression(node);

  if (expression.type === AST_NODE_TYPES.ObjectExpression) {
    return expression;
  }

  if (expression.type !== AST_NODE_TYPES.Identifier) {
    return undefined;
  }

  const declaration = getDeclarationNode(sourceCode, expression);

  if (
    !declaration ||
    declaration.type !== AST_NODE_TYPES.VariableDeclarator ||
    !declaration.init ||
    declaration.parent?.type !== AST_NODE_TYPES.VariableDeclaration ||
    declaration.parent.kind !== 'const'
  ) {
    return undefined;
  }

  if (hasMutableObjectWrite(sourceCode, declaration, ignoredConsumer)) {
    return undefined;
  }

  return resolveObjectExpression(sourceCode, declaration.init, depth + 1, ignoredConsumer);
}

/**
 * Resolves an expression to a static boolean, following single-assignment
 * `const` bindings within the same file.
 */
export function resolveStaticBoolean(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.Node | null | undefined,
  depth = 0,
): boolean | undefined {
  if (!node || depth > MAX_RESOLUTION_DEPTH) {
    return undefined;
  }

  const expression = unwrapExpression(node as TSESTree.Expression);

  if (expression.type === AST_NODE_TYPES.Literal && typeof expression.value === 'boolean') {
    return expression.value;
  }

  if (expression.type !== AST_NODE_TYPES.Identifier) {
    return undefined;
  }

  const declaration = getDeclarationNode(sourceCode, expression);

  if (
    !declaration ||
    declaration.type !== AST_NODE_TYPES.VariableDeclarator ||
    !declaration.init ||
    declaration.parent?.type !== AST_NODE_TYPES.VariableDeclaration ||
    declaration.parent.kind !== 'const'
  ) {
    return undefined;
  }

  return resolveStaticBoolean(sourceCode, declaration.init, depth + 1);
}

/**
 * Reads a property from an object literal, honouring spread semantics.
 *
 * Properties are evaluated in source order so the last write wins, matching
 * JavaScript object spread. If an unresolvable spread appears at or after the
 * position of the matched property, the result is `unresolved`: that spread
 * could overwrite the value we matched, and reporting on it would be a false
 * positive.
 */
export function resolveObjectProperty(
  sourceCode: Readonly<TSESLint.SourceCode>,
  object: TSESTree.ObjectExpression,
  propertyName: string,
  depth = 0,
  resolvePropertyName: (property: TSESTree.Property) => string | undefined = (property) => {
    if (property.computed) {
      return property.key.type === AST_NODE_TYPES.Literal &&
        typeof property.key.value === 'string'
        ? property.key.value
        : undefined;
    }

    return getPropertyName(property.key);
  },
): OptionResolution {
  if (depth > MAX_RESOLUTION_DEPTH) {
    return { kind: 'unresolved' };
  }

  let result: OptionResolution = { kind: 'absent' };

  for (const property of object.properties) {
    if (property.type === AST_NODE_TYPES.SpreadElement) {
      const spreadObject = resolveObjectExpression(sourceCode, property.argument, depth + 1);

      if (!spreadObject) {
        // An opaque spread may define or overwrite the option we care about.
        result = { kind: 'unresolved' };
        continue;
      }

      const spreadResult = resolveObjectProperty(
        sourceCode,
        spreadObject,
        propertyName,
        depth + 1,
        resolvePropertyName,
      );

      if (spreadResult.kind !== 'absent') {
        result = spreadResult;
      }

      continue;
    }

    if (property.type !== AST_NODE_TYPES.Property || property.kind !== 'init') {
      continue;
    }

    const resolvedName = resolvePropertyName(property);

    if (resolvedName === undefined && property.computed) {
      // A dynamic computed key could be the option we are looking for.
      result = { kind: 'unresolved' };
      continue;
    }

    if (resolvedName !== propertyName) {
      continue;
    }

    const value = property.value;

    if (
      value.type === AST_NODE_TYPES.ArrayPattern ||
      value.type === AST_NODE_TYPES.AssignmentPattern ||
      value.type === AST_NODE_TYPES.ObjectPattern ||
      value.type === AST_NODE_TYPES.TSEmptyBodyFunctionExpression
    ) {
      result = { kind: 'unresolved' };
      continue;
    }

    result = { kind: 'found', node: value };
  }

  return result;
}

/**
 * Resolves the nested object stored at `propertyName`, following `const`
 * bindings and spreads.
 */
function resolveNestedObject(
  sourceCode: Readonly<TSESLint.SourceCode>,
  object: TSESTree.ObjectExpression,
  propertyName: string,
): { kind: 'found'; object: TSESTree.ObjectExpression } | { kind: 'absent' } | { kind: 'unresolved' } {
  const resolution = resolveObjectProperty(sourceCode, object, propertyName);

  if (resolution.kind !== 'found') {
    return resolution;
  }

  const nested = resolveObjectExpression(sourceCode, resolution.node);

  return nested ? { kind: 'found', object: nested } : { kind: 'unresolved' };
}

/**
 * Resolves the option bag passed to `new BrowserWindow(...)` /
 * `new WebContentsView(...)`, following `const` bindings.
 */
export function resolveWindowOptionsObject(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.NewExpression,
): TSESTree.ObjectExpression | undefined {
  const firstArgument = node.arguments[0];

  if (!firstArgument || firstArgument.type === AST_NODE_TYPES.SpreadElement) {
    return undefined;
  }

  return resolveObjectExpression(sourceCode, firstArgument);
}

/**
 * Finds a window option, checking `webPreferences` first and then the top
 * level, following `const` bindings and spreads at every step.
 */
export function resolveWindowOption(
  sourceCode: Readonly<TSESLint.SourceCode>,
  options: TSESTree.ObjectExpression,
  optionName: string,
): OptionResolution {
  const webPreferences = resolveNestedObject(sourceCode, options, 'webPreferences');

  if (webPreferences.kind === 'unresolved') {
    return { kind: 'unresolved' };
  }

  if (webPreferences.kind === 'found') {
    const nested = resolveObjectProperty(sourceCode, webPreferences.object, optionName);

    if (nested.kind !== 'absent') {
      return nested;
    }
  }

  return resolveObjectProperty(sourceCode, options, optionName);
}

/**
 * Convenience helper: resolves a window option to a static boolean.
 *
 * Returns `undefined` when the option is absent, dynamic, or shadowed by an
 * unresolvable spread, so callers stay silent rather than guessing.
 */
export function resolveWindowOptionBoolean(
  sourceCode: Readonly<TSESLint.SourceCode>,
  options: TSESTree.ObjectExpression,
  optionName: string,
): { value: boolean; node: TSESTree.Expression } | undefined {
  const resolution = resolveWindowOption(sourceCode, options, optionName);

  if (resolution.kind !== 'found') {
    return undefined;
  }

  const value = resolveStaticBoolean(sourceCode, resolution.node);

  return value === undefined ? undefined : { value, node: resolution.node };
}
