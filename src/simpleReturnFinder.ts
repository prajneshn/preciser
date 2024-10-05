import * as ts from "typescript";

export function hasSimpleReturnFunctions(code: string): boolean {
  const sourceFile = ts.createSourceFile(
    "example.ts", // Arbitrary file name for parsing
    code, // Your code input
    ts.ScriptTarget.Latest, // Script target (latest TypeScript version)
    true // Set to true to create an immutable files
  );

  // Function to check if a node contains only a return statement
  function isSimpleReturnFunction(node: any): boolean {
    let returnCount = 0;
    let containsOtherCode = false;

    // Traverse the function body and inspect its statements
    function traverse(node: ts.Node): void {
      if (ts.isReturnStatement(node)) {
        returnCount++;
      } else if (ts.isBlock(node)) {
        // Ensure that the block contains only one return statement
        const statements = node.statements;
        if (statements.length !== 1 || !ts.isReturnStatement(statements[0])) {
          containsOtherCode = true;
        }
      } else if (
        ts.isExpressionStatement(node) ||
        ts.isVariableStatement(node) ||
        ts.isIfStatement(node) ||
        ts.isForStatement(node) ||
        ts.isWhileStatement(node) // Exclude other control statements
      ) {
        containsOtherCode = true;
      }

      ts.forEachChild(node, traverse);
    }

    traverse(node);
    return returnCount === 1 && !containsOtherCode;
  }

  // Function to traverse the AST and find functions/methods with a simple return
  let hasSimpleReturn = false; // Flag to track if any simple return functions are found

  function findSimpleReturnFunctions(node: any): void {
    if (ts.isFunctionLike(node) && isSimpleReturnFunction(node)) {
      hasSimpleReturn = true; // Set the flag if a simple return function is found
    }

    // Traverse child nodes
    ts.forEachChild(node, findSimpleReturnFunctions);
  }

  // Start the AST traversal
  findSimpleReturnFunctions(sourceFile);

  return hasSimpleReturn; // Return true or false
}
