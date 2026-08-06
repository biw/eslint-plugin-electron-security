import { ESLintUtils, TSESLint, TSESTree } from '@typescript-eslint/utils';
import type * as ts from 'typescript';

/**
 * Type information, when the consumer has configured a type-aware parser.
 *
 * Rules in the syntax-only presets must keep working without it, so every
 * caller treats `undefined` as "fall back to syntax".
 */
export interface TypeInfo {
  checker: ts.TypeChecker;
  getTsNode: (node: TSESTree.Node) => ts.Node | undefined;
}

export type TypeGuardKind = 'assertion' | 'predicate';

export function getTypeInfo(
  context: Readonly<TSESLint.RuleContext<string, readonly unknown[]>>,
): TypeInfo | undefined {
  let services;

  try {
    // `true` allows rules to run when the project is not type-aware.
    services = ESLintUtils.getParserServices(context, true);
  } catch {
    return undefined;
  }

  const program = services?.program;

  if (!program || !services.esTreeNodeToTSNodeMap) {
    return undefined;
  }

  return {
    checker: program.getTypeChecker(),
    getTsNode: (node) => services.esTreeNodeToTSNodeMap.get(node as never) as ts.Node | undefined,
  };
}

/**
 * Reports whether the callee is declared as a type guard or assertion function, for
 * example `(event: unknown) => event is TrustedEvent` or
 * `(event: unknown) => asserts event is TrustedEvent`.
 *
 * This is a declaration-level fact rather than a naming convention, and it
 * resolves through imports, so it works across files.
 */
export function getTypeGuardKind(
  typeInfo: TypeInfo,
  callee: TSESTree.Node,
): TypeGuardKind | undefined {
  const tsNode = typeInfo.getTsNode(callee);

  if (!tsNode) {
    return undefined;
  }

  const type = typeInfo.checker.getTypeAtLocation(tsNode);

  for (const signature of type.getCallSignatures()) {
    const predicate = typeInfo.checker.getTypePredicateOfSignature(signature);

    if (predicate) {
      // TypeScript's public TypePredicateKind enum is 0/1 for ordinary
      // predicates and 2/3 for assertion predicates. Keeping the comparison
      // numeric avoids a runtime import of the optional `typescript` peer.
      return predicate.kind === 2 || predicate.kind === 3 ? 'assertion' : 'predicate';
    }
  }

  return undefined;
}

/**
 * True when the expression's type carries the given brand.
 *
 * Matches the declared type name, an alias, or any member of an intersection,
 * so `string & { __brand: 'ValidatedUrl' }` aliased as `ValidatedUrl` is
 * recognised either way.
 */
export function hasBrandedType(
  typeInfo: TypeInfo,
  node: TSESTree.Node,
  brandName: string,
): boolean {
  const tsNode = typeInfo.getTsNode(node);

  if (!tsNode) {
    return false;
  }

  const type = typeInfo.checker.getTypeAtLocation(tsNode);

  const matchesName = (candidate: ts.Type): boolean => {
    if (candidate.aliasSymbol?.getName() === brandName) {
      return true;
    }

    if (candidate.getSymbol()?.getName() === brandName) {
      return true;
    }

    return typeInfo.checker.typeToString(candidate) === brandName;
  };

  if (matchesName(type)) {
    return true;
  }

  if (type.isIntersection()) {
    return type.types.some(matchesName);
  }

  return false;
}
