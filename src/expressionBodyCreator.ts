import { isObjectLiteral } from "./objectMatcher";

export function updatedExpressionBodyForMethodOrFunction(
  functionName: string,
  functionBody: string,
  declaration: string,
  parameters: string,
  returnType?: string,
  asyncKeyword?: string
) {
  if (functionBody.startsWith("return ")) {
    functionBody = functionBody.replace(/^return\s*/, "").trim();
  }
  if (functionBody.endsWith(";")) {
    functionBody = functionBody.replace(/;\s*$/, "").trim();
  }
  functionBody = functionBody.replace(/\s+/g, " ").trim();
  if (isObjectLiteral(functionBody)) {
    functionBody = `(${functionBody})`;
  }
  const asyncPart = asyncKeyword ? `${asyncKeyword} ` : "";
  const returnTypePart = returnType ? `: ${returnType}` : "";
  return `${declaration}${functionName} = ${asyncPart}(${parameters})${returnTypePart} => ${functionBody};`;
}
