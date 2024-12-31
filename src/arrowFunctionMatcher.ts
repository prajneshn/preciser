import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";

export function extractArrowFunctionDetailsAdvanced(code: string) {
  const ast = parser.parse(code, {
    sourceType: "module",
    plugins: ["typescript", "classProperties"],
  });

  let arrowFunctionDetails: {
    declaration: string;
    variableKind: string | null;
    accessSpecifier: string | null;
    modifiers: string[];
    functionName: string | null;
    functionParameters: {
      name: string;
      type: string | null;
      defaultValue: string | null;
    }[];
    returnType: string | null;
    functionBody: string;
  } = {
    declaration: "",
    variableKind: null,
    accessSpecifier: null,
    modifiers: [],
    functionName: null,
    functionParameters: [],
    returnType: null,
    functionBody: "",
  };

  traverse(ast, {
    VariableDeclaration(path: any) {
      const declarations = path.node.declarations;
      const variableKind = path.node.kind;

      declarations.forEach((declaration: any) => {
        if (
          declaration.init &&
          declaration.init.type === "ArrowFunctionExpression"
        ) {
          processArrowFunction(declaration.id, declaration.init, variableKind);
        }
      });
    },
    ClassProperty(path) {
      if (
        path.node.value &&
        path.node.value.type === "ArrowFunctionExpression"
      ) {
        const accessSpecifier = getAccessSpecifier(path.node);
        processArrowFunction(
          path.node.key,
          path.node.value,
          "",
          undefined,
          accessSpecifier
        );
      }
    },
    ExportNamedDeclaration(path: any) {
      const declaration = path.node.declaration;

      if (declaration && declaration.type === "VariableDeclaration") {
        const variableKind = declaration.kind;
        const declarations = declaration.declarations;

        declarations.forEach((decl: any) => {
          if (decl.init && decl.init.type === "ArrowFunctionExpression") {
            processArrowFunction(decl.id, decl.init, variableKind, "export");
          }
        });
      }
    },
    ExportDefaultDeclaration(path: any) {
      const declaration = path.node.declaration;

      if (declaration.type === "ArrowFunctionExpression") {
        processArrowFunction(null, declaration, "const", "export default");
      }
    },
  });

  function processArrowFunction(
    id: any,
    node: any,
    variableKind: string | null = null,
    exportKeyword: string = "",
    accessSpecifier: string | null = null
  ) {
    const functionName = id ? id.name : null;
    const params = node.params.map((param: any) => {
      if (param.type === "RestElement") {
        return {
          name: `...${param.argument.name}`,
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
      } else if (param.type === "ObjectPattern") {
        return {
          name: `{ ${param.properties
            .map((prop: any) => prop.key.name)
            .join(", ")} }`,
          type: param.typeAnnotation
            ? generate(param.typeAnnotation.typeAnnotation).code.replace(
                /\s+/g,
                " "
              )
            : null,
        };
      } else if (param.type === "ArrayPattern") {
        return {
          name: `[ ${param.elements
            .map((elem: any) => elem.name)
            .join(", ")} ]`,
          type: param.typeAnnotation
            ? generate(param.typeAnnotation.typeAnnotation).code.replace(
                /\s+/g,
                " "
              )
            : null,
        };
      } else {
        return {
          name: param.optional ? `${param.name}?` : param.name,
          type: param.typeAnnotation
            ? generate(param.typeAnnotation.typeAnnotation).code.replace(
                /\s+/g,
                " "
              )
            : null,
          defaultValue: null,
        };
      }
    });

    const returnType = node.returnType
      ? generate(node.returnType.typeAnnotation)
          .code.replace(/;(?=\s*})/g, "")
          .replace(/\s+/g, " ")
      : null;
    const body = node.body.body
      ? node.body.body
          .map((statement: any) => generate(statement).code)
          .join("\n")
          .trim()
      : generate(node.body).code;

    const asyncKeyword = node.async ? "async" : "";
    const staticKeyword = node.static ? "static" : "";
    const readonlyKeyword = node.readonly ? "readonly" : "";
    const modifiers = [asyncKeyword, staticKeyword, readonlyKeyword].filter(
      Boolean
    );

    arrowFunctionDetails = {
      declaration: `${exportKeyword} ${asyncKeyword}`.trim(),
      variableKind,
      accessSpecifier,
      modifiers,
      functionName,
      functionParameters: params,
      returnType,
      functionBody: body,
    };
  }
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

  return arrowFunctionDetails;
}
