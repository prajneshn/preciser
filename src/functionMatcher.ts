import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";

export function extractFunctionDetails(code: string) {
  const ast = parser.parse(code, {
    sourceType: "module",
    plugins: ["typescript"],
  });

  let functionDetails: {
    declaration: string;
    functionName: string;
    functionParameters: {
      name: string;
      type: string | null;
      defaultValue: string | null;
    }[];
    returnType: string | null;
    functionBody: string;
  } = {
    declaration: "",
    functionName: "",
    functionParameters: [],
    returnType: null,
    functionBody: "",
  };

  traverse(ast, {
    ExportNamedDeclaration(path: any) {
      if (path.node.declaration.type === "FunctionDeclaration") {
        const funcPath = path.get("declaration");
        processFunction(funcPath.node, "export");
      }
    },
    ExportDefaultDeclaration(path: any) {
      if (path.node.declaration.type === "FunctionDeclaration") {
        const funcPath = path.get("declaration");
        processFunction(funcPath.node, "export default");
      }
    },
    FunctionDeclaration(path: any) {
      processFunction(path.node, "");
    },
  });

  function processFunction(node: any, exportKeyword: string) {
    const functionName = node.id.name;
    const params = node.params.map((param: any) => {
      if (param.type === "RestElement") {
        return {
          name: `...${param.argument.name}`,
          type: param.typeAnnotation
            ? generate(param.typeAnnotation.typeAnnotation).code
            : null,
          defaultValue: null,
        };
      } else if (param.type === "ObjectPattern") {
        return {
          name: generate(param).code.replace(/\s+/g, " "),
          type: param.typeAnnotation
            ? generate(param.typeAnnotation.typeAnnotation).code.replace(
                /\s+/g,
                " "
              )
            : null,
          defaultValue: null,
        };
      } else if (param.type === "AssignmentPattern") {
        return {
          name: param.left.name,
          type: param.left.typeAnnotation
            ? generate(param.left.typeAnnotation.typeAnnotation).code.replace(
                /\s+/g,
                " "
              )
            : null,
          defaultValue: generate(param.right).code,
        };
      } else {
        const defaultValue = param.right ? generate(param.right).code : null;
        const type = param.typeAnnotation
          ? generate(param.typeAnnotation.typeAnnotation).code
          : null;
        const isNullable = param.optional;
        return {
          name: isNullable ? `${param.name}?` : param.name,
          type,
          defaultValue,
        };
      }
    });

    let returnType = node.returnType
      ? generate(node.returnType.typeAnnotation)
          .code.replace(/;(?=\s*})/g, "")
          .replace(/\s+/g, " ")
      : null;
    const body = node.body.body;

    const asyncKeyword = node.async ? "async" : "";

    functionDetails = {
      declaration: `${exportKeyword} ${asyncKeyword}`.trim(),
      functionName,
      functionParameters: params,
      returnType,
      functionBody: body
        .map((statement: any) => generate(statement).code)
        .join("\n")
        .trim(),
    };
  }

  return functionDetails;
}

export function containsFunctionDeclaration(code: string): boolean {
  const ast = parser.parse(code, {
    sourceType: "module",
    plugins: ["typescript"],
  });

  let containsFunction = false;
  traverse(ast, {
    FunctionDeclaration(path: any) {
      containsFunction = true;
      path.stop();
    },
  });

  return containsFunction;
}
export function containsArrowFunction(code: string): boolean {
  const ast = parser.parse(code, {
    sourceType: "module",
    plugins: ["typescript"],
  });

  let containsFunction = false;
  traverse(ast, {
    ArrowFunctionExpression(path: any) {
      containsFunction = true;
      path.stop();
    },
  });

  return containsFunction;
}
export function isNestedFunction(code: string, functionName: string): boolean {
  const ast = parser.parse(code, {
    sourceType: "module",
    plugins: ["typescript"],
  });

  let isNested = false;
  let functionStack: string[] = [];

  traverse(ast, {
    FunctionDeclaration(path: any) {
      const funcName = path.node.id?.name;

      functionStack.push(funcName);

      if (funcName === functionName) {
        isNested = functionStack.length > 1;
        path.stop();
      }
    },
    exit(path: any) {
      if (path.isFunctionDeclaration()) {
        functionStack.pop();
      }
    },
  });

  return isNested;
}
