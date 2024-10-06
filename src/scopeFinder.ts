import * as vscode from "vscode";
export function isWithinClass(
  document: vscode.TextDocument,
  line: number
): boolean {
  let braceBalance = 0;
  for (let i = line - 1; i >= 0; i--) {
    const lineText = document.lineAt(i).text.trim();
    if (lineText === "" || lineText.startsWith("//")) {
      continue;
    }
    if (lineText.includes("}")) {
      braceBalance++;
    }
    if (lineText.includes("{")) {
      braceBalance--;
    }
    if (/class\s+\w+/.test(lineText) && braceBalance === -1) {
      return true;
    }
  }

  return false;
}
