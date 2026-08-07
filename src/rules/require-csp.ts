import { AST_NODE_TYPES, TSESLint, TSESTree } from '@typescript-eslint/utils';

import { getRecommendationByRuleId } from '../recommendations';
import {
  getJsxAttribute,
  getPropertyName,
  getStaticJsxStringValue,
  getStaticStringValue,
} from '../utils/ast';
import { createRule } from '../utils/create-rule';
import {
  ElectronBindings,
  collectElectronBindings,
  getMemberPropertyName,
  isElectronSessionExpression,
} from '../utils/electron';
import { FunctionLike, getDeclarationNode, resolveFunctionLike, walkNodes } from '../utils/functions';

const recommendation = getRecommendationByRuleId('require-csp');

const CSP_HEADER_NAME = 'content-security-policy';
const RESPONSE_HEADERS_PROPERTY = 'responseHeaders';
const UNSAFE_INLINE = 'unsafe-inline';
const UNSAFE_EVAL = 'unsafe-eval';

export interface CspOptions {
  allowUnsafeEval: boolean;
  allowUnsafeInline: boolean;
}

interface CspDirective {
  name: string;
  values: string[];
}

interface HeaderCallbackAnalysis {
  /** The callback assembles a `responseHeaders` object literal we can read. */
  buildsHeaders: boolean;
  /** The callback names the CSP header somewhere, so it is not missing. */
  mentionsCsp: boolean;
  /** Something merged into the headers is opaque, so absence cannot be proven. */
  opaqueHeaders: boolean;
}

/** `'self'` and `'unsafe-inline'` are quoted in a policy; compare them unquoted. */
function normalizeCspToken(token: string): string {
  return token.replace(/^'(.*)'$/, '$1').toLowerCase();
}

function isCspHeaderName(name: string): boolean {
  return name.trim().toLowerCase() === CSP_HEADER_NAME;
}

function parseCsp(policy: string): CspDirective[] {
  return policy
    .split(';')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      const [name, ...values] = segment.split(/\s+/);

      return {
        name: (name ?? '').toLowerCase(),
        values: values.map(normalizeCspToken),
      };
    });
}

/** `script-src` replaces, rather than inherits from, the `default-src` fallback. */
function getEffectiveScriptDirective(directives: CspDirective[]): CspDirective | undefined {
  return (
    directives.find((directive) => directive.name === 'script-src') ??
    directives.find((directive) => directive.name === 'default-src')
  );
}

function findUnsafeKeywords(directives: CspDirective[], options: CspOptions): string[] {
  const found = new Set<string>();
  const directive = getEffectiveScriptDirective(directives);

  if (directive) {
    for (const value of directive.values) {
      if (value === UNSAFE_INLINE && !options.allowUnsafeInline) {
        found.add(UNSAFE_INLINE);
      }

      if (value === UNSAFE_EVAL && !options.allowUnsafeEval) {
        found.add(UNSAFE_EVAL);
      }
    }
  }

  return [...found];
}

function hasWildcardSource(directives: CspDirective[]): boolean {
  return getEffectiveScriptDirective(directives)?.values.includes('*') ?? false;
}

/**
 * Reads a string that is written inline, or held by a `const` in the same file.
 *
 * Anything else (a call, an imported constant, an interpolated template) stays
 * unresolved and is left alone rather than guessed at.
 */
function resolveStaticString(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.Node,
  depth = 0,
): string | undefined {
  if (depth > 8) {
    return undefined;
  }

  const direct = getStaticStringValue(node);

  if (direct !== undefined) {
    return direct;
  }

  if (
    node.type === AST_NODE_TYPES.TSAsExpression ||
    node.type === AST_NODE_TYPES.TSNonNullExpression ||
    node.type === AST_NODE_TYPES.TSSatisfiesExpression
  ) {
    return resolveStaticString(sourceCode, node.expression, depth + 1);
  }

  if (node.type !== AST_NODE_TYPES.Identifier) {
    return undefined;
  }

  const declaration = getDeclarationNode(sourceCode, node);

  if (
    !declaration ||
    declaration.type !== AST_NODE_TYPES.VariableDeclarator ||
    !declaration.init ||
    declaration.parent?.type !== AST_NODE_TYPES.VariableDeclaration ||
    declaration.parent.kind !== 'const'
  ) {
    return undefined;
  }

  return resolveStaticString(sourceCode, declaration.init, depth + 1);
}

/**
 * True when a header object merges in values this rule cannot read.
 *
 * Spreading `details.responseHeaders` is the documented Electron pattern and
 * carries no policy of its own, but any other spread or dynamic key could be
 * setting the CSP out of sight.
 */
function hasOpaqueHeaders(
  node: TSESTree.ObjectExpression,
  detailsParameterName: string | undefined,
): boolean {
  return node.properties.some((property) => {
    if (property.type === AST_NODE_TYPES.SpreadElement) {
      return !(
        detailsParameterName !== undefined &&
        property.argument.type === AST_NODE_TYPES.MemberExpression &&
        property.argument.object.type === AST_NODE_TYPES.Identifier &&
        property.argument.object.name === detailsParameterName &&
        getMemberPropertyName(property.argument) === RESPONSE_HEADERS_PROPERTY
      );
    }

    return property.computed && getStaticStringValue(property.key) === undefined;
  });
}

function analyzeHeaderCallback(
  sourceCode: Readonly<TSESLint.SourceCode>,
  callback: FunctionLike,
): HeaderCallbackAnalysis {
  const analysis: HeaderCallbackAnalysis = {
    buildsHeaders: false,
    mentionsCsp: false,
    opaqueHeaders: false,
  };
  const firstParameter = callback.params[0];
  const detailsParameterName =
    firstParameter?.type === AST_NODE_TYPES.Identifier ? firstParameter.name : undefined;

  walkNodes(sourceCode, callback.body, (candidate) => {
    const literal = getStaticStringValue(candidate);

    if (literal !== undefined && isCspHeaderName(literal)) {
      analysis.mentionsCsp = true;
    }

    if (
      candidate.type !== AST_NODE_TYPES.Property ||
      candidate.computed ||
      getPropertyName(candidate.key) !== RESPONSE_HEADERS_PROPERTY ||
      candidate.value.type !== AST_NODE_TYPES.ObjectExpression
    ) {
      return;
    }

    analysis.buildsHeaders = true;

    if (hasOpaqueHeaders(candidate.value, detailsParameterName)) {
      analysis.opaqueHeaders = true;
    }
  });

  return analysis;
}

function isWebRequestOnHeadersReceived(
  sourceCode: Readonly<TSESLint.SourceCode>,
  callee: TSESTree.MemberExpression,
  bindings: ElectronBindings,
): boolean {
  if (
    getMemberPropertyName(callee) !== 'onHeadersReceived' ||
    callee.object.type !== AST_NODE_TYPES.MemberExpression ||
    getMemberPropertyName(callee.object) !== 'webRequest' ||
    callee.object.object.type === AST_NODE_TYPES.Super
  ) {
    return false;
  }

  return isElectronSessionExpression(sourceCode, callee.object.object, bindings);
}

export default createRule<
  [Partial<CspOptions>?],
  'missingCspHeader' | 'unsafeCspDirective' | 'wildcardCspDirective'
>({
  name: 'require-csp',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require a Content Security Policy that is actually restrictive when one is defined.',
    },
    messages: {
      missingCspHeader: `Electron recommendation ${recommendation.number} (${recommendation.title}) requires response headers built in onHeadersReceived to set a Content-Security-Policy header.`,
      unsafeCspDirective: `Electron recommendation ${recommendation.number} (${recommendation.title}) is defeated by 'unsafe-inline' or 'unsafe-eval': a policy that permits inline or evaluated script is close to having no policy at all.`,
      wildcardCspDirective: `Electron recommendation ${recommendation.number} (${recommendation.title}) requires a restrictive policy, but this one allows script from any origin with a wildcard default-src or script-src.`,
    },
    schema: [
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          allowUnsafeEval: {
            type: 'boolean',
            description:
              "Do not report 'unsafe-eval' in a Content Security Policy. Use this only when a dependency genuinely requires runtime evaluation.",
          },
          allowUnsafeInline: {
            type: 'boolean',
            description:
              "Do not report 'unsafe-inline' in a script policy. Use this only while migrating inline scripts to hashes or nonces.",
          },
        },
      },
    ],
  },
  defaultOptions: [{ allowUnsafeEval: false, allowUnsafeInline: false }],
  create(context, [rawOptions]) {
    const options: CspOptions = {
      allowUnsafeEval: rawOptions?.allowUnsafeEval ?? false,
      allowUnsafeInline: rawOptions?.allowUnsafeInline ?? false,
    };
    let bindings = collectElectronBindings(context.sourceCode.ast);

    function reportPolicy(node: TSESTree.Node, policy: string): void {
      const directives = parseCsp(policy);

      if (findUnsafeKeywords(directives, options).length > 0) {
        context.report({ node, messageId: 'unsafeCspDirective' });
      }

      if (hasWildcardSource(directives)) {
        context.report({ node, messageId: 'wildcardCspDirective' });
      }
    }

    function checkPolicyNode(node: TSESTree.Node): void {
      const policy = resolveStaticString(context.sourceCode, node);

      if (policy !== undefined) {
        reportPolicy(node, policy);
      }
    }

    /** A CSP header value is a string, or an array of them for repeated headers. */
    function checkPolicyValue(node: TSESTree.Node): void {
      if (node.type !== AST_NODE_TYPES.ArrayExpression) {
        checkPolicyNode(node);
        return;
      }

      for (const element of node.elements) {
        if (element && element.type !== AST_NODE_TYPES.SpreadElement) {
          checkPolicyNode(element);
        }
      }
    }

    return {
      Program(node) {
        bindings = collectElectronBindings(node);
      },
      AssignmentExpression(node) {
        if (node.operator !== '=' || node.left.type !== AST_NODE_TYPES.MemberExpression) {
          return;
        }

        const headerName = getMemberPropertyName(node.left);

        if (headerName && isCspHeaderName(headerName)) {
          checkPolicyValue(node.right);
        }
      },
      CallExpression(node) {
        if (
          node.callee.type !== AST_NODE_TYPES.MemberExpression ||
          !isWebRequestOnHeadersReceived(context.sourceCode, node.callee, bindings)
        ) {
          return;
        }

        // onHeadersReceived accepts an optional filter, so take the last
        // argument that actually resolves to a function.
        let callbackArgument: TSESTree.Expression | undefined;
        let callback: FunctionLike | undefined;

        for (const argument of node.arguments) {
          if (argument.type === AST_NODE_TYPES.SpreadElement) {
            continue;
          }

          const resolved = resolveFunctionLike(context.sourceCode, argument);

          if (resolved) {
            callbackArgument = argument;
            callback = resolved;
          }
        }

        if (!callback || !callbackArgument) {
          return;
        }

        const analysis = analyzeHeaderCallback(context.sourceCode, callback);

        if (analysis.buildsHeaders && !analysis.mentionsCsp && !analysis.opaqueHeaders) {
          context.report({ node: callbackArgument, messageId: 'missingCspHeader' });
        }
      },
      JSXOpeningElement(node) {
        if (node.name.type !== AST_NODE_TYPES.JSXIdentifier || node.name.name !== 'meta') {
          return;
        }

        const httpEquiv = getJsxAttribute(node, 'httpEquiv') ?? getJsxAttribute(node, 'http-equiv');
        const httpEquivValue = getStaticJsxStringValue(httpEquiv);

        if (httpEquivValue === undefined || !isCspHeaderName(httpEquivValue)) {
          return;
        }

        const content = getJsxAttribute(node, 'content');
        const policy = getStaticJsxStringValue(content);

        if (content?.value && policy !== undefined) {
          reportPolicy(content.value, policy);
        }
      },
      Property(node) {
        const headerName = node.computed
          ? getStaticStringValue(node.key)
          : getPropertyName(node.key);

        if (headerName && isCspHeaderName(headerName)) {
          checkPolicyValue(node.value);
        }
      },
    };
  },
});
