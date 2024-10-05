const babelParser = require("@babel/parser");
function isObjectLiteral(body: string): boolean {
  try {
    const ast = babelParser.parse(`(${body})`, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    });
    return (
      ast.program.body.length === 1 &&
      ast.program.body[0].expression.type === "ObjectExpression"
    );
  } catch (error) {
    return false;
  }
}
