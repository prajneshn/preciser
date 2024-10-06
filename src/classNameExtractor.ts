import * as vscode from "vscode";
export function getClassName(
  document: vscode.TextDocument,
  line: number
): string | null {
  for (let i = line - 1; i >= 0; i--) {
    const lineText = document.lineAt(i).text.trim();

    const classMatch = lineText.match(/class\s+(\w+)/);
    if (classMatch) {
      return classMatch[1];
    }
  }
  return null;
}
