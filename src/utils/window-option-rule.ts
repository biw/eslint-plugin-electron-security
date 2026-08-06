import { TSESLint, TSESTree } from '@typescript-eslint/utils';

import { collectElectronBindings, isElectronWindowNewExpression } from './electron';
import {
  resolveStaticBoolean,
  resolveWindowOption,
  resolveWindowOptionsObject,
} from './resolve';

/**
 * Shared visitor for rules that flag a single boolean flag inside an Electron
 * window option bag.
 *
 * Centralising this means constant/spread resolution is implemented once and
 * every option rule benefits, instead of each rule re-implementing a shallow
 * literal check that one `const` defeats.
 */
export function createWindowOptionVisitor<MessageIds extends string>(
  context: Readonly<TSESLint.RuleContext<MessageIds, readonly unknown[]>>,
  config: {
    optionNames: readonly string[];
    unsafeValue: boolean;
    messageId: MessageIds;
  },
): TSESLint.RuleListener {
  let bindings = collectElectronBindings(context.sourceCode.ast);
  const reported = new Set<TSESTree.Node>();

  return {
    Program(node) {
      bindings = collectElectronBindings(node);
    },
    NewExpression(node) {
      if (!isElectronWindowNewExpression(node, bindings)) {
        return;
      }

      const options = resolveWindowOptionsObject(context.sourceCode, node);

      if (!options) {
        return;
      }

      for (const optionName of config.optionNames) {
        const resolution = resolveWindowOption(context.sourceCode, options, optionName);

        if (resolution.kind !== 'found') {
          continue;
        }

        const value = resolveStaticBoolean(context.sourceCode, resolution.node);

        if (value !== config.unsafeValue) {
          continue;
        }

        // A hoisted option bag shared by several windows should produce one
        // report at the definition, not one per construction site.
        if (reported.has(resolution.node)) {
          continue;
        }

        reported.add(resolution.node);
        context.report({ node: resolution.node, messageId: config.messageId });
      }
    },
  };
}
