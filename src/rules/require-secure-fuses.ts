import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';

import { getRecommendationByRuleId } from '../recommendations';
import { getPropertyName } from '../utils/ast';
import { createRule } from '../utils/create-rule';
import {
  resolveObjectExpression,
  resolveObjectProperty,
  resolveStaticBoolean,
} from '../utils/resolve';

const recommendation = getRecommendationByRuleId('require-secure-fuses');

/**
 * Fuses that hand an attacker a Node.js execution path when left enabled.
 *
 * These are the fuses Electron's checklist calls out: each one lets someone who
 * can start the packaged binary run arbitrary code inside it, which defeats the
 * rest of the hardening in this plugin.
 */
const MUST_BE_DISABLED = new Map<string, string>([
  ['RunAsNode', 'lets the packaged app be started as a plain Node process'],
  ['EnableNodeCliInspectArguments', 'lets --inspect attach a debugger to the main process'],
  [
    'EnableNodeOptionsEnvironmentVariable',
    'lets NODE_OPTIONS inject code at startup',
  ],
  [
    'GrantFileProtocolExtraPrivileges',
    'gives file:// pages extra capabilities that remote content can abuse',
  ],
]);

/** Fuses that provide integrity guarantees and should stay on. */
const MUST_BE_ENABLED = new Map<string, string>([
  ['OnlyLoadAppFromAsar', 'stops the app loading code from outside the signed archive'],
  [
    'EnableEmbeddedAsarIntegrityValidation',
    'verifies the archive has not been tampered with',
  ],
]);

/**
 * Reads the fuse name from a property key.
 *
 * Handles both `[FuseV1Options.RunAsNode]` and the plain string form used by
 * some configs.
 */
function getFuseName(property: TSESTree.Property): string | undefined {
  if (property.computed) {
    if (
      property.key.type === AST_NODE_TYPES.MemberExpression &&
      property.key.property.type === AST_NODE_TYPES.Identifier
    ) {
      return property.key.property.name;
    }

    if (property.key.type === AST_NODE_TYPES.Literal && typeof property.key.value === 'string') {
      return property.key.value;
    }

    return undefined;
  }

  return getPropertyName(property.key);
}

interface FuseBindings {
  flipFuses: Set<string>;
  namespaces: Set<string>;
}

function isFusesRequireCall(node: TSESTree.Expression | null): boolean {
  return (
    node?.type === AST_NODE_TYPES.CallExpression &&
    node.callee.type === AST_NODE_TYPES.Identifier &&
    node.callee.name === 'require' &&
    node.arguments.length === 1 &&
    node.arguments[0]?.type === AST_NODE_TYPES.Literal &&
    node.arguments[0].value === '@electron/fuses'
  );
}

function collectFuseBindings(program: TSESTree.Program): FuseBindings {
  const bindings: FuseBindings = {
    flipFuses: new Set<string>(),
    namespaces: new Set<string>(),
  };

  for (const statement of program.body) {
    if (
      statement.type === AST_NODE_TYPES.ImportDeclaration &&
      statement.source.value === '@electron/fuses'
    ) {
      for (const specifier of statement.specifiers) {
        if (
          specifier.type === AST_NODE_TYPES.ImportSpecifier &&
          (specifier.imported.type === AST_NODE_TYPES.Identifier
            ? specifier.imported.name
            : specifier.imported.value) === 'flipFuses'
        ) {
          bindings.flipFuses.add(specifier.local.name);
        } else if (specifier.type === AST_NODE_TYPES.ImportNamespaceSpecifier) {
          bindings.namespaces.add(specifier.local.name);
        }
      }
    }

    if (statement.type !== AST_NODE_TYPES.VariableDeclaration) {
      continue;
    }

    for (const declaration of statement.declarations) {
      if (!isFusesRequireCall(declaration.init)) {
        continue;
      }

      if (declaration.id.type === AST_NODE_TYPES.Identifier) {
        bindings.namespaces.add(declaration.id.name);
        continue;
      }

      if (declaration.id.type !== AST_NODE_TYPES.ObjectPattern) {
        continue;
      }

      for (const property of declaration.id.properties) {
        if (
          property.type !== AST_NODE_TYPES.Property ||
          property.key.type !== AST_NODE_TYPES.Identifier ||
          property.key.name !== 'flipFuses'
        ) {
          continue;
        }

        const localName =
          property.value.type === AST_NODE_TYPES.Identifier
            ? property.value.name
            : property.key.name;
        bindings.flipFuses.add(localName);
      }
    }
  }

  return bindings;
}

function isFlipFusesCallee(node: TSESTree.Expression, bindings: FuseBindings): boolean {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return bindings.flipFuses.has(node.name);
  }

  return (
    node.type === AST_NODE_TYPES.MemberExpression &&
    node.object.type === AST_NODE_TYPES.Identifier &&
    bindings.namespaces.has(node.object.name) &&
    ((node.property.type === AST_NODE_TYPES.Identifier &&
      node.property.name === 'flipFuses') ||
      (node.computed &&
        node.property.type === AST_NODE_TYPES.Literal &&
        node.property.value === 'flipFuses'))
  );
}

export default createRule<[], 'fuseMustBeDisabled' | 'fuseMustBeEnabled'>({
  name: 'require-secure-fuses',
  meta: {
    type: 'problem',
    docs: {
      description: 'Require Electron fuses to be configured so the packaged app cannot run arbitrary code.',
    },
    messages: {
      fuseMustBeDisabled: `Electron recommendation ${recommendation.number} (${recommendation.title}) requires "{{fuse}}" to be disabled: it {{reason}}.`,
      fuseMustBeEnabled: `Electron recommendation ${recommendation.number} (${recommendation.title}) requires "{{fuse}}" to be enabled: it {{reason}}.`,
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const reported = new Set<TSESTree.Node>();
    let bindings = collectFuseBindings(context.sourceCode.ast);

    function checkFuseObject(object: TSESTree.ObjectExpression): void {
      for (const [fuseName, reason] of [
        ...MUST_BE_DISABLED.entries(),
        ...MUST_BE_ENABLED.entries(),
      ]) {
        const resolution = resolveObjectProperty(
          context.sourceCode,
          object,
          fuseName,
          0,
          getFuseName,
        );

        if (resolution.kind !== 'found') {
          continue;
        }

        const value = resolveStaticBoolean(context.sourceCode, resolution.node);

        if (value === undefined || reported.has(resolution.node)) {
          continue;
        }

        if (MUST_BE_DISABLED.has(fuseName) && value === true) {
          reported.add(resolution.node);
          context.report({
            node: resolution.node,
            messageId: 'fuseMustBeDisabled',
            data: { fuse: fuseName, reason },
          });
          continue;
        }

        if (MUST_BE_ENABLED.has(fuseName) && value === false) {
          reported.add(resolution.node);
          context.report({
            node: resolution.node,
            messageId: 'fuseMustBeEnabled',
            data: { fuse: fuseName, reason },
          });
        }
      }
    }

    /**
     * True when the object is recognisably a fuse configuration.
     *
     * A shared property name is not enough — `{ RunAsNode: true }` could be any
     * option bag. We require either a `FuseV1Options.*` key, which is
     * unambiguous, or a fuse-config marker (`version`, `strictlyRequireAllFuses`)
     * sitting alongside a known fuse name.
     */
    function isFuseConfig(object: TSESTree.ObjectExpression): boolean {
      let hasFuseEnumKey = false;
      let hasConfigMarker = false;
      let hasKnownFuseName = false;

      for (const property of object.properties) {
        if (property.type !== AST_NODE_TYPES.Property) {
          continue;
        }

        if (
          property.computed &&
          property.key.type === AST_NODE_TYPES.MemberExpression &&
          property.key.object.type === AST_NODE_TYPES.Identifier &&
          property.key.object.name.startsWith('FuseV1Options')
        ) {
          hasFuseEnumKey = true;
        }

        const fuseName = getFuseName(property);

        if (fuseName === 'version' || fuseName === 'strictlyRequireAllFuses') {
          hasConfigMarker = true;
        }

        if (fuseName && (MUST_BE_DISABLED.has(fuseName) || MUST_BE_ENABLED.has(fuseName))) {
          hasKnownFuseName = true;
        }
      }

      return hasFuseEnumKey || (hasConfigMarker && hasKnownFuseName);
    }

    return {
      Program(node) {
        bindings = collectFuseBindings(node);
      },
      ObjectExpression(node) {
        if (isFuseConfig(node)) {
          checkFuseObject(node);
        }
      },
      CallExpression(node) {
        // `flipFuses(appPath, config)` where the config is a constant defined
        // elsewhere in the file.
        if (!isFlipFusesCallee(node.callee, bindings)) {
          return;
        }

        const configArgument = node.arguments[1];

        if (!configArgument || configArgument.type === AST_NODE_TYPES.SpreadElement) {
          return;
        }

        const resolved = resolveObjectExpression(context.sourceCode, configArgument, 0, node);

        if (resolved) {
          checkFuseObject(resolved);
        }
      },
    };
  },
});
