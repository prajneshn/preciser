import * as vscode from "vscode";

const lifecycleHooks = new Set([
  "super",
  "constructor",
  "ngOnInit",
  "ngOnDestroy",
  "ngAfterViewInit",
  "componentDidMount",
  "componentWillUnmount",
  "shouldComponentUpdate",
]);

function hasControlFlow(body: string): boolean {
  return /if\s*\(|for\s*\(|while\s*\(|switch\s*\(|else\s*|else\s+if\s*\(|do\s*\{/.test(
    body
  );
}

export function shouldSkipConversion(
  functionName: string,
  functionBody: string
): boolean {
  if (hasControlFlow(functionBody)) {
    return true;
  }
  if (lifecycleHooks.has(functionName)) {
    return true;
  }
  return false;
}

export function findEndPosition(
  document: vscode.TextDocument,
  startLine: number
): vscode.Position {
  let endLine = startLine;
  const braceStack: string[] = [];

  for (let i = startLine; i < document.lineCount; i++) {
    const lineText = document.lineAt(i).text;
    for (const char of lineText) {
      if (char === "{") {
        braceStack.push("{");
      } else if (char === "}") {
        braceStack.pop();
        if (braceStack.length === 0) {
          endLine = i;
          break;
        }
      }
    }

    if (braceStack.length === 0) {
      break;
    }
  }

  return new vscode.Position(endLine, document.lineAt(endLine).text.length);
}
