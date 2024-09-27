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
    const end = findEndPosition(document, range.start.line);
    function findEndPosition(
      document: vscode.TextDocument,
      startLine: number
    ): vscode.Position {
      let endLine = startLine;
      const braceStack: string[] = [];
      const functionRegex = /function\s+(\w+)\s*\(/;

      for (let i = startLine; i < document.lineCount; i++) {
        const lineText = document.lineAt(i).text;

        // Process each character in the line
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
    const selectedText = document.getText(new vscode.Range(start, end));

    const methodRegex =
      /(?<!\b(?:function|async|export|default)\s+)((?:(?:public|private|protected|static|abstract|async|get|set|readonly|override)\s*)*)(\w+)\s*\(([^)]*)\)\s*(?::\s*([\w<>\[\]]*))?\s*\{([\s\S]*?)\}/s;

    const functionRegex =
      /(?:(async|export|default)\s+)*function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*([\w<>\[\]]*))?\s*\{([\s\S]*?)\}(?!\s*=>)/g;

    const arrowFunctionRegex =
      /((?:public|private|protected|static|abstract|async|readonly|override)\s+)?(const|let|var)?\s+(\w+)\s*=\s*\(([^)]*)\)\s*(?::\s*([\w<>[\]]+))?\s*=>\s*{([\s\S]*?)}/;

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

    const braceStack: string[] = [];
    const lines = selectedText.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i].trim();

      for (const char of lineText) {
        if (char === "{") {
          braceStack.push("{");
        }
      }

      if (braceStack.length > 1) {
        return [];
        // Apply your existing logic for top-level functions here
      }

      // Process each character in the line
    }

    let functionName;
    let functionBody;
    let functionParameters;
    let declaration;
    let matches: RegExpExecArray | null;
    let expressionBody;
    if ((matches = functionRegex.exec(selectedText))) {
      // console.log("functionRegex", matches);
      declaration = matches[1];

      functionName = matches[2];
      functionParameters = matches[3];
      const returnType = matches[4];
      functionBody = matches[5].trim();
      console.log("function regex");
      //console.log("selectedText", selectedText);
      console.log("functionName", functionName);
      console.log("functionBody", functionBody);
      console.log("declaration", declaration);
      // if (isNestedFunction(selectedText, functionName)) {
      //   return [];
      // }
      // console.log(
      //   "isNestedFunction",
      //   isNestedFunction(selectedText, functionName)
      // );
      console.log("functionBody", functionBody);
      console.log("functionName", functionName);
      console.log("selectedText", selectedText);
      //console.log(isNestedFunction(selectedText, functionName));
      if (declaration && /(async|export|default)/.test(declaration)) {
        return [];
      } else {
        declaration = "const ";
      }
      console.log("check started");
      if (shouldSkipConversion(functionName, functionBody)) {
        return [];
      }
      console.log("check ended");
      if (functionBody.startsWith("return ")) {
        functionBody = functionBody.replace(/^return\s*/, "").trim();
      }
      expressionBody = updatedExpressionBodyForMethodOrFunction(
        functionName,
        functionBody,
        declaration,
        functionParameters,
        returnType
      );
    } else if ((matches = methodRegex.exec(selectedText))) {
      if (selectedText.includes("=>")) {
        return [];
      }

      declaration = matches[1];
      if (declaration.includes("get") || declaration.includes("set")) {
        return [];
      }
      functionName = matches[2];
      functionParameters = matches[3];
      const returnType = matches[4];
      functionBody = matches[5].trim();
      if (declaration === undefined) {
        declaration = "";
      }
      if (shouldSkipConversion(functionName, functionBody)) {
        return [];
      }
      if (functionBody.startsWith("return ")) {
        functionBody = functionBody.replace(/^return\s*/, "").trim();
      }
      expressionBody = updatedExpressionBodyForMethodOrFunction(
        functionName,
        functionBody,
        declaration,
        functionParameters,
        returnType
      );
    } else if ((matches = arrowFunctionRegex.exec(selectedText))) {
      console.log("arrowFunctionRegex", matches);
      const acesSpecifier = matches[1];
      const keyword = matches[2];
      console.log("declaration", declaration);
      if (acesSpecifier && keyword) {
        declaration = acesSpecifier + " " + keyword + " ";
      } else if (acesSpecifier) {
        declaration = acesSpecifier + " ";
      } else if (keyword) {
        declaration = keyword + " ";
      } else {
        declaration = "";
      }
      functionName = matches[3];
      functionParameters = matches[4];
      const returnType = matches[5];
      functionBody = matches[6].trim();
      if (functionBody.startsWith("return ")) {
        functionBody = functionBody.replace(/^return\s*/, "").trim();
      }
      if (shouldSkipConversion(functionName, functionBody)) {
        return [];
      }
      console.log("functionBody", functionBody);
      expressionBody = updatedExpressionBodyForMethodOrFunction(
        functionName,
        functionBody,
        declaration,
        functionParameters,
        returnType
      );
      console.log("expressionBody", expressionBody);
    } else {
      console.log("no match");
      return [];
    }

    function updatedExpressionBodyForMethodOrFunction(
      functionName: string,
      functionBody: string,
      declaration: string,
      parameters: string,
      returnType?: string
    ) {
      return `${declaration}${functionName} = (${parameters})${
        returnType ? `:${returnType}` : ""
      } => ${functionBody};`;
    }

    function shouldSkipConversion(
      functionName: string,
      functionBody: string
    ): boolean {
      if (hasMultipleStatements(functionBody) || hasControlFlow(functionBody)) {
        return true;
      }
      if (lifecycleHooks.has(functionName)) {
        return true;
      }
      return false;
    }
    return createCodeAction(expressionBody, start, end);
  } catch (error) {
    return [];
  }

  function createCodeAction(
    expressionBody: string,
    start: vscode.Position,
    end: vscode.Position
  ) {
    const cleanExpressionBody = expressionBody
      .replace(/;+\s*$/, ";")
      .replace(/;;/g, ";")
      .replace(/return return/g, "return")
      .replace(/\{\s*return\s*([^;]+);\s*\}/, "$1")
      .trim();

    console.log("cleanExpressionBody", cleanExpressionBody);
    const action = new vscode.CodeAction(
      "Convert To Expression Body",
      vscode.CodeActionKind.Refactor
    );

    action.edit = new vscode.WorkspaceEdit();

    // Get the indentation of the start line
    const startLineText = document.lineAt(start.line).text;
    const indentation = startLineText.match(/^\s*/)?.[0] || "";

    // Add indentation to each line of the cleanExpressionBody
    const indentedExpressionBody = cleanExpressionBody
      .split("\n")
      .map((line) => indentation + line)
      .join("\n");

    action.edit.replace(
      document.uri,
      new vscode.Range(start, end),
      indentedExpressionBody
    );

    return [action];
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
