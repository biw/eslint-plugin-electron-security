import { AST_NODE_TYPES, TSESLint, TSESTree } from '@typescript-eslint/utils';

import { getDeclarationNode, getLatestBindingValue, unwrapExpression } from './functions';

export interface ElectronBindings {
  BrowserWindow: Set<string>;
  WebContentsView: Set<string>;
  contextBridge: Set<string>;
  /** Local bindings indexed by their original named Electron export. */
  importedApis: Map<string, Set<string>>;
  electronApis: Set<string>;
  ipcMain: Set<string>;
  ipcRenderer: Set<string>;
  namespaces: Set<string>;
  shell: Set<string>;
}

function createBindings(): ElectronBindings {
  return {
    BrowserWindow: new Set<string>(),
    WebContentsView: new Set<string>(),
    contextBridge: new Set<string>(),
    importedApis: new Map<string, Set<string>>(),
    electronApis: new Set<string>(),
    ipcMain: new Set<string>(),
    ipcRenderer: new Set<string>(),
    namespaces: new Set<string>(),
    shell: new Set<string>(),
  };
}

function recordElectronApiBinding(
  bindings: ElectronBindings,
  importedName: string,
  localName: string,
): void {
  bindings.electronApis.add(localName);

  const importedBindings = bindings.importedApis.get(importedName) ?? new Set<string>();
  importedBindings.add(localName);
  bindings.importedApis.set(importedName, importedBindings);

  const dedicatedBinding = bindings[importedName as keyof ElectronBindings];

  if (dedicatedBinding instanceof Set) {
    dedicatedBinding.add(localName);
  }
}

function isRequireCall(node: TSESTree.Expression | null): boolean {
  return (
    node !== null &&
    node.type === AST_NODE_TYPES.CallExpression &&
    node.callee.type === AST_NODE_TYPES.Identifier &&
    node.callee.name === 'require' &&
    node.arguments.length === 1 &&
    node.arguments[0]?.type === AST_NODE_TYPES.Literal &&
    node.arguments[0].value === 'electron'
  );
}

export function collectElectronBindings(program: TSESTree.Program): ElectronBindings {
  const bindings = createBindings();

  for (const statement of program.body) {
    if (statement.type === AST_NODE_TYPES.ImportDeclaration && statement.source.value === 'electron') {
      for (const specifier of statement.specifiers) {
        if (specifier.type === AST_NODE_TYPES.ImportSpecifier) {
          const importedName =
            specifier.imported.type === AST_NODE_TYPES.Identifier
              ? specifier.imported.name
              : String(specifier.imported.value);

          recordElectronApiBinding(bindings, importedName, specifier.local.name);
        } else if (specifier.type === AST_NODE_TYPES.ImportNamespaceSpecifier) {
          bindings.namespaces.add(specifier.local.name);
        }
      }
    }

    if (statement.type !== AST_NODE_TYPES.VariableDeclaration) {
      continue;
    }

    for (const declaration of statement.declarations) {
      if (!isRequireCall(declaration.init)) {
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
        if (property.type !== AST_NODE_TYPES.Property || property.key.type !== AST_NODE_TYPES.Identifier) {
          continue;
        }

        const importedName = property.key.name;
        const localName =
          property.value.type === AST_NODE_TYPES.Identifier ? property.value.name : importedName;

        recordElectronApiBinding(bindings, importedName, localName);
      }
    }
  }

  return bindings;
}

/**
 * True when an expression resolves to one specific Electron named export.
 *
 * Unlike the dedicated binding sets above, this works for every Electron API
 * and preserves the exported name when it is imported under an alias.
 */
export function isElectronNamedApiExpression(
  node: TSESTree.Expression,
  apiName: string,
  bindings: ElectronBindings,
): boolean {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return bindings.importedApis.get(apiName)?.has(node.name) ?? false;
  }

  if (node.type !== AST_NODE_TYPES.MemberExpression) {
    return false;
  }

  return (
    node.object.type === AST_NODE_TYPES.Identifier &&
    bindings.namespaces.has(node.object.name) &&
    getMemberPropertyName(node) === apiName
  );
}

/** True for Electron's `session` module itself, including aliased imports. */
export function isElectronSessionModuleExpression(
  node: TSESTree.Expression,
  bindings: ElectronBindings,
): boolean {
  return isElectronNamedApiExpression(node, 'session', bindings);
}

const SESSION_FACTORY_METHODS = new Set(['fromPartition', 'fromPath']);

function isElectronWindowExpression(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.Expression,
  bindings: ElectronBindings,
  seenDeclarations = new Set<TSESTree.Node>(),
): boolean {
  const expression = unwrapExpression(node);

  if (expression.type === AST_NODE_TYPES.NewExpression) {
    return isElectronWindowNewExpression(expression, bindings);
  }

  if (expression.type !== AST_NODE_TYPES.Identifier) {
    return false;
  }

  const declaration = getDeclarationNode(sourceCode, expression);

  if (
    !declaration ||
    seenDeclarations.has(declaration) ||
    declaration.type !== AST_NODE_TYPES.VariableDeclarator
  ) {
    return false;
  }

  const value = getLatestBindingValue(sourceCode, expression) ?? declaration.init;

  if (!value) {
    return false;
  }

  const nextSeen = new Set(seenDeclarations);
  nextSeen.add(declaration);

  return isElectronWindowExpression(sourceCode, value, bindings, nextSeen);
}

/**
 * True for a WebContents owned by an Electron BrowserWindow or WebContentsView.
 * Local aliases are followed at their latest write so the resolver recognises
 * `win.webContents.session` and `const contents = win.webContents`.
 */
function isElectronWebContentsExpression(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.Expression,
  bindings: ElectronBindings,
  seenDeclarations = new Set<TSESTree.Node>(),
): boolean {
  const expression = unwrapExpression(node);

  if (
    expression.type === AST_NODE_TYPES.MemberExpression &&
    getMemberPropertyName(expression) === 'webContents' &&
    expression.object.type !== AST_NODE_TYPES.Super
  ) {
    return isElectronWindowExpression(sourceCode, expression.object, bindings);
  }

  if (expression.type !== AST_NODE_TYPES.Identifier) {
    return false;
  }

  const declaration = getDeclarationNode(sourceCode, expression);

  if (
    !declaration ||
    seenDeclarations.has(declaration) ||
    declaration.type !== AST_NODE_TYPES.VariableDeclarator
  ) {
    return false;
  }

  const value = getLatestBindingValue(sourceCode, expression) ?? declaration.init;

  if (!value) {
    return false;
  }

  const nextSeen = new Set(seenDeclarations);
  nextSeen.add(declaration);

  return isElectronWebContentsExpression(sourceCode, value, bindings, nextSeen);
}

/**
 * True for a Session object that can be traced locally from Electron's
 * `session` module or an Electron WebContents. Aliases are followed at their
 * latest write, so both const and canonical mutable handles remain recognisable.
 */
export function isElectronSessionExpression(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.Expression,
  bindings: ElectronBindings,
  seenDeclarations = new Set<TSESTree.Node>(),
): boolean {
  const expression = unwrapExpression(node);

  if (
    expression.type === AST_NODE_TYPES.MemberExpression &&
    getMemberPropertyName(expression) === 'session' &&
    expression.object.type !== AST_NODE_TYPES.Super &&
    isElectronWebContentsExpression(sourceCode, expression.object, bindings)
  ) {
    return true;
  }

  if (
    expression.type === AST_NODE_TYPES.MemberExpression &&
    getMemberPropertyName(expression) === 'defaultSession' &&
    expression.object.type !== AST_NODE_TYPES.Super &&
    isElectronSessionModuleExpression(expression.object, bindings)
  ) {
    return true;
  }

  if (
    expression.type === AST_NODE_TYPES.CallExpression &&
    expression.callee.type === AST_NODE_TYPES.MemberExpression &&
    SESSION_FACTORY_METHODS.has(getMemberPropertyName(expression.callee) ?? '') &&
    expression.callee.object.type !== AST_NODE_TYPES.Super &&
    isElectronSessionModuleExpression(expression.callee.object, bindings)
  ) {
    return true;
  }

  if (expression.type !== AST_NODE_TYPES.Identifier) {
    return false;
  }

  const declaration = getDeclarationNode(sourceCode, expression);

  if (
    !declaration ||
    seenDeclarations.has(declaration) ||
    declaration.type !== AST_NODE_TYPES.VariableDeclarator
  ) {
    return false;
  }

  const value = getLatestBindingValue(sourceCode, expression) ?? declaration.init;

  if (!value) {
    return false;
  }

  const nextSeen = new Set(seenDeclarations);
  nextSeen.add(declaration);

  return isElectronSessionExpression(sourceCode, value, bindings, nextSeen);
}

export function getMemberPropertyName(node: TSESTree.MemberExpression): string | undefined {
  if (!node.computed && node.property.type === AST_NODE_TYPES.Identifier) {
    return node.property.name;
  }

  if (node.property.type === AST_NODE_TYPES.Literal && typeof node.property.value === 'string') {
    return node.property.value;
  }

  return undefined;
}

export function isIpcRendererExpression(
  node: TSESTree.Expression,
  bindings: ElectronBindings,
): boolean {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return bindings.ipcRenderer.has(node.name);
  }

  if (node.type !== AST_NODE_TYPES.MemberExpression) {
    return false;
  }

  const propertyName = getMemberPropertyName(node);

  return (
    node.object.type === AST_NODE_TYPES.Identifier &&
    bindings.namespaces.has(node.object.name) &&
    propertyName === 'ipcRenderer'
  );
}

export function isElectronApiExpression(
  node: TSESTree.Expression,
  bindings: ElectronBindings,
): boolean {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return bindings.electronApis.has(node.name);
  }

  if (node.type !== AST_NODE_TYPES.MemberExpression) {
    return false;
  }

  const propertyName = getMemberPropertyName(node);

  return (
    node.object.type === AST_NODE_TYPES.Identifier &&
    bindings.namespaces.has(node.object.name) &&
    typeof propertyName === 'string'
  );
}

export function isIpcMainExpression(
  node: TSESTree.Expression,
  bindings: ElectronBindings,
): boolean {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return bindings.ipcMain.has(node.name);
  }

  if (node.type !== AST_NODE_TYPES.MemberExpression) {
    return false;
  }

  const propertyName = getMemberPropertyName(node);

  return (
    node.object.type === AST_NODE_TYPES.Identifier &&
    bindings.namespaces.has(node.object.name) &&
    propertyName === 'ipcMain'
  );
}

export function isContextBridgeExpression(
  node: TSESTree.Expression,
  bindings: ElectronBindings,
): boolean {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return bindings.contextBridge.has(node.name);
  }

  if (node.type !== AST_NODE_TYPES.MemberExpression) {
    return false;
  }

  const propertyName = getMemberPropertyName(node);

  return (
    node.object.type === AST_NODE_TYPES.Identifier &&
    bindings.namespaces.has(node.object.name) &&
    propertyName === 'contextBridge'
  );
}

export function isContextBridgeExposeCall(
  node: TSESTree.CallExpression,
  bindings: ElectronBindings,
): boolean {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) {
    return false;
  }

  return (
    getMemberPropertyName(node.callee) === 'exposeInMainWorld' &&
    isContextBridgeExpression(node.callee.object, bindings)
  );
}

export function isElectronWindowNewExpression(
  node: TSESTree.NewExpression,
  bindings: ElectronBindings,
): boolean {
  if (node.callee.type === AST_NODE_TYPES.Identifier) {
    return bindings.BrowserWindow.has(node.callee.name) || bindings.WebContentsView.has(node.callee.name);
  }

  if (node.callee.type === AST_NODE_TYPES.MemberExpression) {
    const object = node.callee.object;
    const propertyName = getMemberPropertyName(node.callee);

    return (
      object.type === AST_NODE_TYPES.Identifier &&
      bindings.namespaces.has(object.name) &&
      (propertyName === 'BrowserWindow' || propertyName === 'WebContentsView')
    );
  }

  return false;
}

export function isTrackedLoadUrlTarget(
  node: TSESTree.Expression,
  trackedWindows: Set<string>,
  bindings: ElectronBindings,
): TSESTree.NewExpression | undefined {
  if (node.type === AST_NODE_TYPES.Identifier && trackedWindows.has(node.name)) {
    return undefined;
  }

  if (node.type === AST_NODE_TYPES.NewExpression && isElectronWindowNewExpression(node, bindings)) {
    return node;
  }

  if (node.type === AST_NODE_TYPES.MemberExpression && getMemberPropertyName(node) === 'webContents') {
    const object = node.object;

    if (object.type === AST_NODE_TYPES.Identifier && trackedWindows.has(object.name)) {
      return undefined;
    }

    if (object.type === AST_NODE_TYPES.NewExpression && isElectronWindowNewExpression(object, bindings)) {
      return object;
    }
  }

  return undefined;
}

export function isShellOpenExternalCall(
  node: TSESTree.CallExpression,
  bindings: ElectronBindings,
): boolean {
  return isShellOpenExternalExpression(node.callee, bindings);
}

export function isShellOpenExternalExpression(
  node: TSESTree.Expression,
  bindings: ElectronBindings,
): boolean {
  if (node.type !== AST_NODE_TYPES.MemberExpression) {
    return false;
  }

  const propertyName = getMemberPropertyName(node);
  if (propertyName !== 'openExternal') {
    return false;
  }

  const object = node.object;

  if (object.type === AST_NODE_TYPES.Identifier && bindings.shell.has(object.name)) {
    return true;
  }

  if (object.type !== AST_NODE_TYPES.MemberExpression) {
    return false;
  }

  const objectPropertyName = getMemberPropertyName(object);

  return (
    object.object.type === AST_NODE_TYPES.Identifier &&
    bindings.namespaces.has(object.object.name) &&
    objectPropertyName === 'shell'
  );
}
