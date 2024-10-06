import * as vscode from "vscode";
import { hasSimpleReturnFunctions } from "./simpleReturnFinder";
import { getClassName } from "./classNameExtractor";
import { isWithinClass } from "./scopeFinder";
import { findEndPosition, shouldSkipConversion } from "./helperFunctions";
import { updatedExpressionBodyForMethodOrFunction } from "./expressionBodyCreator";

function provideCodeActions(
  document: vscode.TextDocument,
  range: vscode.Range
): vscode.CodeAction[] {
  try {
    const start = new vscode.Position(range.start.line, 0);
    const end = findEndPosition(document, range.start.line);
    const selectedText = document.getText(new vscode.Range(start, end));
    const isWithinClassDeclaration = isWithinClass(document, start.line);
    let methodConvertible = false;
    const methodRegex =
      /(?<!\b(?:function|export|default)\s+)((?:(?:public|private|protected|static|abstract|async|get|set|readonly|override)\s+)*)(\w+)\s*\(([^)]*)\)\s*(?::\s*([\w<>\[\]]*))?\s*\{([\s\S]*)\}/;
    const functionRegex =
      /(?:(async|export|default)\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*([\w<>\[\]]+))?\s*\{([\s\S]*?)\}(?!\s*=>)/;
    const arrowFunctionRegex =
      /((public|private|protected|static|abstract|readonly|override)\s+)?(const|let|var)?\s*(async\s+)?(\w+)\s*=\s*(async\s+)?\(([^)]*)\)\s*(?::\s*([\w<>\[\]]+))?\s*=>\s*(\{[^]*?\}|[^;]+?);?/;

    const braceStack: string[] = [];
    const lines = selectedText.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i].trim();
      for (const char of lineText) {
        if (char === "{") {
          braceStack.push("{");
        }
      }
      let className;
      let isSimpleReturn;
      if (isWithinClassDeclaration && selectedText.includes("function")) {
        return [];
      }
      if (isWithinClassDeclaration) {
        className = getClassName(document, start.line);
        isSimpleReturn = hasSimpleReturnFunctions(selectedText, className!);
      } else {
        isSimpleReturn = hasSimpleReturnFunctions(selectedText);
      }
      if (!isSimpleReturn || (braceStack.length > 1 && !isSimpleReturn)) {
        return [];
      }
      if (braceStack.length > 1 && isSimpleReturn) {
        methodConvertible = true;
      }
    }

    let functionName;
    let functionBody;
    let functionParameters;
    let declaration;
    let matches: RegExpExecArray | null;
    let expressionBody;
    let asyncKeyword;
    if ((matches = functionRegex.exec(selectedText))) {
      declaration = matches[1];
      functionName = matches[2];
      functionParameters = matches[3];
      const returnType = matches[4];
      functionBody = matches[5].trim();
      if (declaration && declaration.includes("async")) {
        asyncKeyword = "async";
      }
      if (
        (declaration && /(export|default)/.test(declaration)) ||
        shouldSkipConversion(functionName, functionBody)
      ) {
        return [];
      } else {
        declaration = "const ";
      }
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
      if (selectedText.includes("=>") && !methodConvertible) {
        return [];
      }

      declaration = matches[1];
      functionName = matches[2];
      functionBody = matches[5].trim();
      functionParameters = matches[3];
      const returnType = matches[4];
      if (
        declaration.includes("get") ||
        declaration.includes("set") ||
        shouldSkipConversion(functionName, functionBody)
      ) {
        return [];
      }

      if (declaration === undefined) {
        declaration = "";
      }
      if (declaration.includes("async")) {
        declaration = declaration.replace("async ", "");
        asyncKeyword = "async";
      }

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
    } else if ((matches = arrowFunctionRegex.exec(selectedText))) {
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
      if (functionBody.startsWith("{") && functionBody.endsWith("}")) {
        functionBody = functionBody.slice(1, -1).trim();
      }

      if (functionBody.endsWith(";")) {
        functionBody = functionBody.replace(/;\s*$/, "").trim();
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
        returnType,
        asyncKeyword
      );
    } else {
      return [];
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
    const action = new vscode.CodeAction(
      "Convert To Expression Body",
      vscode.CodeActionKind.Refactor
    );

    action.edit = new vscode.WorkspaceEdit();

    const startLineText = document.lineAt(start.line).text;
    const indentation = startLineText.match(/^\s*/)?.[0] || "";
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
