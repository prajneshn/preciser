import * as vscode from "vscode";

function hasControlFlow(body: string): boolean {
  return /if\s*\(|for\s*\(|while\s*\(|switch\s*\(/.test(body);
}

function hasMultipleStatements(body: string): boolean {
  return /\n/.test(body) && !/^[^\{\}\n]*$/.test(body);
}

function usesThis(body: string): boolean {
  return /this\./.test(body);
}

function provideCodeActions(
  document: vscode.TextDocument,
  range: vscode.Range
): vscode.CodeAction[] {
  try {
    const start = new vscode.Position(range.start.line, 0);
    let endLine = range.end.line;

    let currentLine = document.lineAt(endLine);
    let text = currentLine.text.trim();

    while (endLine < document.lineCount - 1 && !text.endsWith("}")) {
      endLine++;
      currentLine = document.lineAt(endLine);
      text = currentLine.text.trim();
    }

    const end = new vscode.Position(endLine, currentLine.text.length);
    const selectedText = document.getText(new vscode.Range(start, end));

    const methodRegex =
      /(\w+)\s*\(([^)]*)\)\s*(?::\s*[\w<>\[\]]*)?\s*\{([\s\S]*?)\}/s;
    const functionRegex =
      /function\s*(\w+)\s*\(([^)]*)\)\s*(?::\s*[\w<>\[\]]*)?\s*\{([\s\S]*?)\}/s;
    const arrowFunctionRegex =
      /(\w+)\s*=\s*\(([^)]*)\)\s*(?::\s*[\w<>\[\]]*)?\s*=>\s*\{([\s\S]*?)\};/s;

    const lifecycleHooks = new Set([
      "constructor",
      "ngOnInit",
      "ngOnDestroy",
      "ngAfterViewInit",
      "componentDidMount",
      "componentWillUnmount",
      "shouldComponentUpdate",
    ]);

    let matches =
      methodRegex.exec(selectedText) || functionRegex.exec(selectedText);
    if (matches) {
      const functionName = matches[1];
      let functionBody = matches[3].trim();

      if (hasMultipleStatements(functionBody) || hasControlFlow(functionBody)) {
        return [];
      }

      if (functionBody.startsWith("return ")) {
        functionBody = functionBody.replace(/^return\s*/, "").trim();
      }

      if (lifecycleHooks.has(functionName)) {
        return [];
      }

      const isMethod = methodRegex.test(selectedText);
      const isTopLevelFunction = functionRegex.test(selectedText);

      const formattedFunctionBody = usesThis(functionBody)
        ? `{ return ${functionBody}; }`
        : functionBody;

      const declaration = isTopLevelFunction ? "const" : "";
      const expressionBody = isMethod
        ? `${functionName} = (${matches[2]}) => ${formattedFunctionBody};`
        : `${declaration} ${functionName} = (${matches[2]}) => ${formattedFunctionBody};`;

      const cleanExpressionBody = expressionBody
        .replace(/;+\s*$/, ";")
        .replace(/;;/g, ";")
        .replace(/return return/g, "return")
        .replace(/\{\s*return\s*([^;]+);\s*\}/, "$1")
        .trim();

      const action = new vscode.CodeAction(
        "Convert To Expression Body",
        vscode.CodeActionKind.Refactor
      );
      action.edit = new vscode.WorkspaceEdit();
      action.edit.replace(
        document.uri,
        new vscode.Range(start, end),
        cleanExpressionBody
      );

      return [action];
    }

    if (arrowFunctionRegex.test(selectedText)) {
      return [];
    }

    return [];
  } catch (error) {
    return [];
  }
}

export function activate(context: vscode.ExtensionContext) {
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    [
      { scheme: "file", language: "typescript" },
      { scheme: "file", language: "javascript" },
    ],
    { provideCodeActions }
  );

  context.subscriptions.push(codeActionProvider);
}

export function deactivate() {}
