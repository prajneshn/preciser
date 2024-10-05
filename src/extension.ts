import * as vscode from "vscode";

function hasControlFlow(body: string): boolean {
  return /if\s*\(|for\s*\(|while\s*\(|switch\s*\(|else\s*|else\s+if\s*\(|do\s*\{/.test(
    body
  );
}

function hasMultipleStatements(body: string): boolean {
  return /\n/.test(body) && !/^[^\{\}\n]*$/.test(body);
}

const babelParser = require("@babel/parser");

function isObjectLiteral(body: string): boolean {
  try {
    // Parse the input string as JavaScript or TypeScript
    const ast = babelParser.parse(`(${body})`, {
      sourceType: "module",
      plugins: [
        "jsx", // For handling JSX syntax (if required)
        "typescript", // For handling TypeScript syntax
      ],
    });

    // Check if the body is an object expression
    return (
      ast.program.body.length === 1 &&
      ast.program.body[0].expression.type === "ObjectExpression"
    );
  } catch (error) {
    return false; // If parsing fails, it's not valid
  }
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
    console.log("selectedText", selectedText);
    let methodConvertible = false;
    const methodRegex =
      /(?<!\b(?:function|export|default)\s+)((?:(?:public|private|protected|static|abstract|async|get|set|readonly|override)\s+)*)(\w+)\s*\(([^)]*)\)\s*(?::\s*([\w<>\[\]]*))?\s*\{([\s\S]*)\}/;

    const functionRegex =
      /(?:(async|export|default)\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*([\w<>\[\]]+))?\s*\{([\s\S]*?)\}(?!\s*=>)/g;

    const arrowFunctionRegex =
      /((public|private|protected|static|abstract|readonly|override)\s+)?(const|let|var)?\s*(async\s+)?(\w+)\s*=\s*(async\s+)?\(([^)]*)\)\s*(?::\s*([\w<>\[\]]+))?\s*=>\s*(\{[^]*?\}|[^;]+?);?/;

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
      console.log();
      if (
        braceStack.length > 1 &&
        !/\breturn\s+([\s\S]*?);\s*(?:\}|\n)/.test(selectedText)
      ) {
        console.log("inside");
        return [];
        // Apply your existing logic for top-level functions here
      }

      if (
        braceStack.length > 1 &&
        /\breturn\s+([\s\S]*?);\s*(?:\}|\n)/.test(selectedText)
      ) {
        methodConvertible = true;
      }

      // Process each character in the line
    }

    let functionName;
    let functionBody;
    let functionParameters;
    let declaration;
    let matches: RegExpExecArray | null;
    let expressionBody;
    let asyncKeyword;
    if ((matches = functionRegex.exec(selectedText))) {
      console.log("functionRegex");
      declaration = matches[1];
      functionName = matches[2];
      functionParameters = matches[3];
      const returnType = matches[4];
      functionBody = matches[5].trim();
      if (declaration && declaration.includes("async")) {
        asyncKeyword = "async";
      }
      if (declaration && /(export|default)/.test(declaration)) {
        return [];
      } else {
        declaration = "const ";
      }
      console.log("skip check beforer");
      if (shouldSkipConversion(functionName, functionBody)) {
        return [];
      }
      console.log("skip check after");
      console.log("check ended");
      if (functionBody.startsWith("return ")) {
        functionBody = functionBody.replace(/^return\s*/, "").trim();
      }
      expressionBody = updatedExpressionBodyForMethodOrFunction(
        functionName,
        functionBody,
        declaration,
        functionParameters,
        returnType,
        asyncKeyword
      );
    } else if ((matches = methodRegex.exec(selectedText))) {
      console.log("methodRegex", matches);
      if (selectedText.includes("=>") && !methodConvertible) {
        return [];
      }

      declaration = matches[1];
      if (declaration.includes("get") || declaration.includes("set")) {
        return [];
      }
      console.log("declaration", declaration);
      functionName = matches[2];
      functionParameters = matches[3];
      const returnType = matches[4];
      functionBody = matches[5].trim();
      if (declaration === undefined) {
        declaration = "";
      }
      if (declaration.includes("async")) {
        declaration = declaration.replace("async ", "");
        asyncKeyword = "async";
      }
      console.log(functionName, functionBody);
      if (shouldSkipConversion(functionName, functionBody)) {
        return [];
      }
      if (functionBody.startsWith("return ")) {
        functionBody = functionBody.replace(/^return\s*/, "").trim();
      }
      console.log("functionBody", functionBody);
      expressionBody = updatedExpressionBodyForMethodOrFunction(
        functionName,
        functionBody,
        declaration,
        functionParameters,
        returnType,
        asyncKeyword
      );
    } else if ((matches = arrowFunctionRegex.exec(selectedText))) {
      console.log("arrowFunctionRegex", matches);
      const acesSpecifier = matches[1];
      const variableDeclaration = matches[3];
      if (acesSpecifier && variableDeclaration) {
        declaration = acesSpecifier + " " + variableDeclaration + " ";
      } else if (acesSpecifier) {
        declaration = acesSpecifier;
      } else if (variableDeclaration) {
        declaration = variableDeclaration + " ";
      } else {
        declaration = "";
      }
      const asyncBeforeName = matches[4];
      functionName = matches[5];
      const asyncBeforeParameters = matches[6];
      if (asyncBeforeName || asyncBeforeParameters) {
        asyncKeyword = "async";
      }
      functionParameters = matches[7];
      const returnType = matches[8];
      functionBody = matches[9].trim();
      if (methodConvertible) {
        functionBody = functionBody + "}";
      }
      //console.log("functionBody", functionBody);
      if (functionBody.startsWith("{") && functionBody.endsWith("}")) {
        functionBody = functionBody.slice(1, -1).trim();
      }

      if (functionBody.endsWith(";")) {
        functionBody = functionBody.replace(/;\s*$/, "").trim();
      }

      console.log("before skip check");
      console.log("functionbody", functionBody);
      if (shouldSkipConversion(functionName, functionBody)) {
        return [];
      }
      console.log("after skip check");
      console.log("functionBody", functionBody);
      if (functionBody.startsWith("return ")) {
        functionBody = functionBody.replace(/^return\s*/, "").trim();
      }
      console.log(declaration, functionName);
      expressionBody = updatedExpressionBodyForMethodOrFunction(
        functionName,
        functionBody,
        declaration,
        functionParameters,
        returnType,
        asyncKeyword
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
      returnType?: string,
      asyncKeyword?: string
    ) {
      console.log("functionBody", functionBody);
      console.log("functionName", functionName);
      console.log("parameters", parameters);
      console.log("returnType", returnType);
      console.log("declaration", declaration);
      console.log(isObjectLiteral(functionBody));
      if (isObjectLiteral(functionBody)) {
        functionBody = `(${functionBody})`;
      }
      console.log("functionBody", functionBody);
      return `${declaration}${functionName} = ${
        asyncKeyword ? asyncKeyword : ""
      }(${parameters})${
        returnType ? `:${returnType}` : ""
      } => ${functionBody};`;
    }
    function shouldSkipConversion(
      functionName: string,
      functionBody: string
    ): boolean {
      if (
        (hasMultipleStatements(functionBody) &&
          !/\breturn\s+([\s\S]*?);\s*(?:\}|\n)/.test(selectedText)) ||
        hasControlFlow(functionBody)
      ) {
        console.log("inside");
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

    //Get the indentation of the start line
    const startLineText = document.lineAt(start.line).text;
    const indentation = startLineText.match(/^\s*/)?.[0] || "";
    // console.log("cleanexpressionbody", cleanExpressionBody);
    // Add indentation to each line of the cleanExpressionBody
    const indentedExpressionBody = cleanExpressionBody
      .split("\n")
      .map((line) => indentation + line)
      .join("\n");

    //console.log("indentedExpressionBody", indentedExpressionBody);

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
