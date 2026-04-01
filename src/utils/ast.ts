import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';

function getLiteralString(node: TSESTree.Node): string | undefined {
  if (node.type === AST_NODE_TYPES.Literal && typeof node.value === 'string') {
    return node.value;
  }

  return undefined;
}

function asExpression(node: TSESTree.Property['value']): TSESTree.Expression | undefined {
  switch (node.type) {
    case AST_NODE_TYPES.ArrayPattern:
    case AST_NODE_TYPES.AssignmentPattern:
    case AST_NODE_TYPES.ObjectPattern:
    case AST_NODE_TYPES.TSEmptyBodyFunctionExpression:
      return undefined;
    default:
      return node;
  }
}

export function getPropertyName(node: TSESTree.Property['key']): string | undefined {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return node.name;
  }

  return getLiteralString(node);
}

export function getObjectProperty(
  node: TSESTree.ObjectExpression,
  propertyName: string,
): TSESTree.Property | undefined {
  return node.properties.find((property): property is TSESTree.Property => {
    if (property.type !== AST_NODE_TYPES.Property || property.kind !== 'init' || property.computed) {
      return false;
    }

    return getPropertyName(property.key) === propertyName;
  });
}

export function getNestedObjectExpression(
  node: TSESTree.ObjectExpression,
  propertyName: string,
): TSESTree.ObjectExpression | undefined {
  const property = getObjectProperty(node, propertyName);

  if (!property || property.value.type !== AST_NODE_TYPES.ObjectExpression) {
    return undefined;
  }

  return property.value;
}

export function findWindowOptionValue(
  node: TSESTree.ObjectExpression,
  optionName: string,
): TSESTree.Expression | undefined {
  const nestedWebPreferences = getNestedObjectExpression(node, 'webPreferences');
  const nestedProperty = nestedWebPreferences ? getObjectProperty(nestedWebPreferences, optionName) : undefined;

  if (nestedProperty) {
    return asExpression(nestedProperty.value);
  }

  const topLevelProperty = getObjectProperty(node, optionName);
  return topLevelProperty ? asExpression(topLevelProperty.value) : undefined;
}

export function getStaticBooleanValue(node: TSESTree.Node | null | undefined): boolean | undefined {
  if (!node) {
    return undefined;
  }

  if (node.type === AST_NODE_TYPES.Literal && typeof node.value === 'boolean') {
    return node.value;
  }

  return undefined;
}

export function getStaticStringValue(node: TSESTree.Node | null | undefined): string | undefined {
  if (!node) {
    return undefined;
  }

  if (node.type === AST_NODE_TYPES.Literal && typeof node.value === 'string') {
    return node.value;
  }

  if (
    node.type === AST_NODE_TYPES.TemplateLiteral &&
    node.expressions.length === 0 &&
    node.quasis.length === 1
  ) {
    return node.quasis[0]?.value.cooked ?? undefined;
  }

  return undefined;
}

export function isWebViewElement(node: TSESTree.JSXOpeningElement): boolean {
  return node.name.type === AST_NODE_TYPES.JSXIdentifier && node.name.name === 'webview';
}

export function getJsxAttribute(
  node: TSESTree.JSXOpeningElement,
  attributeName: string,
): TSESTree.JSXAttribute | undefined {
  return node.attributes.find((attribute): attribute is TSESTree.JSXAttribute => {
    return (
      attribute.type === AST_NODE_TYPES.JSXAttribute &&
      attribute.name.type === AST_NODE_TYPES.JSXIdentifier &&
      attribute.name.name.toLowerCase() === attributeName.toLowerCase()
    );
  });
}

export function getStaticJsxStringValue(attribute: TSESTree.JSXAttribute | undefined): string | undefined {
  if (!attribute || !attribute.value) {
    return undefined;
  }

  if (attribute.value.type === AST_NODE_TYPES.Literal && typeof attribute.value.value === 'string') {
    return attribute.value.value;
  }

  if (attribute.value.type === AST_NODE_TYPES.JSXExpressionContainer) {
    return getStaticStringValue(attribute.value.expression);
  }

  return undefined;
}

export function getStaticJsxBooleanValue(attribute: TSESTree.JSXAttribute | undefined): boolean | undefined {
  if (!attribute) {
    return undefined;
  }

  if (!attribute.value) {
    return true;
  }

  if (attribute.value.type === AST_NODE_TYPES.JSXExpressionContainer) {
    return getStaticBooleanValue(attribute.value.expression);
  }

  if (attribute.value.type === AST_NODE_TYPES.Literal) {
    if (typeof attribute.value.value === 'boolean') {
      return attribute.value.value;
    }

    if (attribute.value.value === 'true') {
      return true;
    }

    if (attribute.value.value === 'false') {
      return false;
    }
  }

  return undefined;
}
