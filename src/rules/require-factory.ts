import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';

import { createRule } from '../utils/create-rule';
import {
  collectElectronBindings,
  ElectronBindings,
  getMemberPropertyName,
  isElectronNamedApiExpression,
} from '../utils/electron';
import { matchesAnyPath } from '../utils/paths';

/**
 * Electron APIs that can be routed through a project-owned wrapper.
 *
 * Constructor entries are matched on `new Foo(...)`; the rest are matched on
 * `namespace.method(...)` calls.
 */
const CONSTRUCTOR_API_NAMES = [
  'BaseWindow',
  'BrowserView',
  'BrowserWindow',
  'Menu',
  'MenuItem',
  'MessageChannelMain',
  'Notification',
  'ShareMenu',
  'TouchBar',
  'Tray',
  'View',
  'WebContentsView',
] as const;
const CONSTRUCTOR_APIS = new Set<string>(CONSTRUCTOR_API_NAMES);
const NAMESPACE_METHOD_PATTERN = '^[A-Za-z_$][A-Za-z0-9_$]*\\.[A-Za-z_$][A-Za-z0-9_$]*$';

interface FactoryRule {
  allowIn: string[];
  api: string;
  use?: string;
}

export interface RequireFactoryOptions {
  factories: FactoryRule[];
}

interface ParsedApi {
  method?: string;
  namespace: string;
}

function parseApi(api: string): ParsedApi {
  const [namespace, method] = api.split('.');

  return method === undefined
    ? { namespace: namespace ?? api }
    : { method, namespace: namespace ?? '' };
}

/**
 * True when `node` refers to the named Electron export, whether it was imported
 * directly, aliased, pulled off a namespace import, or destructured from
 * `require('electron')`.
 */
function isElectronNamespace(
  node: TSESTree.Node,
  namespaceName: string,
  bindings: ElectronBindings,
): boolean {
  return isElectronNamedApiExpression(node as TSESTree.Expression, namespaceName, bindings);
}

export default createRule<[Partial<RequireFactoryOptions>?], 'useFactory'>({
  name: 'require-factory',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require Electron APIs to be constructed through a project-owned factory rather than called directly.',
    },
    messages: {
      useFactory:
        '"{{api}}" must go through {{replacement}}. Direct use is only allowed in: {{allowIn}}.',
    },
    schema: [
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          factories: {
            type: 'array',
            description:
              'Electron APIs that must be routed through a wrapper, and the files allowed to call them directly.',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['api', 'allowIn'],
              properties: {
                api: {
                  anyOf: [
                    { type: 'string', enum: [...CONSTRUCTOR_API_NAMES] },
                    { type: 'string', pattern: NAMESPACE_METHOD_PATTERN },
                  ],
                  description:
                    'A supported Electron constructor or namespace method to restrict, such as "BrowserWindow", "Notification", "ipcMain.handle" or "shell.openExternal".',
                },
                use: {
                  type: 'string',
                  description:
                    'Name of the wrapper callers should use instead. Only used in the message.',
                },
                allowIn: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Files permitted to call the API directly. Bare paths match as suffixes; "*" and "**" are supported.',
                },
              },
            },
          },
        },
      },
    ],
  },
  defaultOptions: [{ factories: [] }],
  create(context, [rawOptions]) {
    const factories = rawOptions?.factories ?? [];

    // With no configuration the rule is inert, so it is safe to enable by
    // default and opt into later.
    if (factories.length === 0) {
      return {};
    }

    const filename = context.filename;
    const active = factories.filter((factory) => !matchesAnyPath(filename, factory.allowIn));

    if (active.length === 0) {
      return {};
    }

    let bindings = collectElectronBindings(context.sourceCode.ast);

    function report(node: TSESTree.Node, factory: FactoryRule): void {
      context.report({
        node,
        messageId: 'useFactory',
        data: {
          api: factory.api,
          allowIn: factory.allowIn.join(', '),
          replacement: factory.use ? `"${factory.use}"` : 'the project factory',
        },
      });
    }

    return {
      Program(node) {
        bindings = collectElectronBindings(node);
      },
      NewExpression(node) {
        for (const factory of active) {
          const { method, namespace } = parseApi(factory.api);

          if (method !== undefined || !CONSTRUCTOR_APIS.has(namespace)) {
            continue;
          }

          if (isElectronNamespace(node.callee, namespace, bindings)) {
            report(node, factory);
          }
        }
      },
      CallExpression(node) {
        if (node.callee.type !== AST_NODE_TYPES.MemberExpression) {
          return;
        }

        const calledMethod = getMemberPropertyName(node.callee);

        for (const factory of active) {
          const { method, namespace } = parseApi(factory.api);

          if (method === undefined || calledMethod !== method) {
            continue;
          }

          if (isElectronNamespace(node.callee.object, namespace, bindings)) {
            report(node, factory);
          }
        }
      },
    };
  },
});
