import { isObjectLiteral } from "./objectMatcher";

export function updatedExpressionBodyForMethodOrFunction(
  functionName: string,
  functionBody: string,
  declaration: string,
  parameters: string,
  returnType?: string,
  asyncKeyword?: string
) {
  if (isObjectLiteral(functionBody)) {
    functionBody = `(${functionBody})`;
  }
  return `${declaration}${functionName} = ${
    asyncKeyword ? asyncKeyword : ""
  }(${parameters})${returnType ? `:${returnType}` : ""} => ${functionBody};`;
}
