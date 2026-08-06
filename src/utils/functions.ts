import { AST_NODE_TYPES, TSESLint, TSESTree } from '@typescript-eslint/utils';

export type FunctionLike =
  | TSESTree.ArrowFunctionExpression
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression;

export function isFunctionLike(node: TSESTree.Node): node is FunctionLike {
  return (
    node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    node.type === AST_NODE_TYPES.FunctionDeclaration ||
    node.type === AST_NODE_TYPES.FunctionExpression
  );
}

export function unwrapExpression(node: TSESTree.Expression): TSESTree.Expression {
  switch (node.type) {
    case AST_NODE_TYPES.ChainExpression:
      return unwrapExpression(node.expression);
    case AST_NODE_TYPES.TSAsExpression:
    case AST_NODE_TYPES.TSNonNullExpression:
    case AST_NODE_TYPES.TSSatisfiesExpression:
      return unwrapExpression(node.expression);
    default:
      return node;
  }
}

export function walkNodes(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.Node,
  visitor: (candidate: TSESTree.Node) => void,
): void {
  visitor(node);

  for (const key of sourceCode.visitorKeys[node.type] ?? []) {
    const child = (node as unknown as Record<string, unknown>)[key];

    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object' && 'type' in item) {
          walkNodes(sourceCode, item as TSESTree.Node, visitor);
        }
      }
      continue;
    }

    if (child && typeof child === 'object' && 'type' in child) {
      walkNodes(sourceCode, child as TSESTree.Node, visitor);
    }
  }
}

export function walkFunctionBody(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: FunctionLike,
  visitor: (candidate: TSESTree.Node) => void,
): void {
  function visit(candidate: TSESTree.Node): void {
    if (candidate !== node && isFunctionLike(candidate)) {
      return;
    }

    visitor(candidate);

    for (const key of sourceCode.visitorKeys[candidate.type] ?? []) {
      const child = (candidate as unknown as Record<string, unknown>)[key];

      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object' && 'type' in item) {
            visit(item as TSESTree.Node);
          }
        }
        continue;
      }

      if (child && typeof child === 'object' && 'type' in child) {
        visit(child as TSESTree.Node);
      }
    }
  }

  visit(node.body);
}

export function getDeclarationNode(
  sourceCode: Readonly<TSESLint.SourceCode>,
  identifier: TSESTree.Identifier,
): TSESTree.Node | undefined {
  let scope = sourceCode.getScope(identifier);
  let reference = scope.references.find((candidate) => candidate.identifier === identifier);

  while (!reference && scope.upper) {
    scope = scope.upper;
    reference = scope.references.find((candidate) => candidate.identifier === identifier);
  }

  const declaration = reference?.resolved?.defs[0];

  if (!declaration) {
    return undefined;
  }

  switch (declaration.type) {
    case 'Variable':
      return declaration.node as TSESTree.VariableDeclarator;
    case 'FunctionName':
      return declaration.node as FunctionLike;
    default:
      return undefined;
  }
}

function getResolvedVariable(
  sourceCode: Readonly<TSESLint.SourceCode>,
  identifier: TSESTree.Identifier,
) {
  let scope = sourceCode.getScope(identifier);
  let reference = scope.references.find((candidate) => candidate.identifier === identifier);

  while (!reference && scope.upper) {
    scope = scope.upper;
    reference = scope.references.find((candidate) => candidate.identifier === identifier);
  }

  return reference?.resolved;
}

/** Returns the expression most recently written to a binding before this use. */
export function getLatestBindingValue(
  sourceCode: Readonly<TSESLint.SourceCode>,
  identifier: TSESTree.Identifier,
): TSESTree.Expression | undefined {
  const variable = getResolvedVariable(sourceCode, identifier);
  let latest: { expression: TSESTree.Expression; offset: number } | undefined;

  for (const candidate of variable?.references ?? []) {
    if (
      !candidate.isWrite() ||
      !candidate.writeExpr ||
      candidate.identifier.range[0] >= identifier.range[0]
    ) {
      continue;
    }

    const offset = candidate.identifier.range[0];

    if (!latest || offset > latest.offset) {
      latest = {
        expression: candidate.writeExpr as TSESTree.Expression,
        offset,
      };
    }
  }

  return latest?.expression;
}

/** True when the same binding is written within the given source range. */
export function hasBindingWriteBetween(
  sourceCode: Readonly<TSESLint.SourceCode>,
  identifier: TSESTree.Identifier,
  startOffset: number,
  endOffset: number,
): boolean {
  const variable = getResolvedVariable(sourceCode, identifier);

  return (variable?.references ?? []).some(
    (candidate) =>
      candidate.isWrite() &&
      candidate.identifier.range[0] >= startOffset &&
      candidate.identifier.range[0] < endOffset,
  );
}

export function resolveFunctionLike(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.Expression,
): FunctionLike | undefined {
  const expression = unwrapExpression(node);

  if (isFunctionLike(expression)) {
    return expression;
  }

  if (expression.type !== AST_NODE_TYPES.Identifier) {
    return undefined;
  }

  const declaration = getDeclarationNode(sourceCode, expression);

  if (!declaration) {
    return undefined;
  }

  if (isFunctionLike(declaration)) {
    return declaration;
  }

  if (
    declaration.type === AST_NODE_TYPES.VariableDeclarator &&
    declaration.init &&
    isFunctionLike(unwrapExpression(declaration.init))
  ) {
    return unwrapExpression(declaration.init) as FunctionLike;
  }

  return undefined;
}
