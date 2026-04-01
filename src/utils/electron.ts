import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';

export interface ElectronBindings {
  BrowserWindow: Set<string>;
  WebContentsView: Set<string>;
  contextBridge: Set<string>;
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
    electronApis: new Set<string>(),
    ipcMain: new Set<string>(),
    ipcRenderer: new Set<string>(),
    namespaces: new Set<string>(),
    shell: new Set<string>(),
  };
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

          bindings.electronApis.add(specifier.local.name);

          if (importedName in bindings) {
            bindings[importedName as keyof Omit<ElectronBindings, 'namespaces'>].add(specifier.local.name);
          }
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

        bindings.electronApis.add(localName);

        if (importedName in bindings) {
          bindings[importedName as keyof Omit<ElectronBindings, 'namespaces'>].add(localName);
        }
      }
    }
  }

  return bindings;
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

export function getWindowOptionsObject(node: TSESTree.NewExpression): TSESTree.ObjectExpression | undefined {
  const firstArgument = node.arguments[0];

  if (!firstArgument || firstArgument.type !== AST_NODE_TYPES.ObjectExpression) {
    return undefined;
  }

  return firstArgument;
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
