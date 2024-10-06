import * as ts from "typescript";

export function hasSimpleReturnFunctions(
  code: string,
  className?: string
): boolean {
  var trimmedCode = code.replace(/^[ \t]+|[ \t]+$/gm, "");
  if (className) {
    trimmedCode = "class " + className + "{" + trimmedCode + "}";
  }
  const sourceFile = ts.createSourceFile(
    "example.ts",
    trimmedCode,
    ts.ScriptTarget.Latest,
    true
  );

  function isSimpleFunction(node: ts.Node): boolean {
    if (ts.isBlock(node)) {
      const statements = node.statements;
      return statements.length === 1;
    }
    return false;
  }

  let hasSimpleReturn = false;

  function findSimpleReturnFunctions(node: ts.Node): void {
    if (
      ts.isMethodDeclaration(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node)
    ) {
      if (node.body && isSimpleFunction(node.body)) {
        hasSimpleReturn = true;
      }
    }

    ts.forEachChild(node, findSimpleReturnFunctions);
  }

  findSimpleReturnFunctions(sourceFile);
  return hasSimpleReturn;
}
