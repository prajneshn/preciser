import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";

export function extractClassMethodDetails(code: string | undefined) {
  if (!code) {
    return null;
  }
  const ast = parser.parse(code, {
    sourceType: "script",
    plugins: [
      "typescript",
      "classProperties",
      "classPrivateProperties",
      "classPrivateMethods",
      "classStaticBlock",
    ],
  });

  let classMethodDetails: {
    declaration: string;
    accessSpecifier: string | null;
    modifiers: string[];
    functionName: string | null;
    functionParameters: {
      name: string;
      type: string | null;
      defaultValue: string | null;
      optional: boolean;
    }[];
    returnType: string | null;
    functionBody: string;
  } = {
    declaration: "",
    accessSpecifier: null,
    modifiers: [],
    functionName: null,
    functionParameters: [],
    returnType: null,
    functionBody: "",
  };

  traverse(ast, {
    ClassMethod(path: any) {
      const method = path.node;
      const accessSpecifier = getAccessSpecifier(path.node);
      const functionName = method.key.name;
      const params = method.params.map((param: any) => {
        const isOptional =
          param.type === "TSParameterProperty" || param.optional;
        let paramName: string;
        let paramType: string | null = null;
        let defaultValue: string | null = null;

        if (param.type === "RestElement") {
          paramName = `...${param.argument.name}`;
          paramType = param.typeAnnotation
            ? generate(param.typeAnnotation.typeAnnotation).code
            : null;
        } else if (param.type === "AssignmentPattern") {
          paramName = param.left.name;
          paramType = param.left.typeAnnotation
            ? generate(param.left.typeAnnotation.typeAnnotation).code
            : null;
          defaultValue = generate(param.right).code;
        } else if (param.type === "ObjectPattern") {
          paramName = `{ ${param.properties
            .map((prop: any) => prop.key.name)
            .join(", ")} }`;
          paramType = param.typeAnnotation
            ? generate(param.typeAnnotation.typeAnnotation).code.replace(
                /\s+/g,
                " "
              )
            : null;
        } else {
          (paramName = param.optional ? `${param.name}?` : param.name),
            (paramType = param.typeAnnotation
              ? generate(param.typeAnnotation.typeAnnotation).code.replace(
                  /\s+/g,
                  " "
                )
              : null);
        }

        return {
          name: paramName,
          type: paramType,
          defaultValue,
          optional: isOptional,
        };
      });

      const returnType = method.returnType
        ? generate(method.returnType.typeAnnotation)
            .code.replace(/;(?=\s*})/g, "")
            .replace(/\s+/g, " ")
        : null;

      const body = method.body.body
        ? method.body.body
            .map((statement: any) => generate(statement).code)
            .join("\n")
            .trim()
        : generate(method.body).code;

      const asyncKeyword = method.async ? "async" : "";
      const staticKeyword = method.static ? "static" : "";
      const readonlyKeyword = method.readonly ? "readonly" : "";
      const modifiers = [asyncKeyword, staticKeyword, readonlyKeyword].filter(
        Boolean
      );

      classMethodDetails = {
        declaration: `${asyncKeyword} ${staticKeyword}`.trim(),
        accessSpecifier,
        modifiers,
        functionName,
        functionParameters: params,
        returnType,
        functionBody: body,
      };
    },
  });

  function getAccessSpecifier(node: any): string | null {
    if (node.accessibility === "public") {
      return "public";
    } else if (node.accessibility === "private") {
      return "private";
    } else if (node.accessibility === "protected") {
      return "protected";
    }
    return null;
  }
  return classMethodDetails;
}

export function containsClassMethod(code: string | undefined): boolean {
  if (!code) {
    return false;
  }
  const ast = parser.parse(code, {
    sourceType: "module",
    plugins: ["typescript"],
  });

  let containsMethod = false;
  traverse(ast, {
    ClassMethod(path: any) {
      containsMethod = true;
      path.stop();
    },
  });

  return containsMethod;
}
