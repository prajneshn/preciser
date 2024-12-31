import * as vscode from "vscode";

export function findEndPosition(
  document: vscode.TextDocument,
  startLine: number
): vscode.Position {
  let endLine = startLine;
  const braceStack: string[] = [];
  let inParamList = false;
  let inString = false;
  let inArrowFunction = false;
  let inReturnType = false;

  for (let i = startLine; i < document.lineCount; i++) {
    const lineText = document.lineAt(i).text;
    for (let j = 0; j < lineText.length; j++) {
      const char = lineText[j];
      if (char === '"' || char === "'" || char === "`") {
        inString = !inString;
      }

      if (inString) continue;
      if (!inArrowFunction && lineText.slice(j, j + 2) === "=>") {
        inArrowFunction = true;
        j++;
        continue;
      }
      if (char === "(") {
        inParamList = true;
      } else if (char === ")") {
        inParamList = false;
      }
      if (char === ":") {
        const restOfLine = lineText.slice(j + 1).trim();
        if (restOfLine.startsWith("{")) {
          inReturnType = true;
        }
      }
      if (!inParamList && !inReturnType) {
        if (char === "{") {
          braceStack.push("{");
        } else if (char === "}") {
          if (braceStack.length > 0) {
            braceStack.pop();
            if (braceStack.length === 0) {
              endLine = i;
              break;
            }
          }
        }
      }
      if (inReturnType && char === "}") {
        inReturnType = false;
      }
    }
    inArrowFunction = false;
    if (!inParamList && braceStack.length === 0) {
      break;
    }
  }

  return new vscode.Position(endLine, document.lineAt(endLine).text.length);
}
