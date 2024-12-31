import * as vscode from "vscode";
import { hasSimpleReturnFunctions } from "./simpleReturnFinder";
import { getClassName } from "./classNameExtractor";
import { isWithinClass } from "./scopeFinder";
import { mapParameters, shouldSkipConversion } from "./helperFunctions";
import { updatedExpressionBodyForMethodOrFunction } from "./expressionBodyCreator";
import {
  containsArrowFunction,
  containsFunctionDeclaration,
  extractFunctionDetails,
  isNestedFunction,
} from "./functionMatcher";
import { extractArrowFunctionDetailsAdvanced } from "./arrowFunctionMatcher";
import { findEndPosition } from "./findEndPosition";
import {
  containsClassMethod,
  extractClassMethodDetails,
} from "./classMethodMatcher";

function provideCodeActions(
  document: vscode.TextDocument,
  range: vscode.Range
): vscode.CodeAction[] {
  try {
    let selectedTextWithClass;
    let textForArrowFunction: string | undefined;
    const start = new vscode.Position(range.start.line, 0);
    const end = findEndPosition(document, range.start.line);
    const selectedText = document.getText(new vscode.Range(start, end));
    const isWithinClassDeclaration = isWithinClass(document, start.line);
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
      if (isWithinClassDeclaration && selectedText.includes("const")) {
        return [];
      }
      if (isWithinClassDeclaration && selectedText.includes("var")) {
        return [];
      }
      if (isWithinClassDeclaration && selectedText.includes("let")) {
        return [];
      }
      if (selectedText.includes("catch") || selectedText.includes("try")) {
        return [];
      }

      if (isWithinClassDeclaration) {
        className = getClassName(document, start.line);
        isSimpleReturn = hasSimpleReturnFunctions(selectedText, className!);
        selectedTextWithClass = selectedText.replace(/^[ \t]+|[ \t]+$/gm, "");
        selectedTextWithClass =
          "class " + className + "{" + selectedTextWithClass + "}";
        textForArrowFunction = selectedTextWithClass;
      } else {
        isSimpleReturn = hasSimpleReturnFunctions(selectedText);
        textForArrowFunction = selectedText;
      }
      if (!isSimpleReturn || (braceStack.length > 1 && !isSimpleReturn)) {
        return [];
      }
    }

    let functionName;
    let functionBody;
    let functionParameters = "";
    let declaration;
    let expressionBody;
    let asyncKeyword;
    if (
      (!isWithinClass || selectedText.includes("function ")) &&
      containsFunctionDeclaration(selectedText)
    ) {
      const functionDetails = extractFunctionDetails(selectedText);

      functionName = functionDetails.functionName;
      if (
        functionName === null ||
        isNestedFunction(selectedText, functionName)
      ) {
        return [];
      }

      declaration = functionDetails.declaration;
      if (
        selectedText.includes("export ") ||
        selectedText.includes("default ")
      ) {
        return [];
      }
      if (declaration && declaration.includes("async")) {
        asyncKeyword = "async";
      }
      const returnType = functionDetails.returnType ?? undefined;
      functionBody = functionDetails.functionBody;
      functionParameters = mapParameters(functionDetails.functionParameters);
      if (
        (declaration && /(export|default)/.test(declaration)) ||
        shouldSkipConversion(functionName, functionBody)
      ) {
        return [];
      } else {
        declaration = "const ";
      }
      expressionBody = updatedExpressionBodyForMethodOrFunction(
        functionName,
        functionBody,
        declaration,
        functionParameters,
        returnType,
        asyncKeyword
      );
    } else if (containsClassMethod(selectedTextWithClass)) {
      var classMethodDetails = extractClassMethodDetails(selectedTextWithClass);
      if (classMethodDetails === null) {
        return [];
      }

      declaration =
        (classMethodDetails.accessSpecifier
          ? classMethodDetails.accessSpecifier + " "
          : "") +
        (classMethodDetails.modifiers && classMethodDetails.modifiers.length > 0
          ? classMethodDetails.modifiers.join(" ") + " "
          : (declaration ?? "").trim());
      functionName = classMethodDetails.functionName;
      if (functionName === "function" || functionName === null) {
        return [];
      }
      functionBody = classMethodDetails.functionBody;
      functionParameters = mapParameters(classMethodDetails.functionParameters);
      const returnType = classMethodDetails.returnType ?? undefined;
      if (shouldSkipConversion(functionName, functionBody)) {
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
    } else if (containsArrowFunction(textForArrowFunction!)) {
      var details = extractArrowFunctionDetailsAdvanced(textForArrowFunction!);
      functionName = details.functionName;
      if (functionName === null) return [];
      const variableDeclaration = details.variableKind;
      declaration =
        (details.accessSpecifier ? details.accessSpecifier + " " : "") +
        (details.modifiers && details.modifiers.length > 0
          ? details.modifiers.join(" ") + " "
          : (declaration ?? "").trim());

      if (variableDeclaration) {
        declaration = "const ";
      }

      const asyncBeforeName = details.modifiers.includes("async");
      const asyncBeforeParameters = details.modifiers.includes("async");
      if (asyncBeforeName || asyncBeforeParameters) asyncKeyword = "async";
      functionParameters = mapParameters(details.functionParameters);
      const returnType = details.returnType ?? undefined;
      functionBody = details.functionBody;
      if (functionBody.startsWith("{") && functionBody.endsWith("}"))
        functionBody = functionBody.slice(1, -1).trim();
      if (shouldSkipConversion(functionName, functionBody)) return [];
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
