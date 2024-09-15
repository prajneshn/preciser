import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    [
      { scheme: "file", language: "typescript" },
      { scheme: "file", language: "javascript" },
    ],
    {
      provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range
      ): vscode.CodeAction[] {
        try {
          const start = new vscode.Position(range.start.line, 0);
          let endLine = range.end.line;

          while (
            endLine < document.lineCount - 1 &&
            !document.lineAt(endLine).text.trim().endsWith("}")
          ) {
            endLine++;
          }
          const end = new vscode.Position(
            endLine,
            document.lineAt(endLine).text.length
          );
          const text = document.getText(new vscode.Range(start, end));
          const methodRegex =
            /(\w+)\s*\(([^)]*)\)\s*(?::\s*[\w<>\[\]]*)?\s*\{([\s\S]*?)\}/s;
          const functionRegex =
            /function\s*(\w+)\s*\(([^)]*)\)\s*(?::\s*[\w<>\[\]]*)?\s*\{([\s\S]*?)\}/s;
          const arrowFunctionRegex =
            /(\w+)\s*=\s*\(([^)]*)\)\s*(?::\s*[\w<>\[\]]*)?\s*=>\s*\{([\s\S]*?)\};/s;

          let matches = methodRegex.exec(text) || functionRegex.exec(text);
          if (matches) {
            console.log("Regex matches:", matches);

            const functionName = matches[1];
            let functionBody = matches[3].trim();

            const usesThis = /this\./.test(functionBody);
            const hasMultipleStatements =
              /\n/.test(functionBody) && !/^[^\{\}\n]*$/.test(functionBody);
            const hasControlFlow =
              /if\s*\(|for\s*\(|while\s*\(|switch\s*\(/.test(functionBody);

            if (hasMultipleStatements || hasControlFlow) {
              console.log(
                "Cannot convert function with multiple or control flow statements."
              );
              return [];
            }

            if (/^\s*return\s/.test(functionBody)) {
              functionBody = functionBody.replace(/^\s*return\s*/, "").trim();
            }

            const isMethod = methodRegex.test(text);
            const isTopLevelFunction = functionRegex.test(text);

            const lifecycleHooks = [
              "constructor",
              "ngOnInit",
              "ngOnDestroy",
              "ngAfterViewInit", // Angular hooks
              "componentDidMount",
              "componentWillUnmount",
              "shouldComponentUpdate", // React hooks
            ];

            if (lifecycleHooks.includes(functionName)) {
              console.log(
                `Skipping conversion for ${functionName} as it is a constructor or lifecycle hook.`
              );
              return [];
            }

            const declaration = isTopLevelFunction ? "const" : "";

            let formattedFunctionBody;
            if (usesThis) {
              formattedFunctionBody = `{ return ${functionBody}; }`;
            } else {
              formattedFunctionBody = functionBody;
            }

            const expressionBody = isMethod
              ? `${functionName} = (${matches[2]}) => ${formattedFunctionBody};`
              : `${declaration} ${functionName} = (${matches[2]}) => ${formattedFunctionBody};`;

            const cleanExpressionBody = expressionBody
              .replace(/;+\s*$/, ";")
              .replace(/;;/g, ";")
              .replace(/return return/g, "return")
              .replace(/\{\s*return\s*([^;]+);\s*\}/, "$1")
              .trim();

            const finalExpressionBody = isTopLevelFunction
              ? `${declaration} ${cleanExpressionBody}`
              : cleanExpressionBody;

            const action = new vscode.CodeAction(
              "Convert To Expression Body",
              vscode.CodeActionKind.Refactor
            );

            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(
              document.uri,
              new vscode.Range(start, end),
              finalExpressionBody
            );

            return [action];
          } else if (arrowFunctionRegex.test(text)) {
            return [];
          }
          return [];
        } catch (error) {
          return [];
        }
      },
    }
  );

  context.subscriptions.push(codeActionProvider);
}

export function deactivate() {}
